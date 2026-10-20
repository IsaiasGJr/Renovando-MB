/**
 * Cobrança PIX das ofertas: TODO gateway passa por aqui.
 *
 * Para ligar um gateway de verdade (Asaas, Efí, Mercado Pago, Pagar.me...), crie um "provedor"
 * com as duas funções abaixo e registre em PROVEDORES. O resto do sistema não muda:
 *   - criarCobranca: pede ao gateway o PIX e devolve o "copia e cola" (e a imagem do QR, se houver);
 *   - lerWebhook: confere a assinatura do aviso do gateway e diz qual cobrança foi paga.
 *
 * Escolha no .env da API: PIX_PROVEDOR=teste | desligado | <nome do gateway>.
 *   teste      cobrança fictícia + botão "Simular pagamento" (só com NODE_ENV=development)
 *   desligado  ofertas fechadas (padrão em produção até o gateway ser configurado)
 */
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { ErroHttp } from './util.ts';

export type NovaCobranca = {
  /** Identificador único da cobrança (vai no PIX e volta no aviso de pagamento). */
  txid: string;
  valor: number;
  descricao: string;
  expiraEmMin: number;
  /** Divisão da oferta (rótulo e percentual), para gateways com split. */
  divisao: { rotulo: string; percentual: number }[];
  igreja: { id: string; nome: string };
};

export type Cobranca = { copiaECola: string; qrCodeBase64?: string; idNoGateway?: string };

export type ProvedorPix = {
  nome: string;
  criarCobranca(c: NovaCobranca): Promise<Cobranca>;
  /** Retorna o txid (ou o id no gateway) da cobrança paga, ou null se o aviso não for de pagamento. Lança 401 se a assinatura não bater. */
  lerWebhook(req: Request): { txid?: string; idNoGateway?: string } | null;
};

/** Payload PIX de exemplo (não é um PIX válido). Só para desenvolvimento. */
const teste: ProvedorPix = {
  nome: 'teste',
  async criarCobranca(c) {
    return {
      copiaECola: `00020126580014BR.GOV.BCB.PIX0136${c.txid}5204000053039865406${c.valor.toFixed(2)}5802BR5909RENOVANDO6006PALMAS62070503***6304`,
    };
  },
  // Aviso de pagamento simples, assinado com WEBHOOK_SEGREDO no cabeçalho x-webhook-secret.
  lerWebhook(req) {
    const segredo = process.env.WEBHOOK_SEGREDO ?? '';
    const recebido = Buffer.from(String(req.headers['x-webhook-secret'] ?? ''));
    const esperado = Buffer.from(segredo);
    if (!segredo || recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) throw new ErroHttp(401, 'Assinatura inválida.');
    const txid = (req.body as { txid?: unknown })?.txid;
    return typeof txid === 'string' ? { txid } : null;
  },
};

const desligado: ProvedorPix = {
  nome: 'desligado',
  async criarCobranca() {
    throw new ErroHttp(503, 'As ofertas pelo app ainda não estão abertas. Em breve!');
  },
  lerWebhook() {
    throw new ErroHttp(404, 'Nenhum gateway de pagamento configurado.');
  },
};

const PROVEDORES: Record<string, ProvedorPix> = { teste, desligado };

/** Provedor escolhido no .env. Em produção, o provedor de teste nunca é usado. */
export function provedorPix(): ProvedorPix {
  const dev = process.env.NODE_ENV === 'development';
  const nome = process.env.PIX_PROVEDOR ?? (dev ? 'teste' : 'desligado');
  const p = PROVEDORES[nome];
  if (!p) throw new Error(`PIX_PROVEDOR="${nome}" não existe. Opções: ${Object.keys(PROVEDORES).join(', ')}.`);
  if (p === teste && !dev) return desligado;
  return p;
}
