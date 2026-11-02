// Testes da terceira rodada de segurança: destino e algoritmo dos tokens e tempo do login do painel.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import jwt from 'jsonwebtoken';
import { apagarContas } from './_apoio.mjs';

const [envAdminPath, envApiPath, dbPath] = process.argv.slice(2);
const lerEnv = (p) => Object.fromEntries(readFileSync(p, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.trim().split(/=(.*)/s).slice(0, 2)));
const envAdmin = lerEnv(envAdminPath);
const envApi = lerEnv(envApiPath);
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
const db = new DatabaseSync(dbPath);
db.prepare('DELETE FROM limites').run();

// ---------- Tokens do app ----------
const fone = `6371${String(Date.now()).slice(-7)}`;
await req(API, '/auth/codigo', { method: 'POST', json: { whatsapp: fone } });
const login = (await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: fone, codigo: '123456', nome: 'Seg', sobrenome: 'Tres' } })).dados;
conferir('Token do app (com destino) funciona', (await req(API, '/me/cupons', { token: login.token })).status === 200);

const dados = { sub: login.usuario.id, tipo: 'usuario', v: 0 };
const semDestino = jwt.sign(dados, envApi.JWT_SEGREDO, { expiresIn: '1h' });
conferir('SEGURANÇA: token sem o destino do app é recusado (mesmo com o segredo certo)', (await req(API, '/me/cupons', { token: semDestino })).status === 401);
const doPainel = jwt.sign(dados, envApi.JWT_SEGREDO, { expiresIn: '1h', audience: 'renovando-perfil' });
conferir('SEGURANÇA: token feito para o painel não vale no app', (await req(API, '/me/cupons', { token: doPainel })).status === 401);
const outroAlgoritmo = jwt.sign(dados, envApi.JWT_SEGREDO, { expiresIn: '1h', audience: 'renovando-app', algorithm: 'HS512' });
conferir('SEGURANÇA: token com outro algoritmo é recusado', (await req(API, '/me/cupons', { token: outroAlgoritmo })).status === 401);
const doAdminNoPerfil = jwt.sign({ sub: 'x', perfil: 'pastor', id: 'x' }, envAdmin.JWT_SEGREDO, { expiresIn: '1h', audience: 'renovando-admin' });
conferir('SEGURANÇA: token da equipe não abre o painel de perfil', (await req(ADM, '/perfil/painel', { token: doAdminNoPerfil })).status === 401);

// ---------- Login do painel: o tempo não revela quais e-mails existem ----------
async function tempo(email) {
  const t0 = performance.now();
  await req(ADM, '/login', { method: 'POST', json: { email, senha: 'senha-errada-de-teste' } });
  return performance.now() - t0;
}
const mediana = (l) => l.sort((a, b) => a - b)[Math.floor(l.length / 2)];
const existe = [], naoExiste = [];
for (let i = 0; i < 3; i++) {
  db.prepare('DELETE FROM limites').run();
  existe.push(await tempo(envAdmin.ADMIN_EMAIL));
  naoExiste.push(await tempo(`ninguem.${Date.now()}@renovando.local`));
}
const [te, tn] = [mediana(existe), mediana(naoExiste)];
conferir('SEGURANÇA: login com e-mail inexistente demora o mesmo que com e-mail real', tn > te * 0.5, `${tn.toFixed(0)} ms x ${te.toFixed(0)} ms`);

// ---------- limpeza ----------
apagarContas(db, login.usuario.id);
db.prepare("DELETE FROM auditoria WHERE acao = 'login_falhou' AND criado_em > datetime('now', '-1 hour')").run();
db.prepare('DELETE FROM limites').run();

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
