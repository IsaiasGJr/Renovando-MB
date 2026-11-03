// Cadastra no banco (Inter ou Efí) o endereço que recebe o aviso de pagamento do PIX. Rodar uma vez, já no servidor:
//   docker compose exec api npm run pix-webhook -w renovando-api
import { cadastrarAvisoPix } from '../../compartilhado/src/pix-bacen.ts';
import { env } from './env.ts';

const banco = process.env.PIX_PROVEDOR ?? '';
if (banco !== 'inter' && banco !== 'efi') throw new Error('Defina PIX_PROVEDOR=inter (ou efi) no .env da API.');
if (!env.urlPublica.startsWith('https://')) throw new Error('Defina URL_PUBLICA (https://...) no .env da API.');
const r = await cadastrarAvisoPix(banco, env.urlPublica);
console.log(r.status === 200 || r.status === 201 || r.status === 204 ? `Aviso de pagamento cadastrado: ${r.webhookUrl}` : `O banco recusou (HTTP ${r.status}): ${JSON.stringify(r.dados)}`);
process.exit(r.status < 300 ? 0 : 1);
