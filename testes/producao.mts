// Testes das peças de produção: código do autenticador (TOTP), envio do código pelo WhatsApp,
// avisos no celular, cadastro de celulares e login do admin em duas etapas.
// Roda com "npm test" (servidores locais em modo de desenvolvimento).
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const [envAdminPath, dbPath] = process.argv.slice(2);
const envAdmin = Object.fromEntries(readFileSync(envAdminPath, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.trim().split(/=(.*)/s).slice(0, 2)));
process.loadEnvFile(new URL('../api/.env', import.meta.url));

const { base32, codigoNoPasso, conferirCodigoTotp, passoAtual } = await import('../admin/servidor/src/totp.ts');
const { enviarCodigoWhatsapp } = await import('../api/src/whatsapp.ts');
const { enviarAviso } = await import('../compartilhado/src/avisos.ts');

const API = 'http://localhost:3333/api';
const ADM = 'http://localhost:4000/api';
let ok = 0, falhas = 0;
const conferir = (n: string, c: unknown, x = '') => { c ? ok++ : falhas++; console.log(`${c ? 'OK  ' : 'FALHOU'} ${n}${x ? ` (${x})` : ''}`); };
async function req(base: string, caminho: string, { method = 'GET', json, token }: { method?: string; json?: unknown; token?: string } = {}) {
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  if (json !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(base + caminho, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : undefined });
  const t = await r.text();
  let d: any; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, dados: d };
}
const db = new DatabaseSync(dbPath);

// ---------- 1. TOTP (exemplo oficial da RFC 6238: segredo "12345678901234567890", 59 s → 94287082) ----------
const segredoRfc = base32(Buffer.from('12345678901234567890'));
conferir('TOTP bate com o exemplo oficial da RFC 6238', codigoNoPasso(segredoRfc, Math.floor(59 / 30)) === '287082');
const agora = Date.now();
const atual = codigoNoPasso(segredoRfc, passoAtual(agora));
conferir('TOTP aceita o código atual', conferirCodigoTotp(segredoRfc, atual, -1, agora) !== null);
conferir('TOTP aceita 30 s de diferença no relógio', conferirCodigoTotp(segredoRfc, codigoNoPasso(segredoRfc, passoAtual(agora) - 1), -1, agora) !== null);
conferir('TOTP recusa código de 2 minutos atrás', conferirCodigoTotp(segredoRfc, codigoNoPasso(segredoRfc, passoAtual(agora) - 4), -1, agora) === null);
conferir('TOTP não aceita o mesmo código duas vezes', conferirCodigoTotp(segredoRfc, atual, passoAtual(agora), agora) === null);

// ---------- 2. WhatsApp (sem chamar a Meta: troca o fetch por um falso) ----------
const fetchOriginal = globalThis.fetch;
let enviado: { url: string; corpo: any; auth: string } | null = null;
process.env.WHATSAPP_TOKEN = 'token-de-teste';
process.env.WHATSAPP_NUMERO_ID = '123456789';
globalThis.fetch = (async (url: string, init: RequestInit) => {
  enviado = { url: String(url), corpo: JSON.parse(String(init.body)), auth: String((init.headers as Record<string, string>).Authorization) };
  return new Response(JSON.stringify({ messages: [{ id: 'wamid.x' }] }), { status: 200 });
}) as typeof fetch;
await enviarCodigoWhatsapp('63999998888', '654321');
conferir('WhatsApp: envia para o número com +55 no modelo de autenticação', enviado?.corpo.to === '5563999998888' && enviado?.corpo.template.name === 'codigo_login' && enviado?.url.endsWith('/123456789/messages'));
conferir('WhatsApp: código vai no texto e no botão "Copiar código"', JSON.stringify(enviado?.corpo.template.components).split('654321').length === 3);
conferir('WhatsApp: usa o token no cabeçalho', enviado?.auth === 'Bearer token-de-teste');
globalThis.fetch = (async () => new Response(JSON.stringify({ error: { code: 131026, message: 'x' } }), { status: 400 })) as typeof fetch;
const semWhats = await enviarCodigoWhatsapp('63999998888', '654321').then(() => null, (e) => e);
conferir('WhatsApp: número sem WhatsApp vira mensagem clara', semWhats?.status === 400 && /não recebe mensagens/.test(semWhats.message));
delete process.env.WHATSAPP_TOKEN;
const semConfig = await enviarCodigoWhatsapp('63999998888', '654321').then(() => null, (e) => e);
conferir('WhatsApp: sem configuração responde 503 (não finge que enviou)', semConfig?.status === 503);

// ---------- 3. Avisos no celular (sem chamar a Expo) ----------
const tokens = Array.from({ length: 150 }, (_, i) => `ExponentPushToken[teste${Date.now()}x${i}]`);
for (const t of tokens) db.prepare('INSERT INTO dispositivos (token, plataforma) VALUES (?, ?)').run(t, 'android');
const lotes: any[][] = [];
globalThis.fetch = (async (_url: string, init: RequestInit) => {
  const msgs = JSON.parse(String(init.body)) as any[];
  lotes.push(msgs);
  // O primeiro celular "desinstalou o app".
  return new Response(JSON.stringify({ data: msgs.map((m) => (m.to === tokens[0] ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' })) }));
}) as typeof fetch;
const totalAntes = (db.prepare('SELECT COUNT(*) n FROM dispositivos').get() as { n: number }).n;
const r = await enviarAviso({ titulo: 'Teste', mensagem: 'Mensagem de teste', rota: '/premios' });
globalThis.fetch = fetchOriginal;
conferir('Avisos: enviados em lotes de até 100', lotes.length === Math.ceil(totalAntes / 100) && lotes.every((l) => l.length <= 100), `${lotes.map((l) => l.length).join('+')}`);
conferir('Avisos: aviso leva título, texto e a tela que abre', lotes[0][0].title === 'Teste' && lotes[0][0].data.rota === '/premios' && lotes[0][0].channelId === 'avisos');
conferir('Avisos: celular que desinstalou sai da lista', r.falhas === 1 && !db.prepare('SELECT 1 FROM dispositivos WHERE token = ?').get(tokens[0]));
for (const t of tokens) db.prepare('DELETE FROM dispositivos WHERE token = ?').run(t);

// ---------- 4. Cadastro do celular pela API ----------
const tokenApi = `ExponentPushToken[api${Date.now()}]`;
conferir('API: aceita cadastro do celular', (await req(API, '/dispositivos', { method: 'POST', json: { token: tokenApi, plataforma: 'android' } })).status === 201);
conferir('API: recusa token inválido', (await req(API, '/dispositivos', { method: 'POST', json: { token: 'qualquer-coisa', plataforma: 'android' } })).status === 400);
conferir('API: remove o celular', (await req(API, '/dispositivos', { method: 'DELETE', json: { token: tokenApi } })).status === 200 && !db.prepare('SELECT 1 FROM dispositivos WHERE token = ?').get(tokenApi));

// ---------- 5. Admin: avisos e login em duas etapas ----------
db.prepare('DELETE FROM limites').run();
const tokAdm = (await req(ADM, '/login', { method: 'POST', json: { email: envAdmin.ADMIN_EMAIL, senha: envAdmin.ADMIN_SENHA } })).dados.token;
conferir('Admin: resumo dos avisos', typeof (await req(ADM, '/avisos', { token: tokAdm })).dados.dispositivos === 'number');
conferir('Admin: aviso com texto curto demais é recusado', (await req(ADM, '/avisos', { method: 'POST', token: tokAdm, json: { titulo: 'a', mensagem: 'b' } })).status === 400);

const email = `dois.fatores.${Date.now()}@renovando.local`;
const senha = randomBytes(18).toString('base64url');
const editor = (await req(ADM, '/admins', { method: 'POST', token: tokAdm, json: { nome: 'Teste 2 etapas', email, senha, papel: 'editor', ativo: true } })).dados;
conferir('Editor não envia avisos', (await req(ADM, '/avisos', { token: (await req(ADM, '/login', { method: 'POST', json: { email, senha } })).dados.token })).status === 403);
const tok1 = (await req(ADM, '/login', { method: 'POST', json: { email, senha } })).dados.token;
const outraSessao = (await req(ADM, '/login', { method: 'POST', json: { email, senha } })).dados.token;
conferir('2 etapas: começar exige a senha', (await req(ADM, '/me/2fa/iniciar', { method: 'POST', token: tok1, json: { senha: 'errada' } })).status === 401);
const ini = (await req(ADM, '/me/2fa/iniciar', { method: 'POST', token: tok1, json: { senha } })).dados;
conferir('2 etapas: gera QR Code e chave', ini.qrCode?.startsWith('data:image/png;base64,') && /^[A-Z2-7]{32}$/.test(ini.segredo) && ini.otpauth.startsWith('otpauth://totp/'));
const bruto = db.prepare('SELECT totp_segredo FROM admins WHERE id = ?').get(editor.id) as { totp_segredo: string };
conferir('2 etapas: chave guardada cifrada no banco', bruto.totp_segredo.startsWith('v1:') && !bruto.totp_segredo.includes(ini.segredo));
conferir('2 etapas: código errado não ativa', (await req(ADM, '/me/2fa/ativar', { method: 'POST', token: tok1, json: { codigo: '000000' } })).status === 400);
const at = await req(ADM, '/me/2fa/ativar', { method: 'POST', token: tok1, json: { codigo: codigoNoPasso(ini.segredo, passoAtual()) } });
conferir('2 etapas: ativa com o código do aplicativo', at.status === 200 && at.dados.token);
conferir('2 etapas: ativar derruba as outras sessões', (await req(ADM, '/me', { token: outraSessao })).status === 401);
conferir('2 etapas: a sessão atual continua (token novo)', (await req(ADM, '/me', { token: at.dados.token })).dados.totpAtivo === true);
db.prepare('DELETE FROM limites').run();
const so = await req(ADM, '/login', { method: 'POST', json: { email, senha } });
conferir('Login: senha certa sem código pede o código (sem token)', so.status === 200 && so.dados.precisaCodigo === true && !so.dados.token);
conferir('Login: código errado é recusado', (await req(ADM, '/login', { method: 'POST', json: { email, senha, codigo: '123456' } })).status === 401);
// Usa o código do próximo intervalo (o atual já foi gasto na ativação).
const codigoLogin = codigoNoPasso(ini.segredo, passoAtual() + 1);
db.prepare('DELETE FROM limites').run();
const comCodigo = await req(ADM, '/login', { method: 'POST', json: { email, senha, codigo: codigoLogin } });
conferir('Login: senha + código entra', comCodigo.status === 200 && comCodigo.dados.token);
conferir('Login: o mesmo código não serve de novo', (await req(ADM, '/login', { method: 'POST', json: { email, senha, codigo: codigoLogin } })).status === 401);
const lista = (await req(ADM, '/admins', { token: tokAdm })).dados as any[];
conferir('Lista de usuários mostra 2 etapas sem expor a chave', lista.find((a) => a.id === editor.id)?.totpAtivo === true && !JSON.stringify(lista).includes('totpSegredo'));
await req(ADM, `/admins/${editor.id}`, { method: 'PUT', token: tokAdm, json: { totpAtivo: true } });
await req(ADM, `/admins/${editor.id}`, { method: 'PUT', token: tokAdm, json: { totpAtivo: false } });
db.prepare('DELETE FROM limites').run();
conferir('Administrador desliga o 2 etapas de quem perdeu o celular', !(await req(ADM, '/login', { method: 'POST', json: { email, senha } })).dados.precisaCodigo);
const aud = db.prepare("SELECT acao FROM auditoria WHERE registro_id = ? AND acao = 'ativar_2fa'").get(editor.id);
conferir('Auditoria registra a ativação', !!aud);
await req(ADM, `/admins/${editor.id}`, { method: 'DELETE', token: tokAdm });
db.prepare('DELETE FROM limites').run();

// ---------- 6. Panfleto da igreja (PDF A4, 1 ou 6 por folha, com QR Code) ----------
const { igrejaTemporaria, apagarIgreja, apagarContas } = await import('./_apoio.mjs');
db.prepare('DELETE FROM limites').run();
const tokAdm2 = (await req(ADM, '/login', { method: 'POST', json: { email: envAdmin.ADMIN_EMAIL, senha: envAdmin.ADMIN_SENHA } })).dados.token;
const temp = await igrejaTemporaria(db, envAdmin);
const pdf = async (url: string, token?: string) => {
  const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const b = Buffer.from(await r.arrayBuffer());
  const texto = b.toString('latin1');
  return { status: r.status, tipo: r.headers.get('content-type') ?? '', b, paginas: (texto.match(/\/Type \/Page\b/g) ?? []).length, imagens: (texto.match(/\/Subtype \/Image/g) ?? []).length };
};
const um1 = await pdf(`${ADM}/igrejas/${temp.id}/panfleto?porPagina=1`, tokAdm2);
const seis = await pdf(`${ADM}/igrejas/${temp.id}/panfleto?porPagina=6`, tokAdm2);
conferir('Panfleto: admin baixa o PDF 1 por folha', um1.status === 200 && um1.tipo.includes('application/pdf') && um1.b.subarray(0, 5).toString() === '%PDF-' && um1.paginas === 1, `${um1.status} ${Math.round(um1.b.length / 1024)} KB`);
conferir('Panfleto: 6 por folha numa página só e leve (imagem guardada uma vez)', seis.status === 200 && seis.paginas === 1 && seis.imagens === 1 && seis.b.length < 2_000_000, `${Math.round(seis.b.length / 1024)} KB`);
conferir('Panfleto: sem login do admin é negado', (await pdf(`${ADM}/igrejas/${temp.id}/panfleto`)).status === 401);
// Pastor (dono do WhatsApp cadastrado na igreja) baixa pelo app
const entrarApp = async (fone: string) => {
  await req(API, '/auth/codigo', { method: 'POST', json: { whatsapp: fone } });
  return (await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: fone, codigo: '123456', nome: 'Panfleto' } })).dados;
};
const pastor = await entrarApp(temp.pastorWhatsapp);
const doPastor = await pdf(`${API}/me/igrejas/${temp.id}/panfleto?porPagina=6`, pastor.token);
conferir('Panfleto: o pastor baixa pelo app', doPastor.status === 200 && doPastor.b.subarray(0, 5).toString() === '%PDF-');
const estranho = await entrarApp(`6379${String(Date.now()).slice(-7)}`);
conferir('Panfleto: outra pessoa não baixa o panfleto da igreja', (await pdf(`${API}/me/igrejas/${temp.id}/panfleto`, estranho.token)).status === 404);
await req(ADM, `/igrejas/${temp.id}`, { method: 'PUT', token: tokAdm2, json: { status: 'pendente' } });
conferir('Panfleto: igreja ainda não aprovada não tem panfleto', (await pdf(`${ADM}/igrejas/${temp.id}/panfleto`, tokAdm2)).status === 400);
apagarIgreja(db, temp.id);
apagarContas(db, pastor.usuario?.id, estranho.usuario?.id);
db.prepare('DELETE FROM limites').run();

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
