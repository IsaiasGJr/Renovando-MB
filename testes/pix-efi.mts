// Testes do gateway PIX da Efí contra um servidor falso local (imita a API Pix da Efí: token, cobrança, consulta).
// Não usa a conta real nem a internet.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

let ok = 0, falhas = 0;
const conferir = (n: string, c: unknown, x = '') => { c ? ok++ : falhas++; console.log(`${c ? 'OK  ' : 'FALHOU'} ${n}${x ? ` (${x})` : ''}`); };

// ---------- Efí falsa ----------
const cobrancas = new Map<string, { status: string; valor: string; chave: string; expiracao: number }>();
let pedidosDeToken = 0;
let ultimoBasic = '';
const servidor = createServer((req, res) => {
  let corpo = '';
  req.on('data', (p) => (corpo += p));
  req.on('end', () => {
    const json = corpo ? JSON.parse(corpo) : {};
    const responder = (status: number, dados: unknown) => (res.writeHead(status, { 'Content-Type': 'application/json' }), res.end(JSON.stringify(dados)));
    if (req.url === '/oauth/token' && req.method === 'POST') {
      pedidosDeToken++;
      ultimoBasic = req.headers.authorization ?? '';
      return json.grant_type === 'client_credentials' ? responder(200, { access_token: 'tok-falso', token_type: 'Bearer', expires_in: 3600 }) : responder(400, {});
    }
    if (req.headers.authorization !== 'Bearer tok-falso') return responder(401, { nome: 'nao_autorizado' });
    const m = req.url?.match(/^\/v2\/cob\/(\w+)$/);
    if (m && req.method === 'PUT') {
      if (json.valor.original === '0.00') return responder(400, { nome: 'valor_invalido' });
      cobrancas.set(m[1], { status: 'ATIVA', valor: json.valor.original, chave: json.chave, expiracao: json.calendario.expiracao });
      return responder(201, { txid: m[1], status: 'ATIVA', pixCopiaECola: `00020101021226830014BR.GOV.BCB.PIX${m[1]}`, valor: json.valor });
    }
    if (m && req.method === 'GET') {
      const c = cobrancas.get(m[1]);
      return c ? responder(200, { txid: m[1], status: c.status, valor: { original: c.valor } }) : responder(404, { nome: 'cobranca_nao_encontrada' });
    }
    responder(404, {});
  });
});
await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
const porta = (servidor.address() as AddressInfo).port;

Object.assign(process.env, {
  EFI_URL: `http://127.0.0.1:${porta}`, EFI_CLIENT_ID: 'id-teste', EFI_CLIENT_SECRET: 'segredo-teste',
  EFI_CHAVE_PIX: 'chave-da-conta@exemplo.com', WEBHOOK_SEGREDO: 'segredo-do-aviso-com-24-caracteres',
});
const { efi, _reiniciarEfi } = await import('../compartilhado/src/pix-efi.ts');
_reiniciarEfi();

// ---------- Cobrança ----------
const txidA = 'a'.repeat(32), txidB = 'b'.repeat(32);
const base = { valor: 60, descricao: 'Oferta Edição 2026 - Igreja Teste', expiraEmMin: 30, divisao: [], igreja: { id: 'x', nome: 'Igreja Teste' } };
const cA = await efi.criarCobranca({ ...base, txid: txidA });
await efi.criarCobranca({ ...base, txid: txidB });
conferir('Cria a cobrança e devolve o copia e cola', cA.copiaECola.includes(txidA) && cA.idNoGateway === txidA);
const gravada = cobrancas.get(txidA)!;
conferir('Cobrança com valor, chave e validade certos', gravada.valor === '60.00' && gravada.chave === 'chave-da-conta@exemplo.com' && gravada.expiracao === 1800);
conferir('Login na Efí com client_id:client_secret (Basic)', ultimoBasic === `Basic ${Buffer.from('id-teste:segredo-teste').toString('base64')}`);
conferir('Token reaproveitado entre cobranças (1 pedido só)', pedidosDeToken === 1);
let erro: any = null;
try { await efi.criarCobranca({ ...base, valor: 0, txid: 'c'.repeat(32) }); } catch (e) { erro = e; }
conferir('Recusa da Efí vira mensagem amigável (sem detalhes internos)', erro?.status === 502 && !/valor_invalido/.test(erro.message));

// ---------- Aviso de pagamento ----------
const aviso = (segredo: string, pix: unknown) => ({ query: { segredo }, body: { pix } }) as any;
erro = null;
try { await efi.lerWebhook(aviso('errado', [{ txid: txidB }])); } catch (e) { erro = e; }
conferir('SEGURANÇA: aviso sem o segredo certo é recusado', erro?.status === 401);
cobrancas.get(txidB)!.status = 'CONCLUIDA';
const pagos = await efi.lerWebhook(aviso('segredo-do-aviso-com-24-caracteres', [{ txid: txidA }, { txid: txidB }, { txid: 'curto' }, { txid: 'z'.repeat(32) }]));
conferir('Só confirma cobrança que a Efí diz estar CONCLUIDA', pagos.length === 1 && pagos[0].txid === txidB, JSON.stringify(pagos));
conferir('SEGURANÇA: aviso falso de cobrança não paga não libera nada', !pagos.some((p) => p.txid === txidA));
conferir('Aviso de teste da Efí (sem lista de PIX) não quebra', (await efi.lerWebhook(aviso('segredo-do-aviso-com-24-caracteres', undefined))).length === 0);

servidor.close();
console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
