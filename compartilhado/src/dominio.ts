import { randomInt } from 'node:crypto';
import { executar, inserir, todos, transacao, um } from './db.ts';
import { enviarAviso } from './avisos.ts';
import { cifrar, indice } from './cripto.ts';
import { provedorPix } from './pagamentos.ts';
import { comTipos, lancarRepasses, regraDaIgreja, type ItemDivisao } from './repasses.ts';
import { ErroHttp, naoEncontrado, novoId } from './util.ts';

export type Divisao = ItemDivisao[];

type CampanhaDb = {
  id: string;
  edicao: string;
  titulo: string;
  subtitulo: string;
  descricao: string;
  valorCupom: number;
  divisaoJson: string;
  divisaoN2Json?: string;
  inicio: string | null;
  fim: string | null;
  ativa: number;
};

export function formatarCampanha(c: CampanhaDb) {
  const { divisaoJson, divisaoN2Json, ativa, ...resto } = c;
  return {
    ...resto,
    ativa: !!ativa,
    divisao: comTipos(JSON.parse(divisaoJson) as Divisao),
    divisaoN2: divisaoN2Json ? comTipos(JSON.parse(divisaoN2Json) as Divisao) : [],
  };
}

export function campanhaAtiva() {
  const c = um<CampanhaDb>('SELECT * FROM campanhas WHERE ativa = 1 LIMIT 1');
  if (!c) throw new ErroHttp(404, 'Nenhuma campanha ativa no momento.');
  const premios = um<{ total: number }>(
    'SELECT COALESCE(SUM(valor_estimado), 0) AS total FROM premios WHERE campanha_id = ?',
    c.id,
  );
  return { ...formatarCampanha(c), totalPremios: premios?.total ?? 0 };
}

const VALIDADE_PIX_MIN = 30;

export async function criarOferta(p: { usuarioId?: string; igrejaId: string; quantidade: number; anonima: boolean }) {
  if (!p.anonima && !p.usuarioId) throw new ErroHttp(401, 'Entre na sua conta para concorrer aos prêmios.');
  const campanha = campanhaAtiva();
  const igreja = um<{ status: string; nomeFantasia: string }>('SELECT status, nome_fantasia FROM igrejas WHERE id = ?', p.igrejaId);
  if (!igreja || igreja.status !== 'ativa') throw new ErroHttp(400, 'Igreja não encontrada ou ainda não aprovada.');

  const id = novoId();
  const txid = id.replace(/-/g, '').slice(0, 25);
  const valor = Math.round(p.quantidade * campanha.valorCupom * 100) / 100;
  // A cobrança é criada no gateway ANTES de gravar: se o gateway falhar, nenhuma oferta fica pela metade.
  const cobranca = await provedorPix().criarCobranca({
    txid, valor, expiraEmMin: VALIDADE_PIX_MIN, divisao: campanha.divisao,
    descricao: `Oferta ${campanha.edicao} - ${igreja.nomeFantasia}`.slice(0, 140),
    igreja: { id: p.igrejaId, nome: igreja.nomeFantasia },
  });
  inserir('ofertas', {
    id,
    campanhaId: campanha.id,
    usuarioId: p.usuarioId ?? null,
    igrejaId: p.igrejaId,
    quantidade: p.quantidade,
    valor,
    anonima: p.anonima,
    txid,
    copiaECola: cobranca.copiaECola,
    qrCode: cobranca.qrCodeBase64 ?? '',
    idGateway: cobranca.idNoGateway ?? null,
    // A regra (com ou sem semeador N2) é decidida agora e fica gravada na oferta.
    divisaoJson: JSON.stringify(regraDaIgreja(p.igrejaId, campanha)),
    expiraEm: new Date(Date.now() + VALIDADE_PIX_MIN * 60_000).toISOString(),
  });
  return buscarOferta(id);
}

type OfertaDb = {
  id: string;
  usuarioId: string | null;
  igrejaId: string;
  campanhaId: string;
  quantidade: number;
  valor: number;
  anonima: number;
  status: string;
  copiaECola: string;
  qrCode: string;
  expiraEm: string;
  criadaEm: string;
  pagaEm: string | null;
};

export function buscarOferta(id: string) {
  const o = um<OfertaDb>('SELECT * FROM ofertas WHERE id = ?', id);
  if (!o) throw naoEncontrado('Oferta');
  // Marca como expirada se passou do prazo sem pagamento.
  if (o.status === 'aguardando_pagamento' && new Date(o.expiraEm) < new Date()) {
    executar("UPDATE ofertas SET status = 'expirada' WHERE id = ? AND status = 'aguardando_pagamento'", id);
    o.status = 'expirada';
  }
  // Não expõe o id do ofertante: quem tem o link da oferta vê só o necessário para pagar.
  return {
    id: o.id,
    igrejaId: o.igrejaId,
    quantidade: o.quantidade,
    valor: o.valor,
    anonima: !!o.anonima,
    status: o.status,
    criadaEm: o.criadaEm,
    pix: { copiaECola: o.copiaECola, expiraEm: o.expiraEm, ...(o.qrCode ? { qrCodeBase64: o.qrCode } : {}) },
  };
}

function novoNumero(campanhaId: string): string {
  for (let i = 0; i < 50; i++) {
    const n = String(randomInt(0, 1_000_000)).padStart(6, '0');
    if (!um('SELECT 1 FROM cupons WHERE campanha_id = ? AND numero = ?', campanhaId, n)) return n;
  }
  throw new Error('Não foi possível gerar número de cupom único.');
}

/**
 * Confirma o pagamento e gera os cupons. Idempotente: o gateway pode
 * enviar o mesmo webhook mais de uma vez.
 */
export function confirmarPagamento(filtro: { id?: string; txid?: string; idNoGateway?: string }) {
  return transacao(() => {
    const o = filtro.id
      ? um<OfertaDb>('SELECT * FROM ofertas WHERE id = ?', filtro.id)
      : filtro.idNoGateway
        ? um<OfertaDb>('SELECT * FROM ofertas WHERE id_gateway = ?', filtro.idNoGateway)
        : um<OfertaDb>('SELECT * FROM ofertas WHERE txid = ?', filtro.txid ?? '');
    if (!o) throw naoEncontrado('Oferta');
    if (o.status === 'paga') return { jaPaga: true };

    executar("UPDATE ofertas SET status = 'paga', paga_em = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", o.id);
    // Quanto cada um tem a receber desta oferta (só registro; nada é transferido).
    lancarRepasses(o.id);
    if (!o.anonima) {
      for (let i = 0; i < o.quantidade; i++) {
        inserir('cupons', {
          id: novoId(),
          ofertaId: o.id,
          campanhaId: o.campanhaId,
          usuarioId: o.usuarioId,
          numero: novoNumero(o.campanhaId),
        });
      }
    }
    return { jaPaga: false };
  });
}

/**
 * Cupons do ofertante, com os mesmos dados do site: campanha, igreja, emissão, número,
 * situação (ativo enquanto a campanha está valendo; depois, expirado) e se foi premiado.
 */
export function cuponsDoUsuario(usuarioId: string) {
  return todos<{ ativo: number; premio: string | null }>(
    `SELECT c.id, c.oferta_id, c.numero, c.criado_em, i.nome_fantasia AS igreja_nome, ca.edicao AS campanha,
            (ca.ativa = 1 AND (ca.fim IS NULL OR ca.fim >= date('now'))) AS ativo,
            (SELECT p.nome FROM premios p WHERE p.ganhador_cupom_id = c.id LIMIT 1) AS premio
       FROM cupons c
       JOIN ofertas o ON o.id = c.oferta_id
       JOIN igrejas i ON i.id = o.igreja_id
       JOIN campanhas ca ON ca.id = c.campanha_id
      WHERE c.usuario_id = ?
      ORDER BY c.criado_em DESC, c.numero`,
    usuarioId,
  ).map(({ ativo, ...c }) => ({ ...c, status: ativo ? 'ativo' : 'expirado' }));
}

/** Dados para desenhar o bilhete de um cupom (só do próprio dono). */
export function cupomParaImagem(usuarioId: string, cupomId: string) {
  const c = um<{ numero: string; criadoEm: string; igreja: string; campanha: string; imagemCupom: string; nome: string; sobrenome: string }>(
    `SELECT c.numero, c.criado_em, i.nome_fantasia AS igreja, ca.edicao AS campanha, ca.imagem_cupom, u.nome, u.sobrenome
       FROM cupons c
       JOIN ofertas o ON o.id = c.oferta_id
       JOIN igrejas i ON i.id = o.igreja_id
       JOIN campanhas ca ON ca.id = c.campanha_id
       JOIN usuarios u ON u.id = c.usuario_id
      WHERE c.id = ? AND c.usuario_id = ?`,
    cupomId,
    usuarioId,
  );
  if (!c) throw naoEncontrado('Cupom');
  return c;
}

/**
 * Lembrete do sorteio na véspera: para prêmios da campanha ativa com sorteio nas próximas 24 h,
 * avisa todos os celulares uma única vez. Roda de hora em hora na API.
 */
export async function lembrarSorteios() {
  const proximos = todos<{ id: string; nome: string; dataSorteio: string }>(
    `SELECT p.id, p.nome, p.data_sorteio FROM premios p JOIN campanhas c ON c.id = p.campanha_id
      WHERE c.ativa = 1 AND p.ganhador_cupom_id IS NULL AND p.lembrete_enviado_em IS NULL`,
  ).filter((p) => {
    const falta = new Date(p.dataSorteio).getTime() - Date.now();
    return falta > 0 && falta <= 24 * 3_600_000;
  });
  for (const p of proximos) {
    // Marca antes de enviar: se o servidor reiniciar no meio, ninguém recebe o aviso duas vezes.
    executar("UPDATE premios SET lembrete_enviado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", p.id);
    const hora = new Date(p.dataSorteio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    await enviarAviso({ titulo: 'Amanhã tem sorteio!', mensagem: `${p.nome}: sorteio às ${hora}. Confira seus números da sorte no app.`, rota: '/cupons' });
  }
  return proximos.length;
}

/** Marca como expiradas as cobranças vencidas sem pagamento (roda de tempos em tempos na API). */
export function expirarOfertasVencidas() {
  return executar(
    "UPDATE ofertas SET status = 'expirada' WHERE status = 'aguardando_pagamento' AND expira_em < strftime('%Y-%m-%dT%H:%M:%fZ','now')",
  ).changes;
}

/**
 * Exclusão de conta pedida pelo próprio ofertante (LGPD / lojas de apps).
 * Apaga os dados pessoais e o acesso. As ofertas pagas continuam no banco SEM identificação,
 * porque são registro financeiro das igrejas. Os cupons deixam de participar dos sorteios futuros.
 */
export function excluirConta(usuarioId: string) {
  return transacao(() => {
    const u = um<{ whatsappIndice: string; excluidoEm: string | null }>(
      'SELECT whatsapp_indice, excluido_em FROM usuarios WHERE id = ?',
      usuarioId,
    );
    if (!u || u.excluidoEm) throw naoEncontrado('Conta');
    executar('DELETE FROM otps WHERE whatsapp = ?', u.whatsappIndice);
    executar('DELETE FROM dispositivos WHERE usuario_id = ?', usuarioId);
    executar(
      `UPDATE usuarios SET nome = 'Conta excluída', sobrenome = '', whatsapp = ?, whatsapp_indice = ?,
              excluido_em = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id = ?`,
      `excluido:${usuarioId}`,
      `excluido:${usuarioId}`,
      usuarioId,
    );
    // Ofertas que ainda aguardavam pagamento são canceladas (o PIX gerado deixa de valer).
    executar("UPDATE ofertas SET status = 'cancelada' WHERE usuario_id = ? AND status = 'aguardando_pagamento'", usuarioId);
    const cupons = um<{ n: number }>('SELECT COUNT(*) AS n FROM cupons WHERE usuario_id = ?', usuarioId)?.n ?? 0;
    return { cupons };
  });
}

/** Sorteia um prêmio: aleatório entre os cupons da campanha, ou pelo número informado. */
export function sortearPremio(premioId: string, numeroInformado?: string) {
  const premio = um<{ id: string; campanhaId: string; ganhadorCupomId: string | null }>(
    'SELECT id, campanha_id, ganhador_cupom_id FROM premios WHERE id = ?',
    premioId,
  );
  if (!premio) throw naoEncontrado('Prêmio');
  if (premio.ganhadorCupomId) throw new ErroHttp(409, 'Este prêmio já foi sorteado.');

  type CupomGanhador = { id: string; numero: string; nome: string; sobrenome: string; cidade: string; uf: string };
  const base = `SELECT c.id, c.numero, u.nome, u.sobrenome, i.cidade, i.uf
                  FROM cupons c
                  JOIN usuarios u ON u.id = c.usuario_id AND u.excluido_em IS NULL
                  JOIN ofertas o ON o.id = c.oferta_id
                  JOIN igrejas i ON i.id = o.igreja_id
                 WHERE c.campanha_id = ?
                   AND c.id NOT IN (SELECT ganhador_cupom_id FROM premios WHERE ganhador_cupom_id IS NOT NULL)`;

  let cupom: CupomGanhador | undefined;
  if (numeroInformado) {
    cupom = um<CupomGanhador>(`${base} AND c.numero = ?`, premio.campanhaId, numeroInformado.padStart(6, '0'));
    if (!cupom) throw new ErroHttp(404, 'Nenhum cupom válido com esse número nesta campanha.');
  } else {
    const total = um<{ n: number }>(`SELECT COUNT(*) AS n FROM (${base})`, premio.campanhaId)?.n ?? 0;
    if (!total) throw new ErroHttp(400, 'Ainda não há cupons participantes nesta campanha.');
    cupom = um<CupomGanhador>(`${base} LIMIT 1 OFFSET ?`, premio.campanhaId, randomInt(0, total));
  }

  executar(
    `UPDATE premios SET ganhador_cupom_id = ?, ganhador_numero = ?, ganhador_nome = ?, ganhador_cidade = ?,
            sorteado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    cupom!.id,
    cupom!.numero,
    `${cupom!.nome} ${cupom!.sobrenome.charAt(0)}.`.trim(),
    `${cupom!.cidade}/${cupom!.uf}`,
    premioId,
  );
  return um('SELECT * FROM premios WHERE id = ?', premioId);
}

/**
 * Oferta registrada à mão pela equipe (ex.: recebida na igreja, fora do app).
 * Já entra como paga: gera os números da sorte (se não for anônima) e os repasses.
 * Para concorrer, precisa do WhatsApp da pessoa (é por ele que ela vê os cupons no app).
 */
export function registrarOfertaManual(p: {
  igrejaId: string; quantidade: number; anonima: boolean; nome?: string; sobrenome?: string; whatsapp?: string;
  observacao: string; adminNome: string;
}) {
  const campanha = campanhaAtiva();
  const igreja = um<{ status: string }>('SELECT status FROM igrejas WHERE id = ?', p.igrejaId);
  if (!igreja || igreja.status !== 'ativa') throw new ErroHttp(400, 'Igreja não encontrada ou ainda não aprovada.');
  if (!p.anonima && !p.whatsapp) throw new ErroHttp(400, 'Informe o WhatsApp de quem ofertou (ou marque como anônima).');

  return transacao(() => {
    let usuarioId: string | null = null;
    if (!p.anonima && p.whatsapp) {
      const existente = um<{ id: string }>('SELECT id FROM usuarios WHERE whatsapp_indice = ? AND excluido_em IS NULL', indice(p.whatsapp));
      usuarioId = existente?.id ?? novoId();
      if (!existente) {
        inserir('usuarios', {
          id: usuarioId, nome: p.nome?.trim() || 'Ofertante', sobrenome: p.sobrenome?.trim() ?? '',
          whatsapp: cifrar(p.whatsapp), whatsappIndice: indice(p.whatsapp),
        });
      }
    }
    const id = novoId();
    const valor = Math.round(p.quantidade * campanha.valorCupom * 100) / 100;
    inserir('ofertas', {
      id, campanhaId: campanha.id, usuarioId, igrejaId: p.igrejaId, quantidade: p.quantidade, valor, anonima: p.anonima,
      txid: `MANUAL${id.replace(/-/g, '').slice(0, 19)}`, copiaECola: '', divisaoJson: JSON.stringify(regraDaIgreja(p.igrejaId, campanha)),
      expiraEm: new Date().toISOString(), origem: 'manual', observacao: p.observacao, registradaPor: p.adminNome,
    });
    confirmarPagamento({ id });
    const numeros = todos<{ numero: string }>('SELECT numero FROM cupons WHERE oferta_id = ? ORDER BY numero', id).map((c) => c.numero);
    return { id, valor, numeros };
  });
}
