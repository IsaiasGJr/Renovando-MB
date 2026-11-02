/**
 * Gateway PIX da Efí (antiga Gerencianet), pela API Pix oficial: https://dev.efipay.com.br/docs/api-pix
 *
 * Por que a Efí: a cobrança PIX não exige CPF nem e-mail de quem paga (combina com as ofertas anônimas
 * e com o cadastro só por WhatsApp). Toda chamada usa o certificado da conta (mTLS), como a Efí exige.
 *
 * .env da API:
 *   PIX_PROVEDOR=efi
 *   EFI_CLIENT_ID, EFI_CLIENT_SECRET   credenciais da aplicação (painel da Efí → API)
 *   EFI_CERTIFICADO=/caminho/cert.p12  certificado da conta (homologação e produção têm certificados diferentes)
 *   EFI_CHAVE_PIX                      chave PIX da conta que recebe as ofertas
 *   EFI_HOMOLOGACAO=1                  usa o ambiente de testes da Efí (opcional)
 *   WEBHOOK_SEGREDO                    vai na URL do aviso de pagamento (?segredo=...)
 *
 * Segurança do aviso de pagamento: além de conferir o segredo da URL, o sistema CONSULTA a cobrança
 * na Efí e só confirma a oferta se ela estiver CONCLUIDA. Um aviso falso nunca libera cupons.
 */
import { readFileSync } from 'node:fs';
import { request as httpsRequest, Agent } from 'node:https';
import { request as httpRequest } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { ErroHttp } from './util.ts';
import type { ProvedorPix } from './pagamentos.ts';

const PRODUCAO = 'https://pix.api.efipay.com.br';
const HOMOLOGACAO = 'https://pix-h.api.efipay.com.br';

type Config = { url: string; clientId: string; clientSecret: string; chave: string; agente?: Agent };

let config: Config | null = null;
function lerConfig(): Config {
  if (config) return config;
  const e = process.env;
  const faltando = ['EFI_CLIENT_ID', 'EFI_CLIENT_SECRET', 'EFI_CHAVE_PIX'].filter((k) => !e[k]);
  // EFI_URL só existe para os testes automáticos (servidor falso local, sem certificado).
  const url = e.EFI_URL ?? (e.EFI_HOMOLOGACAO === '1' ? HOMOLOGACAO : PRODUCAO);
  if (!e.EFI_URL && !e.EFI_CERTIFICADO) faltando.push('EFI_CERTIFICADO');
  if (faltando.length) throw new Error(`PIX da Efí: falta configurar ${faltando.join(', ')} no .env da API.`);
  config = {
    url, clientId: e.EFI_CLIENT_ID!, clientSecret: e.EFI_CLIENT_SECRET!, chave: e.EFI_CHAVE_PIX!,
    agente: e.EFI_CERTIFICADO ? new Agent({ pfx: readFileSync(e.EFI_CERTIFICADO), passphrase: e.EFI_CERTIFICADO_SENHA ?? '', keepAlive: true }) : undefined,
  };
  return config;
}

/** Chamada à API da Efí (JSON), com o certificado da conta. */
function chamar<T>(metodo: string, caminho: string, corpo: unknown, cabecalhos: Record<string, string>): Promise<{ status: number; dados: T }> {
  const c = lerConfig();
  const alvo = new URL(caminho, c.url);
  const texto = corpo === undefined ? undefined : JSON.stringify(corpo);
  const fazer = alvo.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((ok, falha) => {
    const req = fazer(alvo, {
      method: metodo, agent: alvo.protocol === 'https:' ? c.agente : undefined, timeout: 20_000,
      headers: { 'Content-Type': 'application/json', ...(texto ? { 'Content-Length': Buffer.byteLength(texto) } : {}), ...cabecalhos },
    }, (res) => {
      let bruto = '';
      res.setEncoding('utf8');
      res.on('data', (p) => (bruto += p));
      res.on('end', () => {
        let dados: unknown = bruto;
        try { dados = bruto ? JSON.parse(bruto) : {}; } catch { /* resposta sem JSON */ }
        ok({ status: res.statusCode ?? 0, dados: dados as T });
      });
    });
    req.on('timeout', () => req.destroy(new Error('A Efí demorou para responder.')));
    req.on('error', falha);
    if (texto) req.write(texto);
    req.end();
  });
}

// O token vale 1 hora: guarda e renova um pouco antes de vencer.
let token: { valor: string; venceEm: number } | null = null;
async function tokenDeAcesso() {
  if (token && token.venceEm > Date.now()) return token.valor;
  const c = lerConfig();
  const basico = Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64');
  const r = await chamar<{ access_token?: string; expires_in?: number }>('POST', '/oauth/token', { grant_type: 'client_credentials' }, { Authorization: `Basic ${basico}` });
  if (r.status !== 200 || !r.dados.access_token) throw new Error(`Efí recusou as credenciais (HTTP ${r.status}).`);
  token = { valor: r.dados.access_token, venceEm: Date.now() + ((r.dados.expires_in ?? 3600) - 120) * 1000 };
  return token.valor;
}

async function api<T>(metodo: string, caminho: string, corpo?: unknown, extras: Record<string, string> = {}) {
  const r = await chamar<T>(metodo, caminho, corpo, { Authorization: `Bearer ${await tokenDeAcesso()}`, ...extras });
  if (r.status === 401) token = null; // token revogado: o próximo pedido pega outro
  return r;
}

type Cob = { txid: string; status: string; pixCopiaECola?: string; valor?: { original: string } };

/** Confere o segredo do aviso (?segredo=...) sem vazar tempo de comparação. */
function segredoConfere(req: Request) {
  const esperado = Buffer.from(process.env.WEBHOOK_SEGREDO ?? '');
  const recebido = Buffer.from(String(req.query.segredo ?? ''));
  return esperado.length >= 24 && recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export const efi: ProvedorPix = {
  nome: 'efi',
  async criarCobranca(c) {
    const r = await api<Cob & { mensagem?: string }>('PUT', `/v2/cob/${c.txid}`, {
      calendario: { expiracao: c.expiraEmMin * 60 },
      valor: { original: c.valor.toFixed(2) },
      chave: lerConfig().chave,
      solicitacaoPagador: c.descricao.slice(0, 140),
    });
    if (r.status !== 201 || !r.dados.pixCopiaECola) {
      console.error('[pix efi] falha ao criar cobrança', r.status, JSON.stringify(r.dados).slice(0, 300));
      throw new ErroHttp(502, 'Não foi possível gerar o PIX agora. Tente de novo em instantes.');
    }
    return { copiaECola: r.dados.pixCopiaECola, idNoGateway: r.dados.txid };
  },
  async lerWebhook(req) {
    if (!segredoConfere(req)) throw new ErroHttp(401, 'Assinatura inválida.');
    const itens = (req.body as { pix?: { txid?: unknown }[] })?.pix;
    if (!Array.isArray(itens)) return []; // aviso de teste da Efí (ao cadastrar o webhook)
    const pagos: { txid: string }[] = [];
    for (const item of itens) {
      if (typeof item.txid !== 'string' || !/^[a-zA-Z0-9]{26,35}$/.test(item.txid)) continue;
      // Não confia no aviso: pergunta à Efí se a cobrança foi mesmo paga.
      const r = await api<Cob>('GET', `/v2/cob/${item.txid}`);
      if (r.status === 200 && r.dados.status === 'CONCLUIDA') pagos.push({ txid: item.txid });
    }
    return pagos;
  },
};

/** Cadastra na Efí o endereço do aviso de pagamento (rodar uma vez: npm run efi-webhook -w renovando-api). */
export async function cadastrarWebhookEfi(urlPublicaApi: string) {
  const segredo = process.env.WEBHOOK_SEGREDO ?? '';
  if (segredo.length < 24) throw new Error('Defina WEBHOOK_SEGREDO (24+ caracteres) no .env da API.');
  // "ignorar=" evita que a Efí acrescente "/pix" ao endereço. O segredo vai na URL; a confirmação real
  // é a consulta da cobrança (ver lerWebhook). "x-skip-mtls-checking" dispensa o mTLS no nosso servidor.
  const webhookUrl = `${urlPublicaApi.replace(/\/$/, '')}/api/webhooks/pix?segredo=${encodeURIComponent(segredo)}&ignorar=`;
  const r = await api('PUT', `/v2/webhook/${encodeURIComponent(lerConfig().chave)}`, { webhookUrl }, { 'x-skip-mtls-checking': 'true' });
  return { status: r.status, dados: r.dados, webhookUrl: webhookUrl.replace(encodeURIComponent(segredo), '***') };
}

/** Confere a configuração ao iniciar a API (erro claro antes da primeira oferta, não durante). */
export function conferirConfigEfi() {
  lerConfig();
}

/** Só para os testes: esquece a configuração e o token guardados. */
export function _reiniciarEfi() {
  config = null;
  token = null;
}
