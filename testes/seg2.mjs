// Testes da segunda rodada de segurança.
import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { apagarContas, apagarIgreja, igrejaTemporaria } from './_apoio.mjs';

const [envAdminPath, dadosDir] = process.argv.slice(2);
const envAdmin = Object.fromEntries(readFileSync(envAdminPath, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.trim().split(/=(.*)/s).slice(0, 2)));
const API = 'http://localhost:3333/api';
const ADM = 'http://localhost:4000/api';
let ok = 0, falhas = 0;
const conferir = (n, c, x = '') => { c ? ok++ : falhas++; console.log(`${c ? 'OK  ' : 'FALHOU'} ${n}${x ? ` (${x})` : ''}`); };
async function req(base, caminho, { method = 'GET', json, token } = {}) {
  const h = {};
  if (token) h.Authorization = `Bearer ${token}`;
  if (json !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(base + caminho, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : undefined });
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, dados: d };
}
const db = new DatabaseSync(`${dadosDir}/renovando.db`);

// 1. Backups sem criptografia
conferir('1. nenhum backup sem criptografia na pasta dados', !readdirSync(dadosDir).some((f) => f.startsWith('backup-antes-da-criptografia')));

// 2. Sessões do admin derrubadas ao trocar senha / papel / desativar
const tokAdm = (await req(ADM, '/login', { method: 'POST', json: { email: envAdmin.ADMIN_EMAIL, senha: envAdmin.ADMIN_SENHA } })).dados.token;
const email = `sessao.teste.${Date.now()}@renovando.local`;
let senha = randomBytes(18).toString('base64url');
const editor = (await req(ADM, '/admins', { method: 'POST', token: tokAdm, json: { nome: 'Teste de sessão', email, senha, papel: 'editor', ativo: true } })).dados;
const entrar = async () => (await req(ADM, '/login', { method: 'POST', json: { email, senha } })).dados.token;
let tokA = await entrar();
const tokB = await entrar();
conferir('2. editor logado em dois lugares', (await req(ADM, '/me', { token: tokA })).status === 200 && (await req(ADM, '/me', { token: tokB })).status === 200);
senha = randomBytes(18).toString('base64url');
await req(ADM, `/admins/${editor.id}`, { method: 'PUT', token: tokAdm, json: { senha } });
conferir('2. trocar a senha derruba TODAS as sessões abertas', (await req(ADM, '/me', { token: tokA })).status === 401 && (await req(ADM, '/me', { token: tokB })).status === 401);
tokA = await entrar();
conferir('2. a senha nova funciona', (await req(ADM, '/me', { token: tokA })).status === 200);
await req(ADM, `/admins/${editor.id}`, { method: 'PUT', token: tokAdm, json: { nome: 'Teste de sessão (renomeado)' } });
conferir('2. editar só o nome NÃO derruba a sessão', (await req(ADM, '/me', { token: tokA })).status === 200);
await req(ADM, `/admins/${editor.id}`, { method: 'PUT', token: tokAdm, json: { papel: 'admin' } });
conferir('2. mudar o papel derruba a sessão', (await req(ADM, '/me', { token: tokA })).status === 401);
await req(ADM, `/admins/${editor.id}`, { method: 'DELETE', token: tokAdm });

// 3. Exportação registrada
await fetch(`${ADM}/relatorios/ofertas.csv?status=paga`, { headers: { Authorization: `Bearer ${tokAdm}` } }).then((r) => r.text());
const exp = db.prepare("SELECT resumo, detalhes FROM auditoria WHERE acao = 'exportar' ORDER BY criado_em DESC").get();
conferir('3. exportação da planilha registrada na auditoria (com filtros)', exp && exp.resumo.startsWith('Planilha de ofertas') && exp.detalhes.includes('paga'));

// 4. Ofertante: login de 30 dias e "sair de todos os aparelhos"
const fone = `6388${String(Date.now()).slice(-7)}`;
const login = async () => {
  await req(API, '/auth/codigo', { method: 'POST', json: { whatsapp: fone } });
  return (await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: fone, codigo: '123456', nome: 'Sessao' } })).dados.token;
};
const t1 = await login();
const t2 = await login();
const corpo = JSON.parse(Buffer.from(t1.split('.')[1], 'base64url').toString());
conferir('4. login do ofertante vale 30 dias', corpo.exp - corpo.iat === 30 * 86400);
conferir('4. logado em dois aparelhos', (await req(API, '/me/cupons', { token: t1 })).status === 200 && (await req(API, '/me/cupons', { token: t2 })).status === 200);
await req(API, '/me/sair-de-todos', { method: 'POST', token: t1 });
conferir('4. "sair de todos" derruba os dois aparelhos', (await req(API, '/me/cupons', { token: t1 })).status === 401 && (await req(API, '/me/cupons', { token: t2 })).status === 401);
const t3 = (await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: fone, codigo: '000000' } })).status;
await new Promise((r) => setTimeout(r, 10));
const t4 = await (async () => {
  // terceiro código no mesmo número dentro de 15 min ainda é permitido (limite = 3)
  await req(API, '/auth/codigo', { method: 'POST', json: { whatsapp: fone } });
  return (await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: fone, codigo: '123456' } })).dados.token;
})();
conferir('4. depois de sair, entra de novo com código novo', t3 === 400 && (await req(API, '/me/cupons', { token: t4 })).status === 200);
await req(API, '/me', { method: 'DELETE', token: t4, json: { confirmacao: 'EXCLUIR' } });

// 5. Chave PIX e e-mail cifrados
const abertos = (t, c) => db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE ${c} <> '' AND ${c} NOT LIKE 'v1:%'`).get().n;
conferir('5. chave PIX das igrejas cifrada no banco', abertos('igrejas', 'chave_pix') === 0);
conferir('5. chave PIX dos semeadores cifrada no banco', abertos('semeadores', 'chave_pix') === 0);
conferir('5. e-mail dos pedidos de show cifrado no banco', abertos('solicitacoes_show', 'email') === 0);
// Igreja temporária do teste, com uma oferta paga (para aparecer no relatório de repasses).
const temp = await igrejaTemporaria(db, envAdmin);
const foneOf = `6387${String(Date.now()).slice(-7)}`;
await req(API, '/auth/codigo', { method: 'POST', json: { whatsapp: foneOf } });
const sOf = (await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: foneOf, codigo: '123456', nome: 'Sessao' } })).dados;
const ofTemp = (await req(API, '/ofertas', { method: 'POST', token: sOf.token, json: { igrejaId: temp.id, quantidade: 1, anonima: false } })).dados;
await req(API, `/dev/ofertas/${ofTemp.id}/pagar`, { method: 'POST' });
const alvo = (await req(ADM, `/igrejas/${temp.id}`, { token: tokAdm })).dados;
conferir('5. admin vê a chave PIX normal', alvo?.chavePix === temp.chavePix, alvo?.chavePix);
const rep = (await req(ADM, '/relatorios/igrejas', { token: tokAdm })).dados;
conferir('5. relatório de repasses mostra a chave PIX legível', rep.length > 0 && rep.every((l) => !String(l.chavePix).startsWith('v1:')));
await req(ADM, `/igrejas/${alvo.id}`, { method: 'PUT', token: tokAdm, json: { chavePix: 'nova-chave-9876' } });
const audPix = db.prepare("SELECT detalhes FROM auditoria WHERE registro_id = ? AND acao = 'editar' ORDER BY criado_em DESC").get(alvo.id);
conferir('5. auditoria da troca de PIX mostra só o final (***)', audPix.detalhes.includes('***9876') && audPix.detalhes.includes('***.com') && !audPix.detalhes.includes('nova-chave'), audPix.detalhes);


// 7. Limites no banco, sem dados pessoais
const limites = db.prepare('SELECT chave FROM limites').all();
conferir('7. limites de tentativa gravados no banco', limites.length > 0);
conferir('7. limites guardam só hash (sem telefone)', limites.every((l) => /^[0-9a-f]{64}$/.test(l.chave) && !l.chave.includes(fone)));

// Arquivo do banco sem dados abertos
const bytes = readFileSync(`${dadosDir}/renovando.db`).toString('latin1') + (existsSync(`${dadosDir}/renovando.db-wal`) ? readFileSync(`${dadosDir}/renovando.db-wal`).toString('latin1') : '');
conferir('arquivo do banco não contém o telefone de teste nem chaves PIX abertas', !bytes.includes(fone) && !bytes.includes('nova-chave-9876') && !bytes.includes('exemplo0@igreja.org'));

// limpeza: igreja temporária e contas de teste deste teste
apagarIgreja(db, temp.id);
apagarContas(db, ...db.prepare("SELECT id FROM usuarios WHERE nome = 'Sessao' OR excluido_em IS NOT NULL").all().map((u) => u.id));
console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
