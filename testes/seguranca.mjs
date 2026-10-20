// Testes das correções de segurança contra os servidores locais (API 3333, admin 4000).
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { apagarContas, apagarIgreja, igrejaTemporaria } from './_apoio.mjs';

const API = 'http://localhost:3333/api';
const ADM = 'http://localhost:4000/api';
const envAdmin = Object.fromEntries(
  readFileSync(process.argv[2], 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.trim().split(/=(.*)/s).slice(0, 2)),
);

const db = new DatabaseSync(process.argv[3]);
let ok = 0, falhas = 0;
const conferir = (nome, cond, extra = '') => {
  if (cond) ok++; else falhas++;
  console.log(`${cond ? 'OK  ' : 'FALHOU'} ${nome}${extra ? ` (${extra})` : ''}`);
};
async function req(base, caminho, { method = 'GET', json, token, body, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (json !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(base + caminho, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : body });
  const texto = await r.text();
  let dados; try { dados = JSON.parse(texto); } catch { dados = texto; }
  return { status: r.status, dados, headers: r.headers };
}

// --- login admin
const login = await req(ADM, '/login', { method: 'POST', json: { email: envAdmin.ADMIN_EMAIL, senha: envAdmin.ADMIN_SENHA } });
const tokAdm = login.dados.token;
conferir('login do administrador', login.status === 200);

// --- 1. Upload
const html = new Blob(['<html><script>alert(1)</script></html>'], { type: 'image/png' });
let fd = new FormData(); fd.append('arquivo', html, 'foto.html');
let up = await req(ADM, '/upload', { method: 'POST', token: tokAdm, body: fd });
conferir('1. HTML disfarçado de imagem é recusado', up.status === 400, `${up.status} ${up.dados?.erro ?? ''}`);
const png = Buffer.from('89504e470d0a1a0a0000000d494844520000000200000002080600000072b60d240000000970485973000003e8000003e801b57b526b0000001149444154089963c8938afd0fc20c300600403607910ec1f0e60000000049454e44ae426082', 'hex');
fd = new FormData(); fd.append('arquivo', new Blob([png], { type: 'image/png' }), 'qualquer.html');
up = await req(ADM, '/upload', { method: 'POST', token: tokAdm, body: fd });
conferir('1. imagem real é aceita e convertida para .webp', up.status === 201 && up.dados.url.endsWith('.webp'), up.dados.url);
const img = await fetch('http://localhost:3333' + up.dados.url);
conferir('1. imagem servida com nosniff + sandbox', img.headers.get('x-content-type-options') === 'nosniff' && (img.headers.get('content-security-policy') ?? '').includes('sandbox'));
const html404 = await fetch('http://localhost:3333/uploads/qualquer.html');
conferir('1. arquivos que não são imagem não são servidos', html404.status === 404);

// --- 3. Chave PIX protegida (editor de teste com senha aleatória, removido no fim)
const senhaEditor = randomBytes(18).toString('base64url');
const emailEditor = `editor.teste.${Date.now()}@renovando.local`;
const novoEditor = await req(ADM, '/admins', { method: 'POST', token: tokAdm, json: { nome: 'Editor de teste', email: emailEditor, senha: senhaEditor, papel: 'editor', ativo: true } });
const tokEd = (await req(ADM, '/login', { method: 'POST', json: { email: emailEditor, senha: senhaEditor } })).dados.token;
// Igreja temporária do próprio teste (nunca mexe em igreja real).
const alvo = await igrejaTemporaria(db, envAdmin);
const pixOriginal = alvo.chavePix;
let r = await req(ADM, `/igrejas/${alvo.id}`, { method: 'PUT', token: tokEd, json: { chavePix: 'golpe@exemplo.com' } });
conferir('3. editor NÃO consegue trocar a chave PIX', r.status === 403, `${r.status} ${r.dados?.erro ?? ''}`);
r = await req(ADM, `/igrejas`, { method: 'POST', token: tokEd, json: { razaoSocial: 'Igreja do golpe', nomeFantasia: 'Igreja do golpe', cidade: 'Palmas', uf: 'TO', chavePix: 'golpe@exemplo.com', status: 'ativa' } });
conferir('3. editor NÃO consegue criar igreja com chave PIX', r.status === 403, `${r.status} ${r.dados?.erro ?? ''}`);
r = await req(ADM, `/igrejas/${alvo.id}`, { method: 'PUT', token: tokEd, json: { observacao: 'nota do editor' } });
conferir('3. editor ainda pode editar outros campos', r.status === 200);

// --- Bug do PUT parcial (aprovar não apaga mais os outros campos)
r = await req(ADM, `/igrejas/${alvo.id}`, { method: 'PUT', token: tokEd, json: { status: 'ativa' } });
conferir('PUT parcial (só status) mantém a chave PIX', r.status === 200 && r.dados.chavePix === pixOriginal && r.dados.observacao === 'nota do editor', `pix=${r.dados.chavePix}`);
await req(ADM, `/igrejas/${alvo.id}`, { method: 'PUT', token: tokAdm, json: { observacao: '' } });

// --- Auditoria
const aud = (await req(ADM, '/auditoria?recurso=igrejas', { token: tokAdm })).dados;
conferir('Auditoria registra edição com antes/depois', aud.linhas?.some((l) => l.acao === 'editar' && l.adminNome === 'Editor de teste' && l.detalhes?.observacao));
r = await req(ADM, '/auditoria', { token: tokEd });
conferir('Auditoria só para administradores', r.status === 403);
const falha = await req(ADM, '/login', { method: 'POST', json: { email: emailEditor, senha: 'errada' } });
const audLogin = (await req(ADM, '/auditoria?recurso=sessao&acao=login_falhou', { token: tokAdm })).dados;
conferir('Auditoria registra login recusado', falha.status === 401 && audLogin.linhas?.some((l) => l.resumo === emailEditor));

// remove o editor de teste
await req(ADM, `/admins/${novoEditor.dados.id}`, { method: 'DELETE', token: tokAdm });

// --- 4. Limite de envio de código
const fone = `6397${String(Date.now()).slice(-7)}`;
const tentativas = [];
for (let i = 0; i < 4; i++) tentativas.push((await req(API, '/auth/codigo', { method: 'POST', json: { whatsapp: fone } })).status);
conferir('4. 4º pedido de código para o mesmo número é bloqueado', tentativas.join(',') === '200,200,200,429', tentativas.join(','));

// --- 5. CSV contra fórmulas
const fone2 = `6396${String(Date.now()).slice(-7)}`;
await req(API, '/auth/codigo', { method: 'POST', json: { whatsapp: fone2 } });
const sess = (await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: fone2, codigo: '123456', nome: '=HYPERLINK("http://mal.example","clique")', sobrenome: '' } })).dados;
const igrejaPub = alvo;
const of = (await req(API, '/ofertas', { method: 'POST', token: sess.token, json: { igrejaId: igrejaPub.id, quantidade: 1, anonima: false } })).dados;
const csv = await fetch(`${ADM}/relatorios/ofertas.csv`, { headers: { Authorization: `Bearer ${tokAdm}` } }).then((x) => x.text());
const linha = csv.split('\n').find((l) => l.includes('HYPERLINK')) ?? '';
conferir('5. CSV neutraliza fórmula no nome', linha.includes(`"'=HYPERLINK`) || linha.includes(`;'=HYPERLINK`), linha.slice(0, 80));

// --- 6. Consulta de oferta sem id do ofertante
const consulta = (await req(API, `/ofertas/${of.id}`)).dados;
conferir('6. consulta de oferta não expõe o id do ofertante', consulta.id === of.id && !('usuarioId' in consulta));

// --- 7. Cabeçalhos
const h1 = (await req(API, '/saude')).headers;
const h2 = await fetch('http://localhost:4000/').then((x) => x.headers);
conferir('7. cabeçalhos de segurança na API', h1.get('x-content-type-options') === 'nosniff' && h1.get('x-frame-options') === 'DENY');
conferir('7. política de conteúdo (CSP) no admin', (h2.get('content-security-policy') ?? '').includes("frame-ancestors 'none'"));

// limpeza: igreja temporária e a conta de teste
apagarIgreja(db, alvo.id);
apagarContas(db, sess.usuario?.id);
console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
