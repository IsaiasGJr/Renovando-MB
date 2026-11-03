// Envia um código de teste pelo WhatsApp para conferir a configuração (token, número e modelo aprovado).
// Uso: npm run testar-whatsapp -w renovando-api -- 63999999999
// Funciona mesmo em desenvolvimento: lê WHATSAPP_TOKEN, WHATSAPP_NUMERO_ID e WHATSAPP_MODELO do api/.env.
import { existsSync } from 'node:fs';
import { randomInt } from 'node:crypto';

if (existsSync('.env')) process.loadEnvFile('.env');
const { enviarCodigoWhatsapp } = await import('../../compartilhado/src/whatsapp.ts');
const fone = (process.argv[2] ?? '').replace(/\D/g, '').replace(/^55(?=\d{11}$)/, '');
if (fone.length !== 11) {
  console.error('Informe o celular com DDD (11 dígitos). Ex.: npm run testar-whatsapp -w renovando-api -- 63999999999');
  process.exit(1);
}
const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
try {
  await enviarCodigoWhatsapp(fone, codigo);
  console.log(`Enviado! Confira o WhatsApp do número ${fone}: deve chegar o código ${codigo}.`);
} catch (e) {
  console.error(`Não enviou: ${(e as Error).message}`);
  console.error('Veja a linha "[whatsapp] falha ao enviar código" acima para o motivo dado pela Meta.');
  process.exit(1);
}
