import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

if (existsSync('.env')) process.loadEnvFile('.env');

export const env = {
  porta: Number(process.env.PORTA ?? 4000),
  // Segredo próprio do admin: um token do app nunca serve aqui, e vice-versa.
  jwtSegredo: process.env.JWT_SEGREDO ?? 'troque-este-segredo-do-admin',
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@renovando.local',
  adminSenha: process.env.ADMIN_SENHA ?? 'renovando2026',
  // Modo de desenvolvimento só quando pedido EXPLICITAMENTE no .env.
  dev: process.env.NODE_ENV === 'development',
  /** Atrás de um proxy (Nginx, Cloudflare...), defina TRUST_PROXY=1 para o limite por IP funcionar. */
  trustProxy: process.env.TRUST_PROXY === '1',
  /** Build do painel (admin/painel/dist), servido por este mesmo servidor em produção. */
  pastaPainel: process.env.PAINEL_DIST ?? fileURLToPath(new URL('../../painel/dist/', import.meta.url)),
};

if (!env.dev && (env.jwtSegredo === 'troque-este-segredo-do-admin' || env.jwtSegredo.length < 32)) {
  throw new Error('Defina JWT_SEGREDO no .env do admin (32+ caracteres aleatórios) antes de rodar em produção.');
}
if (!env.dev && env.adminSenha === 'renovando2026') {
  throw new Error('Defina uma ADMIN_SENHA própria no .env do admin antes de rodar em produção.');
}
