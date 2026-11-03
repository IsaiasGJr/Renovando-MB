import { existsSync } from 'node:fs';
import { conferirDemonstracao } from '../../compartilhado/src/demonstracao.ts';
import { conferirConfigPix } from '../../compartilhado/src/pix-bacen.ts';

if (existsSync('.env')) process.loadEnvFile('.env');

export const env = {
  porta: Number(process.env.PORTA ?? 3333),
  jwtSegredo: process.env.JWT_SEGREDO ?? 'troque-este-segredo-em-producao',
  webhookSegredo: process.env.WEBHOOK_SEGREDO ?? '',
  // Modo de teste (código 123456, simular pagamento) só quando pedido EXPLICITAMENTE.
  // Se o .env faltar ou estiver incompleto, o servidor roda como produção.
  dev: process.env.NODE_ENV === 'development',
  /** Atrás de um proxy (Nginx, Cloudflare, Render...), defina TRUST_PROXY=1 para o limite por IP funcionar. */
  trustProxy: process.env.TRUST_PROXY === '1',
  /** Endereço público da API (ex.: https://api.renovandoavinhadosenhor.com): vai no QR Code dos panfletos. */
  urlPublica: process.env.URL_PUBLICA ?? '',
  /** Homologação: botão "Simular pagamento" no app, sem PIX de verdade. Nunca no endereço oficial. */
  pagamentoSimulado: process.env.PAGAMENTO_SIMULADO === '1',
};

if (!env.dev && (env.jwtSegredo === 'troque-este-segredo-em-producao' || env.jwtSegredo.length < 32)) {
  throw new Error('Defina JWT_SEGREDO no .env (32+ caracteres aleatórios) antes de rodar em produção.');
}
if (!env.dev && env.webhookSegredo.length < 24) {
  throw new Error('Defina WEBHOOK_SEGREDO no .env (24+ caracteres aleatórios) antes de rodar em produção.');
}
if (!env.dev && !(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_NUMERO_ID)) {
  console.warn('⚠ WHATSAPP_TOKEN/WHATSAPP_NUMERO_ID não configurados: ninguém consegue entrar no app (o código não é enviado).');
}
if (env.pagamentoSimulado && !env.dev) {
  if (/^https:\/\/api\.renovandoavinhadosenhor\.com\/?$/.test(env.urlPublica)) {
    throw new Error('PAGAMENTO_SIMULADO=1 não pode ser usado no endereço oficial de produção (cupons sem pagamento).');
  }
  console.warn('⚠ HOMOLOGAÇÃO: pagamento SIMULADO ligado (nenhum PIX de verdade). Não use com ofertantes reais.');
}
conferirDemonstracao();
if (process.env.PIX_PROVEDOR === 'inter' || process.env.PIX_PROVEDOR === 'efi') conferirConfigPix(process.env.PIX_PROVEDOR);
if (env.dev) console.warn('⚠ API em MODO DE TESTE: código de login 123456 e pagamento simulado. Nunca use assim em produção.');
