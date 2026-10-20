// Teste da exclusão de conta: API (3333) + servidor do admin (4000) + banco.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { apagarContas, apagarIgreja, igrejaTemporaria } from './_apoio.mjs';

const [envAdminPath, dbPath] = process.argv.slice(2);
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

// conta nova com uma oferta paga (cupom) e uma pendente
const fone = `6395${String(Date.now()).slice(-7)}`;
await req(API, '/auth/codigo', { method: 'POST', json: { whatsapp: fone } });
const sess = (await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: fone, codigo: '123456', nome: 'Pessoa', sobrenome: 'Exclusão' } })).dados;
const tok = sess.token;
const igreja = await igrejaTemporaria(new DatabaseSync(dbPath), envAdmin); // nunca uma igreja real
const paga = (await req(API, '/ofertas', { method: 'POST', token: tok, json: { igrejaId: igreja.id, quantidade: 2, anonima: false } })).dados;
await req(API, `/dev/ofertas/${paga.id}/pagar`, { method: 'POST' });
const pendente = (await req(API, '/ofertas', { method: 'POST', token: tok, json: { igrejaId: igreja.id, quantidade: 1, anonima: false } })).dados;
const cupons = (await req(API, '/me/cupons', { token: tok })).dados;
conferir('preparação: conta com 2 cupons', cupons.length === 2);

let r = await req(API, '/me', { method: 'DELETE', token: tok, json: {} });
conferir('sem digitar EXCLUIR, não exclui', r.status === 400);
r = await req(API, '/me', { method: 'DELETE', json: { confirmacao: 'EXCLUIR' } });
conferir('sem login, não exclui', r.status === 401);
r = await req(API, '/me', { method: 'DELETE', token: tok, json: { confirmacao: 'EXCLUIR' } });
conferir('exclusão confirmada', r.status === 200);

conferir('o login antigo deixa de valer', (await req(API, '/me/cupons', { token: tok })).status === 401);
conferir('não dá para ofertar concorrendo com o login antigo', (await req(API, '/ofertas', { method: 'POST', token: tok, json: { igrejaId: igreja.id, quantidade: 1, anonima: false } })).status === 401);
conferir('excluir de novo não funciona', (await req(API, '/me', { method: 'DELETE', token: tok, json: { confirmacao: 'EXCLUIR' } })).status === 401);

const db = new DatabaseSync(dbPath);
const u = db.prepare('SELECT nome, sobrenome, whatsapp, excluido_em FROM usuarios WHERE id = ?').get(sess.usuario.id);
conferir('dados pessoais apagados', u.nome === 'Conta excluída' && u.sobrenome === '' && !u.whatsapp.includes(fone) && !!u.excluido_em, JSON.stringify(u));
conferir('nenhum registro guarda o telefone', !db.prepare('SELECT 1 FROM usuarios WHERE whatsapp = ?').get(fone) && !db.prepare('SELECT 1 FROM otps WHERE whatsapp = ?').get(fone));
conferir('oferta paga mantida (registro financeiro)', db.prepare('SELECT status FROM ofertas WHERE id = ?').get(paga.id).status === 'paga');
conferir('PIX pendente cancelado', db.prepare('SELECT status FROM ofertas WHERE id = ?').get(pendente.id).status === 'cancelada');

const tokAdm = (await req(ADM, '/login', { method: 'POST', json: { email: envAdmin.ADMIN_EMAIL, senha: envAdmin.ADMIN_SENHA } })).dados.token;
const lista = (await req(ADM, `/usuarios?busca=${encodeURIComponent('Exclusão')}`, { token: tokAdm })).dados;
conferir('some da lista de ofertantes do admin', !lista.some((x) => x.id === sess.usuario.id));
const csv = await fetch(`${ADM}/relatorios/ofertas.csv`, { headers: { Authorization: `Bearer ${tokAdm}` } }).then((x) => x.text());
conferir('relatório não mostra telefone nem marcador interno', !csv.includes(fone) && !csv.includes('excluido:'));
const premio = db.prepare("SELECT id FROM premios WHERE ganhador_cupom_id IS NULL ORDER BY data_sorteio LIMIT 1").get();
r = await req(ADM, `/premios/${premio.id}/sortear`, { method: 'POST', token: tokAdm, json: { numero: cupons[0].numero } });
conferir('cupons da conta excluída não podem ganhar', r.status === 404, r.dados?.erro);
const aud = (await req(ADM, '/auditoria?recurso=conta', { token: tokAdm })).dados;
conferir('exclusão registrada na auditoria, sem dados pessoais', aud.linhas.some((l) => l.registroId === sess.usuario.id && !JSON.stringify(l).includes(fone)));

// voltar depois: mesmo WhatsApp cria conta nova, vazia
await req(API, '/auth/codigo', { method: 'POST', json: { whatsapp: fone } });
const nova = (await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: fone, codigo: '123456', nome: 'Pessoa' } })).dados;
conferir('mesmo WhatsApp pode criar conta nova, sem os cupons antigos', nova.usuario.id !== sess.usuario.id && (await req(API, '/me/cupons', { token: nova.token })).dados.length === 0);
await req(API, '/me', { method: 'DELETE', token: nova.token, json: { confirmacao: 'EXCLUIR' } });

// limpeza: igreja temporária e as contas do teste
apagarIgreja(db, igreja.id);
apagarContas(db, sess.usuario.id, nova.usuario.id);
console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
