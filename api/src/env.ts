import { existsSync } from 'node:fs';

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
};

if (!env.dev && (env.jwtSegredo === 'troque-este-segredo-em-producao' || env.jwtSegredo.length < 32)) {
  throw new Error('Defina JWT_SEGREDO no .env (32+ caracteres aleatórios) antes de rodar em produção.');
}
if (!env.dev && env.webhookSegredo.length < 24) {
  throw new Error('Defina WEBHOOK_SEGREDO no .env (24+ caracteres aleatórios) antes de rodar em produção.');
}
if (env.dev) console.warn('⚠ API em MODO DE TESTE: código de login 123456 e pagamento simulado. Nunca use assim em produção.');
