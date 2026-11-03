// Testes do PIX direto no banco (Inter e Efí) contra servidores falsos locais que imitam a API Pix de cada um
// (token, cobrança, consulta). Não usa contas reais nem a internet.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

let ok = 0, falhas = 0;
const conferir = (n: string, c: unknown, x = '') => { c ? ok++ : falhas++; console.log(`${c ? 'OK  ' : 'FALHOU'} ${n}${x ? ` (${x})` : ''}`); };

type Banco = { nome: 'inter' | 'efi'; prefixo: string; token: string; pix: string };
const BANCOS: Banco[] = [
  { nome: 'inter', prefixo: 'INTER', token: '/oauth/v2/token', pix: '/pix/v2' },
  { nome: 'efi', prefixo: 'EFI', token: '/oauth/token', pix: '/v2' },
];

/** Banco falso: guarda as cobranças e registra como o sistema se autenticou. */
async function bancoFalso(b: Banco) {
  const estado = { cobrancas: new Map<string, { status: string; valor: string; chave: string; expiracao: number }>(), tokens: 0, login: '', conta: '' };
  const servidor = createServer((req, res) => {
    let corpo = '';
    req.on('data', (p) => (corpo += p));
    req.on('end', () => {
      const responder = (status: number, dados: unknown) => (res.writeHead(status, { 'Content-Type': 'application/json' }), res.end(JSON.stringify(dados)));
      if (req.url === b.token && req.method === 'POST') {
        estado.tokens++;
        if (b.nome === 'inter') {
          // Inter: formulário com client_id, client_secret, grant_type e escopos.
          const f = new URLSearchParams(corpo);
          estado.login = `${req.headers['content-type']}|${f.get('client_id')}|${f.get('client_secret')}|${f.get('grant_type')}|${f.get('scope')}`;
        } else {
          estado.login = `${req.headers.authorization}|${JSON.parse(corpo).grant_type}`;
        }
        return responder(200, { access_token: 'tok-falso', token_type: 'Bearer', expires_in: 3600 });
      }
      if (req.headers.authorization !== 'Bearer tok-falso') return responder(401, { title: 'Não autorizado' });
      estado.conta = String(req.headers['x-conta-corrente'] ?? '');
      const m = req.url?.match(new RegExp(`^${b.pix}/cob/(\\w+)$`));
      if (m && req.method === 'PUT') {
        const json = JSON.parse(corpo);
        if (json.valor.original === '0.00') return responder(400, { title: 'Cobrança inválida', detail: 'valor_invalido' });
        estado.cobrancas.set(m[1], { status: 'ATIVA', valor: json.valor.original, chave: json.chave, expiracao: json.calendario.expiracao });
        return responder(201, { txid: m[1], status: 'ATIVA', pixCopiaECola: `00020101021226830014BR.GOV.BCB.PIX${m[1]}`, valor: json.valor });
      }
      if (m && req.method === 'GET') {
        const c = estado.cobrancas.get(m[1]);
        return c ? responder(200, { txid: m[1], status: c.status, valor: { original: c.valor } }) : responder(404, { title: 'Cobrança não encontrada' });
      }
      responder(404, {});
    });
  });
  await new Promise<void>((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  return { estado, servidor, url: `http://127.0.0.1:${(servidor.address() as AddressInfo).port}` };
}

const SEGREDO = 'segredo-do-aviso-com-24-caracteres';
for (const b of BANCOS) {
  const falso = await bancoFalso(b);
  Object.assign(process.env, {
    [`${b.prefixo}_URL`]: falso.url, [`${b.prefixo}_CLIENT_ID`]: 'id-teste', [`${b.prefixo}_CLIENT_SECRET`]: 'segredo-teste',
    [`${b.prefixo}_CHAVE_PIX`]: 'chave-da-conta@exemplo.com', WEBHOOK_SEGREDO: SEGREDO,
    ...(b.nome === 'inter' ? { INTER_CONTA: '123456' } : {}),
  });
  const modulo = await import('../compartilhado/src/pix-bacen.ts');
  modulo._reiniciarPix();
  const p = modulo[b.nome];
  const nome = b.nome === 'inter' ? 'Inter' : 'Efí';

  const txidA = `${b.nome}`.padEnd(32, 'a'), txidB = `${b.nome}`.padEnd(32, 'b');
  const base = { valor: 60, descricao: 'Oferta Edição 2026 - Igreja Teste', expiraEmMin: 30, divisao: [], igreja: { id: 'x', nome: 'Igreja Teste' } };
  const cA = await p.criarCobranca({ ...base, txid: txidA });
  await p.criarCobranca({ ...base, txid: txidB });
  conferir(`${nome}: cria a cobrança e devolve o copia e cola`, cA.copiaECola.includes(txidA) && cA.idNoGateway === txidA);
  const gravada = falso.estado.cobrancas.get(txidA)!;
  conferir(`${nome}: cobrança com valor, chave e validade certos`, gravada.valor === '60.00' && gravada.chave === 'chave-da-conta@exemplo.com' && gravada.expiracao === 1800);
  if (b.nome === 'inter') {
    conferir('Inter: login em formulário com as credenciais e os escopos do PIX',
      falso.estado.login === 'application/x-www-form-urlencoded|id-teste|segredo-teste|client_credentials|cob.write cob.read webhook.write webhook.read', falso.estado.login);
    conferir('Inter: envia a conta corrente quando configurada (x-conta-corrente)', falso.estado.conta === '123456');
  } else {
    conferir('Efí: login com client_id:client_secret (Basic)', falso.estado.login === `Basic ${Buffer.from('id-teste:segredo-teste').toString('base64')}|client_credentials`);
  }
  conferir(`${nome}: token reaproveitado entre cobranças (1 login só)`, falso.estado.tokens === 1);
  let erro: any = null;
  try { await p.criarCobranca({ ...base, valor: 0, txid: 'c'.repeat(32) }); } catch (e) { erro = e; }
  conferir(`${nome}: recusa do banco vira mensagem amigável (sem detalhes internos)`, erro?.status === 502 && !/valor_invalido/.test(erro.message));

  // Aviso de pagamento: o Inter manda a lista direta; o padrão do Banco Central (Efí) manda { pix: [...] }.
  const aviso = (segredo: string, pix: unknown) => ({ params: { segredo }, query: {}, body: b.nome === 'inter' ? pix : { pix } }) as any;
  erro = null;
  try { await p.lerWebhook(aviso('errado', [{ txid: txidB }])); } catch (e) { erro = e; }
  conferir(`${nome}: SEGURANÇA: aviso sem o segredo certo é recusado`, erro?.status === 401);
  falso.estado.cobrancas.get(txidB)!.status = 'CONCLUIDA';
  const pagos = await p.lerWebhook(aviso(SEGREDO, [{ txid: txidA }, { txid: txidB }, { txid: 'curto' }, { txid: 'z'.repeat(32) }]));
  conferir(`${nome}: SEGURANÇA: só confirma cobrança que o banco diz estar CONCLUIDA (aviso falso não libera nada)`,
    pagos.length === 1 && pagos[0].txid === txidB, JSON.stringify(pagos));
  conferir(`${nome}: aviso de teste do banco (sem lista de PIX) não quebra`, (await p.lerWebhook({ params: { segredo: SEGREDO }, query: {}, body: {} } as any)).length === 0);
  falso.servidor.close();
}

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
