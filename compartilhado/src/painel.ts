/**
 * Painéis de quem entra pelo WhatsApp (pastor, semeador N1/N2, parceiro) e os cadastros que eles fazem.
 * Usado pela API do app ("Meu painel") e pelo admin web (perfis), para os dois mostrarem a mesma coisa.
 */
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { cifrar, indice } from './cripto.ts';
import { inserir, todos, um } from './db.ts';
import { movimentacoes, saldo } from './repasses.ts';
import { ErroHttp, novoId, slugUnico, soDigitos } from './util.ts';

export const whatsappSchema = z.string().transform(soDigitos).pipe(z.string().length(11, 'informe DDD + número'));

/** Painel completo de um WhatsApp (índice): igrejas em que é pastor, semeador e parceiro. */
export function montarPainel(whatsappIndice: string) {
  const camp = um<{ divisaoJson: string }>('SELECT divisao_json FROM campanhas WHERE ativa = 1');
  const divisao = JSON.parse(camp?.divisaoJson ?? '[]') as { rotulo: string; percentual: number }[];
  const pct = (rotulo: string) => divisao.find((x) => x.rotulo.toLowerCase() === rotulo)?.percentual ?? 0;
  const percentuais = { igreja: pct('igreja'), semeador: pct('semeador') };

  // Totais de todas as igrejas envolvidas numa única consulta.
  const totaisDe = (ids: string[]) => {
    const mapa = new Map<string, { arrecadado: number; ofertas: number; cupons: number }>();
    if (!ids.length) return mapa;
    for (const t of todos<{ igrejaId: string; arrecadado: number; ofertas: number; cupons: number }>(
      `SELECT igreja_id, COALESCE(SUM(valor),0) AS arrecadado, COUNT(*) AS ofertas,
              COALESCE(SUM(CASE WHEN anonima = 0 THEN quantidade ELSE 0 END),0) AS cupons
         FROM ofertas WHERE status = 'paga' AND igreja_id IN (${ids.map(() => '?').join(',')}) GROUP BY igreja_id`,
      ...ids,
    )) mapa.set(t.igrejaId, { arrecadado: t.arrecadado, ofertas: t.ofertas, cupons: t.cupons });
    return mapa;
  };
  const zerado = { arrecadado: 0, ofertas: 0, cupons: 0 };

  const minhas = todos<{ id: string; slug: string; nomeFantasia: string; cidade: string; uf: string; status: string; logoUrl: string; protocolo: string; observacao: string }>(
    'SELECT id, slug, nome_fantasia, cidade, uf, status, logo_url, protocolo, observacao FROM igrejas WHERE pastor_whatsapp_indice = ? ORDER BY nome_fantasia',
    whatsappIndice,
  );
  const s = um<{ id: string; nome: string; codigo: string; status: string; observacao: string }>(
    'SELECT id, nome, codigo, status, observacao FROM semeadores WHERE whatsapp_indice = ?',
    whatsappIndice,
  );
  const vinculadas = s
    ? todos<{ id: string; slug: string; nomeFantasia: string; cidade: string; uf: string; status: string }>(
        'SELECT id, slug, nome_fantasia, cidade, uf, status FROM igrejas WHERE semeador_id = ? ORDER BY nome_fantasia', s.id,
      )
    : [];

  const totais = totaisDe([...new Set([...minhas, ...vinculadas].map((i) => i.id))]);
  const igrejas = minhas.map((i) => {
    const t = totais.get(i.id) ?? zerado;
    return { ...i, ...t, repasse: Math.round(t.arrecadado * percentuais.igreja) / 100, saldo: saldo('igreja', i.id) };
  });

  let semeador = null;
  if (s) {
    const lista = vinculadas.map((i) => ({ ...i, arrecadado: (totais.get(i.id) ?? zerado).arrecadado }));
    const volume = lista.filter((i) => i.status === 'ativa').reduce((acc, i) => acc + i.arrecadado, 0);
    const pai = um<{ paiId: string | null }>('SELECT pai_id FROM semeadores WHERE id = ?', s.id)!;
    // N1 vê os N2 da rede dele (só nome, igrejas e volume; nada de dados pessoais).
    const rede = pai.paiId ? [] : todos<{ id: string; nome: string; sobrenome: string; status: string }>(
      'SELECT id, nome, sobrenome, status FROM semeadores WHERE pai_id = ? ORDER BY nome', s.id,
    ).map((n2) => {
      const v = um<{ igrejas: number; volume: number }>(
        `SELECT COUNT(DISTINCT i.id) AS igrejas, COALESCE(SUM(CASE WHEN o.status = 'paga' THEN o.valor END), 0) AS volume
           FROM igrejas i LEFT JOIN ofertas o ON o.igreja_id = i.id WHERE i.semeador_id = ?`, n2.id,
      )!;
      return { nome: `${n2.nome} ${n2.sobrenome.charAt(0)}.`.trim(), status: n2.status, ...v };
    });
    semeador = {
      ...s, nivel: pai.paiId ? 2 : 1, igrejas: lista, volume, comissao: Math.round(volume * percentuais.semeador) / 100,
      semeadoresIndicados: rede.length, rede, saldo: saldo('semeador', s.id), movimentacoes: movimentacoes('semeador', s.id, 20),
    };
  }

  const p = um<{ id: string; nome: string }>('SELECT id, nome FROM parceiros WHERE whatsapp_indice = ? AND ativo = 1', whatsappIndice);
  const parceiro = p ? {
    ...p,
    campanhas: todos<{ edicao: string; ativa: number; totalOfertas: number }>(
      `SELECT c.edicao, c.ativa, COALESCE((SELECT SUM(valor) FROM ofertas o WHERE o.campanha_id = c.id AND o.status = 'paga'), 0) AS total_ofertas
         FROM campanhas c WHERE c.parceiro_id = ? ORDER BY c.criado_em DESC`, p.id,
    ).map((c) => ({ ...c, ativa: !!c.ativa })),
    saldo: saldo('parceiro', p.id),
    movimentacoes: movimentacoes('parceiro', p.id, 20),
  } : null;

  return { igrejas, semeador, parceiro, percentuais };
}

/** Este WhatsApp pode mexer nesta igreja? (pastor dela, ou o semeador que a indicou) */
export function podeVerIgreja(whatsappIndice: string, igrejaId: string) {
  return !!um(
    `SELECT 1 FROM igrejas i LEFT JOIN semeadores s ON s.id = i.semeador_id
      WHERE i.id = ? AND (i.pastor_whatsapp_indice = ? OR s.whatsapp_indice = ?)`,
    igrejaId, whatsappIndice, whatsappIndice,
  );
}

/**
 * Últimas ofertas pagas das igrejas indicadas (para pastor e semeador). Mostra só o primeiro nome
 * e a inicial de quem ofertou ("Membros contribuintes"), nunca o WhatsApp.
 */
export function ofertasRecentes(igrejaIds: string[], limite = 30) {
  if (!igrejaIds.length) return [];
  return todos<{ id: string; valor: number; quantidade: number; pagaEm: string; igreja: string; anonima: number; nome: string | null; sobrenome: string | null; excluido: string | null }>(
    `SELECT o.id, o.valor, o.quantidade, o.paga_em, i.nome_fantasia AS igreja, o.anonima, u.nome, u.sobrenome, u.excluido_em AS excluido
       FROM ofertas o JOIN igrejas i ON i.id = o.igreja_id LEFT JOIN usuarios u ON u.id = o.usuario_id
      WHERE o.status = 'paga' AND o.igreja_id IN (${igrejaIds.map(() => '?').join(',')})
      ORDER BY o.paga_em DESC LIMIT ?`,
    ...igrejaIds, limite,
  ).map(({ anonima, nome, sobrenome, excluido, ...o }) => ({
    ...o,
    ofertante: anonima ? 'Anônimo' : excluido || !nome ? 'Ofertante' : `${nome} ${(sobrenome ?? '').charAt(0)}${sobrenome ? '.' : ''}`.trim(),
  }));
}

// ---------- Cadastros (pelo app, pelo site público e pelo semeador no painel) ----------

export const novaIgrejaSchema = z.object({
  cnpj: z.string().optional().default(''),
  razaoSocial: z.string().trim().min(2),
  nomeFantasia: z.string().trim().min(2),
  cep: z.string().optional().default(''),
  endereco: z.string().optional().default(''),
  cidade: z.string().trim().min(2),
  uf: z.string().trim().length(2).transform((s) => s.toUpperCase()),
  tipoChavePix: z.enum(['cnpj', 'cpf', 'email', 'telefone', 'aleatoria']),
  chavePix: z.string().trim().min(5),
  pastorNome: z.string().trim().min(3),
  pastorWhatsapp: whatsappSchema,
  codigoSemeador: z.string().optional(),
});

/** Cadastra uma igreja (sempre pendente: a equipe aprova). `semeadorId` liga direto ao semeador que cadastrou. */
export function cadastrarIgreja(dados: z.infer<typeof novaIgrejaSchema>, semeadorId?: string) {
  const { codigoSemeador, ...d } = dados;
  let semeador = semeadorId ? { id: semeadorId } : undefined;
  if (!semeador && codigoSemeador) {
    semeador = um<{ id: string }>("SELECT id FROM semeadores WHERE codigo = ? AND status = 'ativo'", codigoSemeador.toUpperCase());
    if (!semeador) throw new ErroHttp(400, 'Código de semeador não encontrado.');
  }
  const protocolo = `IG${Date.now().toString(36).toUpperCase()}${randomInt(10, 99)}`;
  const slug = slugUnico((x) => !!um('SELECT 1 FROM igrejas WHERE slug = ?', x), d.nomeFantasia);
  const id = novoId();
  inserir('igrejas', {
    id, ...d, cnpj: soDigitos(d.cnpj), pastorWhatsapp: cifrar(d.pastorWhatsapp), chavePix: cifrar(d.chavePix),
    pastorWhatsappIndice: indice(d.pastorWhatsapp), slug, semeadorId: semeador?.id ?? null, protocolo,
  });
  return { id, protocolo, status: 'pendente' };
}

export const novoSemeadorSchema = z.object({
  nome: z.string().trim().min(2),
  sobrenome: z.string().trim().min(2),
  whatsapp: whatsappSchema,
  cpf: z.string().transform(soDigitos).pipe(z.string().length(11, 'CPF deve ter 11 dígitos')),
  chavePix: z.string().trim().min(5),
  codigoIndicacao: z.string().optional(),
});

/** Cadastra um semeador (pendente). Com código (ou `paiId`) de um N1, entra como N2 da rede dele. */
export function cadastrarSemeador(dados: z.infer<typeof novoSemeadorSchema>, paiId?: string) {
  const { codigoIndicacao, ...d } = dados;
  let pai = paiId ? um<{ id: string; paiId: string | null }>('SELECT id, pai_id FROM semeadores WHERE id = ?', paiId) : undefined;
  if (!pai && codigoIndicacao) {
    pai = um<{ id: string; paiId: string | null }>("SELECT id, pai_id FROM semeadores WHERE codigo = ? AND status = 'ativo'", codigoIndicacao.toUpperCase());
    if (!pai) throw new ErroHttp(400, 'Código de indicação não encontrado.');
  }
  if (pai?.paiId) throw new ErroHttp(400, 'Este código é de um semeador N2, que não pode convidar outros semeadores. Peça o código ao semeador N1.');
  if (um('SELECT 1 FROM semeadores WHERE whatsapp_indice = ?', indice(d.whatsapp))) {
    throw new ErroHttp(409, 'Já existe um semeador com este WhatsApp.');
  }
  const codigo = `${d.nome.toUpperCase().normalize('NFD').replace(/[^A-Z]/g, '').slice(0, 3) || 'SEM'}${randomInt(1000, 9999)}`;
  const id = novoId();
  inserir('semeadores', {
    id, ...d, whatsapp: cifrar(d.whatsapp), whatsappIndice: indice(d.whatsapp), cpf: cifrar(d.cpf), chavePix: cifrar(d.chavePix),
    codigo, paiId: pai?.id ?? null,
  });
  return { id, status: 'pendente' };
}
