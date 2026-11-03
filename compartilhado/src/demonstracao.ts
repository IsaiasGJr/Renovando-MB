/**
 * Contas de demonstração: números autorizados que entram com um código FIXO e secreto, sem WhatsApp.
 * Servem para testadores de fora (ambiente de homologação) e para os revisores da Apple e do Google,
 * que pedem um login de demonstração e não recebem o código no WhatsApp.
 *
 * .env da API e do admin (os dois iguais):
 *   CONTAS_DEMONSTRACAO=63900000001,63900000002   celulares com DDD, separados por vírgula
 *   CODIGO_DEMONSTRACAO=482915                    6 dígitos escolhidos por você (não use 123456, 000000...)
 *
 * Só esses números entram assim; os demais continuam recebendo o código pelo WhatsApp. Limites de
 * tentativas, auditoria e tudo o mais valem igual. Deixe vazio quando não houver testes em andamento.
 */
const FRACOS = /^(\d)\1{5}$|^(012345|123456|234567|345678|456789|987654|654321|121212|112233)$/;

function lerConfig() {
  const numeros = (process.env.CONTAS_DEMONSTRACAO ?? '').split(',').map((n) => n.replace(/\D/g, '').replace(/^55(?=\d{11}$)/, '')).filter(Boolean);
  const codigo = (process.env.CODIGO_DEMONSTRACAO ?? '').trim();
  return { numeros, codigo };
}

/** Confere a configuração ao iniciar o servidor: erro claro em vez de uma porta aberta mal configurada. */
export function conferirDemonstracao() {
  const { numeros, codigo } = lerConfig();
  if (!numeros.length) return;
  if (numeros.some((n) => n.length !== 11)) throw new Error('CONTAS_DEMONSTRACAO: cada número precisa ter DDD + celular (11 dígitos).');
  if (!/^\d{6}$/.test(codigo) || FRACOS.test(codigo)) {
    throw new Error('CODIGO_DEMONSTRACAO precisa ter 6 dígitos e não pode ser óbvio (123456, 000000...).');
  }
  if (numeros.length > 10) throw new Error('CONTAS_DEMONSTRACAO: no máximo 10 números.');
  console.warn(`⚠ Contas de demonstração ATIVAS (${numeros.length} número(s)): entram com o código fixo, sem WhatsApp.`);
}

/** Código fixo deste número, se ele for uma conta de demonstração; senão, null (segue o WhatsApp normal). */
export function codigoDemonstracao(fone: string): string | null {
  const { numeros, codigo } = lerConfig();
  return numeros.includes(fone) && /^\d{6}$/.test(codigo) && !FRACOS.test(codigo) ? codigo : null;
}
