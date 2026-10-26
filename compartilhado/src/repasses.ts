/**
 * Repasses: quanto cada um tem a receber de cada oferta paga (igreja, semeadores N1/N2, parceiro, plataforma).
 *
 * IMPORTANTE: aqui só se CALCULA e REGISTRA. Nenhum dinheiro é transferido pelo sistema.
 * A equipe faz o pagamento por fora (banco/gateway) e depois marca no admin como pago, com uma referência.
 *
 * Regras de divisão (por campanha, editáveis no admin):
 *   - "sem N2": igreja indicada por um semeador N1 (ou sem semeador);
 *   - "com N2": igreja indicada por um semeador N2 — a parte de semeador se divide entre o N2 e o N1 que o trouxe.
 * Parte sem dono (ex.: igreja sem semeador, campanha sem parceiro) fica com a plataforma.
 */
import { executar, inserir, todos, um } from './db.ts';
import { novoId } from './util.ts';

export type TipoDivisao = 'igreja' | 'semeador_n1' | 'semeador_n2' | 'parceiro' | 'plataforma';
export type ItemDivisao = { rotulo: string; percentual: number; tipo?: TipoDivisao };
export type TipoBeneficiario = 'igreja' | 'semeador' | 'parceiro' | 'plataforma';

/** Descobre o tipo pelo rótulo (campanhas antigas não tinham o tipo gravado). */
export function tipoDoItem(i: ItemDivisao): TipoDivisao {
  if (i.tipo) return i.tipo;
  const r = i.rotulo.toLowerCase();
  if (r.includes('igreja')) return 'igreja';
  if (r.includes('n2')) return 'semeador_n2';
  if (r.includes('semeador')) return 'semeador_n1';
  if (r.includes('parceir')) return 'parceiro';
  return 'plataforma';
}

export const comTipos = (d: ItemDivisao[]) => d.map((i) => ({ ...i, tipo: tipoDoItem(i) }));

/** Regra de exemplo "com N2" a partir da regra "sem N2": divide a parte do semeador (3/7 N1, 4/7 N2). REVISAR. */
export function regraN2DeExemplo(semN2: ItemDivisao[]): ItemDivisao[] {
  const saida: ItemDivisao[] = [];
  for (const i of comTipos(semN2)) {
    if (i.tipo === 'semeador_n1') {
      const n1 = Math.round(i.percentual * (3 / 7) * 100) / 100;
      saida.push({ rotulo: 'Semeador N1', percentual: n1, tipo: 'semeador_n1' });
      saida.push({ rotulo: 'Semeador N2', percentual: Math.round((i.percentual - n1) * 100) / 100, tipo: 'semeador_n2' });
    } else saida.push(i);
  }
  return saida;
}

/** Qual regra vale para uma oferta nesta igreja: "com N2" se quem indicou a igreja é um semeador N2. */
export function regraDaIgreja(igrejaId: string, campanha: { divisao: ItemDivisao[]; divisaoN2?: ItemDivisao[] | null }) {
  const s = um<{ paiId: string | null }>(
    'SELECT s.pai_id FROM igrejas i JOIN semeadores s ON s.id = i.semeador_id WHERE i.id = ?',
    igrejaId,
  );
  const ehN2 = !!s?.paiId;
  return comTipos(ehN2 && campanha.divisaoN2?.length ? campanha.divisaoN2 : campanha.divisao);
}

/**
 * Cria os lançamentos "a pagar" de uma oferta paga. Idempotente (não duplica se já existirem).
 * Os centavos que sobram do arredondamento vão para a plataforma, para a soma bater com o valor da oferta.
 */
export function lancarRepasses(ofertaId: string) {
  if (um('SELECT 1 FROM lancamentos WHERE oferta_id = ? LIMIT 1', ofertaId)) return 0;
  const o = um<{ id: string; campanhaId: string; igrejaId: string; valor: number; divisaoJson: string; status: string }>(
    'SELECT id, campanha_id, igreja_id, valor, divisao_json, status FROM ofertas WHERE id = ?',
    ofertaId,
  );
  if (!o || o.status !== 'paga') return 0;
  const igreja = um<{ semeadorId: string | null }>('SELECT semeador_id FROM igrejas WHERE id = ?', o.igrejaId);
  const semeador = igreja?.semeadorId
    ? um<{ id: string; paiId: string | null }>('SELECT id, pai_id FROM semeadores WHERE id = ?', igreja.semeadorId)
    : undefined;
  const campanha = um<{ parceiroId: string | null }>('SELECT parceiro_id FROM campanhas WHERE id = ?', o.campanhaId);

  const quem = (tipo: TipoDivisao): { tipo: TipoBeneficiario; id: string | null } => {
    switch (tipo) {
      case 'igreja':
        return { tipo: 'igreja', id: o.igrejaId };
      case 'semeador_n2':
        return semeador?.paiId ? { tipo: 'semeador', id: semeador.id } : { tipo: 'plataforma', id: null };
      case 'semeador_n1':
        // Igreja de um N2: o N1 é quem trouxe o N2. Igreja de um N1: o próprio N1.
        if (semeador?.paiId) return { tipo: 'semeador', id: semeador.paiId };
        return semeador ? { tipo: 'semeador', id: semeador.id } : { tipo: 'plataforma', id: null };
      case 'parceiro':
        return campanha?.parceiroId ? { tipo: 'parceiro', id: campanha.parceiroId } : { tipo: 'plataforma', id: null };
      default:
        return { tipo: 'plataforma', id: null };
    }
  };

  const itens = comTipos(JSON.parse(o.divisaoJson) as ItemDivisao[]);
  const valores = itens.map((i) => Math.floor(o.valor * i.percentual) / 100);
  const sobra = Math.round((o.valor - valores.reduce((s, v) => s + v, 0)) * 100) / 100;
  let idxPlataforma = itens.findIndex((i) => i.tipo === 'plataforma');
  if (idxPlataforma < 0) idxPlataforma = valores.length - 1;
  valores[idxPlataforma] = Math.round((valores[idxPlataforma] + sobra) * 100) / 100;

  itens.forEach((i, k) => {
    if (valores[k] <= 0) return;
    const b = quem(i.tipo);
    inserir('lancamentos', {
      id: novoId(), ofertaId: o.id, campanhaId: o.campanhaId, beneficiarioTipo: b.tipo, beneficiarioId: b.id,
      papel: b.tipo === 'plataforma' && i.tipo !== 'plataforma' ? `${i.rotulo} (sem beneficiário: plataforma)` : i.rotulo,
      percentual: i.percentual, valor: valores[k], status: 'a_pagar',
    });
  });
  return itens.length;
}

/** Cria os lançamentos que faltam para ofertas pagas antigas (roda na inicialização). */
export function completarLancamentos() {
  const faltando = todos<{ id: string }>(
    "SELECT o.id FROM ofertas o WHERE o.status = 'paga' AND NOT EXISTS (SELECT 1 FROM lancamentos l WHERE l.oferta_id = o.id)",
  );
  for (const f of faltando) lancarRepasses(f.id);
  return faltando.length;
}

/** Saldo de um beneficiário: a receber, já recebido e total. */
export function saldo(tipo: TipoBeneficiario, id: string | null) {
  const r = um<{ aPagar: number; pago: number }>(
    `SELECT COALESCE(SUM(CASE WHEN status = 'a_pagar' THEN valor END), 0) AS a_pagar,
            COALESCE(SUM(CASE WHEN status = 'pago' THEN valor END), 0) AS pago
       FROM lancamentos WHERE beneficiario_tipo = ? AND beneficiario_id IS ?`,
    tipo, id,
  )!;
  const arred = (v: number) => Math.round(v * 100) / 100;
  return { aReceber: arred(r.aPagar), recebido: arred(r.pago), total: arred(r.aPagar + r.pago) };
}

/** Movimentações de um beneficiário (sem dados de quem ofertou). */
export function movimentacoes(tipo: TipoBeneficiario, id: string | null, limite = 50) {
  return todos(
    `SELECT l.id, l.papel, l.percentual, l.valor, l.status, l.criado_em, l.pago_em, c.edicao AS campanha, i.nome_fantasia AS igreja
       FROM lancamentos l JOIN ofertas o ON o.id = l.oferta_id JOIN igrejas i ON i.id = o.igreja_id JOIN campanhas c ON c.id = l.campanha_id
      WHERE l.beneficiario_tipo = ? AND l.beneficiario_id IS ?
      ORDER BY l.criado_em DESC LIMIT ?`,
    tipo, id, limite,
  );
}

/**
 * Registra que a equipe PAGOU (por fora do sistema) o saldo a receber de um beneficiário.
 * Só marca os lançamentos como pagos e guarda a referência (ex.: id do comprovante). Não transfere nada.
 */
export function registrarPagamento(p: { tipo: TipoBeneficiario; id: string | null; referencia: string; observacao: string; adminNome: string }) {
  const s = saldo(p.tipo, p.id);
  if (s.aReceber <= 0) return null;
  const pagamentoId = novoId();
  inserir('pagamentos_repasse', {
    id: pagamentoId, beneficiarioTipo: p.tipo, beneficiarioId: p.id, valor: s.aReceber,
    referencia: p.referencia, observacao: p.observacao, adminNome: p.adminNome,
  });
  executar(
    `UPDATE lancamentos SET status = 'pago', pagamento_id = ?, pago_em = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE beneficiario_tipo = ? AND beneficiario_id IS ? AND status = 'a_pagar'`,
    pagamentoId, p.tipo, p.id,
  );
  return { pagamentoId, valor: s.aReceber };
}
