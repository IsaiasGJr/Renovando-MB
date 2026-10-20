import { randomInt } from 'node:crypto';
import { executar, inserir, todos, transacao, um } from './db.ts';
import { ErroHttp, naoEncontrado, novoId } from './util.ts';

export type Divisao = { rotulo: string; percentual: number }[];

type CampanhaDb = {
  id: string;
  edicao: string;
  titulo: string;
  subtitulo: string;
  descricao: string;
  valorCupom: number;
  divisaoJson: string;
  inicio: string | null;
  fim: string | null;
  ativa: number;
};

export function formatarCampanha(c: CampanhaDb) {
  const { divisaoJson, ativa, ...resto } = c;
  return { ...resto, ativa: !!ativa, divisao: JSON.parse(divisaoJson) as Divisao };
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

/** Payload PIX de exemplo. Na integração real o gateway devolve o copia-e-cola. */
function payloadPix(txid: string, valor: number) {
  return `00020126580014BR.GOV.BCB.PIX0136${txid}5204000053039865406${valor.toFixed(2)}5802BR5909RENOVANDO6006PALMAS62070503***6304`;
}

export function criarOferta(p: { usuarioId?: string; igrejaId: string; quantidade: number; anonima: boolean }) {
  if (!p.anonima && !p.usuarioId) throw new ErroHttp(401, 'Entre na sua conta para concorrer aos prêmios.');
  const campanha = campanhaAtiva();
  const igreja = um<{ status: string }>('SELECT status FROM igrejas WHERE id = ?', p.igrejaId);
  if (!igreja || igreja.status !== 'ativa') throw new ErroHttp(400, 'Igreja não encontrada ou ainda não aprovada.');

  const id = novoId();
  const txid = id.replace(/-/g, '').slice(0, 25);
  const valor = Math.round(p.quantidade * campanha.valorCupom * 100) / 100;
  inserir('ofertas', {
    id,
    campanhaId: campanha.id,
    usuarioId: p.usuarioId ?? null,
    igrejaId: p.igrejaId,
    quantidade: p.quantidade,
    valor,
    anonima: p.anonima,
    txid,
    copiaECola: payloadPix(txid, valor),
    divisaoJson: JSON.stringify(campanha.divisao),
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
    pix: { copiaECola: o.copiaECola, expiraEm: o.expiraEm },
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
export function confirmarPagamento(filtro: { id?: string; txid?: string }) {
  return transacao(() => {
    const o = filtro.id
      ? um<OfertaDb>('SELECT * FROM ofertas WHERE id = ?', filtro.id)
      : um<OfertaDb>('SELECT * FROM ofertas WHERE txid = ?', filtro.txid ?? '');
    if (!o) throw naoEncontrado('Oferta');
    if (o.status === 'paga') return { jaPaga: true };

    executar("UPDATE ofertas SET status = 'paga', paga_em = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", o.id);
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
