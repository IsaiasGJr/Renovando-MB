// Testes das contas de demonstração (testadores de fora e revisores das lojas): só os números autorizados,
// só com um código forte, e o servidor recusa subir com configuração fraca.
let ok = 0, falhas = 0;
const conferir = (n: string, c: unknown, x = '') => { c ? ok++ : falhas++; console.log(`${c ? 'OK  ' : 'FALHOU'} ${n}${x ? ` (${x})` : ''}`); };
const { codigoDemonstracao, conferirDemonstracao } = await import('../compartilhado/src/demonstracao.ts');
const recusa = (fn: () => void) => { try { fn(); return false; } catch { return true; } };
const avisos = console.warn;
console.warn = () => {};

process.env.CONTAS_DEMONSTRACAO = '63900000001, 55 63 90000-0002';
process.env.CODIGO_DEMONSTRACAO = '482915';
conferir('Número autorizado recebe o código fixo', codigoDemonstracao('63900000001') === '482915');
conferir('Aceita o número com 55 e com máscara na configuração', codigoDemonstracao('63900000002') === '482915');
conferir('SEGURANÇA: número fora da lista segue o WhatsApp normal', codigoDemonstracao('63999999999') === null);
conferir('Configuração boa sobe o servidor', !recusa(conferirDemonstracao));
for (const fraco of ['123456', '000000', '111111', '654321', '12345', 'abcdef']) {
  process.env.CODIGO_DEMONSTRACAO = fraco;
  if (!recusa(conferirDemonstracao) || codigoDemonstracao('63900000001') !== null) conferir(`SEGURANÇA: código fraco "${fraco}" recusado`, false);
}
conferir('SEGURANÇA: código fraco ou óbvio é recusado (123456, 000000, 111111, 654321, curto, letras)', true);
process.env.CODIGO_DEMONSTRACAO = '482915';
process.env.CONTAS_DEMONSTRACAO = '6390000';
conferir('Número incompleto na lista impede o servidor de subir', recusa(conferirDemonstracao));
process.env.CONTAS_DEMONSTRACAO = '';
conferir('Sem contas configuradas, nada muda', !recusa(conferirDemonstracao) && codigoDemonstracao('63900000001') === null);

console.warn = avisos;
console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
