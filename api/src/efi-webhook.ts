// Cadastra na Efí o endereço que recebe o aviso de pagamento do PIX. Rodar uma vez, já no servidor:
//   docker compose exec api npm run efi-webhook -w renovando-api
import { cadastrarWebhookEfi } from '../../compartilhado/src/pix-efi.ts';
import { env } from './env.ts';

if (!env.urlPublica.startsWith('https://')) throw new Error('Defina URL_PUBLICA (https://...) no .env da API.');
const r = await cadastrarWebhookEfi(env.urlPublica);
console.log(r.status === 200 ? `Aviso de pagamento cadastrado: ${r.webhookUrl}` : `A Efí recusou (HTTP ${r.status}): ${JSON.stringify(r.dados)}`);
process.exit(r.status === 200 ? 0 : 1);
