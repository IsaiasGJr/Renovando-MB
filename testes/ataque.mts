// Teste de ataque: tenta invadir o sistema como um atacante faria (sem login, token falso, acesso a dados
// de outra pessoa, injeção de SQL e de script, arquivos disfarçados, força bruta, manipulação de preço...).
// Cada "conferir" é uma tentativa que PRECISA falhar. Tudo o que o teste cria é apagado no fim.
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import jwt from 'jsonwebtoken';
import { apagarContas, apagarIgreja, igrejaTemporaria } from './_apoio.mjs';

const [envAdminPath, envApiPath, dbPath] = process.argv.slice(2);
const lerEnv = (p: string) => Object.fromEntries(readFileSync(p, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.trim().split(/=(.*)/s).slice(0, 2)));
const envAdmin = lerEnv(envAdminPath), envApi = lerEnv(envApiPath);
const API = 'http://localhost:3333/api', ADM = 'http://localhost:4000/api';
let ok = 0, falhas = 0;
const conferir = (n: string, c: unknown, x = '') => { c ? ok++ : falhas++; console.log(`${c ? 'OK  ' : 'FALHOU'} ${n}${x ? ` (${x})` : ''}`); };
async function req(base: string, caminho: string, { method = 'GET', json, token, cru, cabecalhos = {} }: { method?: string; json?: unknown; token?: string; cru?: string; cabecalhos?: Record<string, string> } = {}) {
  const h: Record<string, string> = { ...cabecalhos };
  if (token) h.Authorization = `Bearer ${token}`;
  if (json !== undefined || cru !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(base + caminho, { method, headers: h, body: cru ?? (json !== undefined ? JSON.stringify(json) : undefined) });
  const t = await r.text();
  let d: any; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, dados: d, texto: t, cabecalhos: r.headers };
}
const db = new DatabaseSync(dbPath);
const zerar = () => db.prepare('DELETE FROM limites').run();
zerar();
const sufixo = () => String(Date.now() + Math.floor(Math.random() * 999)).slice(-7);
const criados = { usuarios: [] as string[], igrejas: [] as string[], admins: [] as string[] };

async function entrarApp(fone: string, nome = 'Ataque') {
  zerar();
  await req(API, '/auth/codigo', { method: 'POST', json: { whatsapp: fone } });
  const v = (await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: fone, codigo: '123456', nome, sobrenome: 'Teste' } })).dados;
  criados.usuarios.push(v.usuario.id);
  return v as { token: string; usuario: { id: string } };
}
const tokAdm = (await req(ADM, '/login', { method: 'POST', json: { email: envAdmin.ADMIN_EMAIL, senha: envAdmin.ADMIN_SENHA } })).dados.token;

// ===== 1. Rotas da equipe sem login =====
const rotasEquipe = ['/me', '/dashboard', '/auditoria', '/avisos', '/aprovacoes', '/campanhas', '/movimentacoes', '/repasses', '/relatorios/ofertas',
  '/relatorios/ofertas.csv', '/relatorios/igrejas', '/sorteios/resumo', '/usuarios', '/importacoes/igrejas/modelo.csv', '/anexos/x.pdf',
  '/premios', '/igrejas', '/semeadores', '/noticias', '/mensagens', '/admins', '/parceiros', '/solicitacoes-show', '/paginas'];
const abertas: string[] = [];
for (const r of rotasEquipe) if ((await req(ADM, r)).status !== 401) abertas.push(r);
for (const r of ['/premios', '/igrejas', '/admins', '/campanhas', '/avisos', '/importacoes/igrejas', '/ofertas/manual', '/upload']) {
  if ((await req(ADM, r, { method: 'POST', json: {} })).status !== 401) abertas.push(`POST ${r}`);
}
conferir('Nenhuma rota da equipe responde sem login', abertas.length === 0, abertas.join(', '));
const perfilAbertas = [];
for (const r of ['/perfil/me', '/perfil/painel', '/perfil/relatorio', '/perfil/relatorio.csv']) if ((await req(ADM, r)).status !== 401) perfilAbertas.push(r);
conferir('Nenhuma rota de pastor/semeador/parceiro responde sem login', perfilAbertas.length === 0, perfilAbertas.join(', '));
conferir('Rotas do ofertante pedem login', (await req(API, '/me/cupons')).status === 401 && (await req(API, '/me/painel')).status === 401 && (await req(API, '/me', { method: 'DELETE', json: { confirmacao: 'EXCLUIR' } })).status === 401);

// ===== 2. Tokens forjados =====
const cab = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssinatura = `${cab({ alg: 'none', typ: 'JWT' })}.${cab({ sub: 'x', papel: 'admin', aud: 'renovando-admin' })}.`;
conferir('SEGURANÇA: token sem assinatura (alg "none") é recusado', (await req(ADM, '/me', { token: semAssinatura })).status === 401);
const segredoErrado = jwt.sign({ sub: 'x', papel: 'admin' }, 'segredo-chutado', { audience: 'renovando-admin' });
conferir('SEGURANÇA: token assinado com segredo chutado é recusado', (await req(ADM, '/me', { token: segredoErrado })).status === 401);
const vencido = jwt.sign({ sub: 'x', papel: 'admin', v: 0, exp: Math.floor(Date.now() / 1000) - 60 }, envAdmin.JWT_SEGREDO, { audience: 'renovando-admin' });
conferir('SEGURANÇA: token vencido é recusado', (await req(ADM, '/me', { token: vencido })).status === 401);
const adminInventado = jwt.sign({ sub: 'id-que-nao-existe', papel: 'admin', v: 0 }, envAdmin.JWT_SEGREDO, { audience: 'renovando-admin', expiresIn: '1h' });
conferir('SEGURANÇA: token válido de administrador que não existe é recusado', (await req(ADM, '/me', { token: adminInventado })).status === 401);
const tokApiNoAdmin = jwt.sign({ sub: 'x', tipo: 'usuario' }, envApi.JWT_SEGREDO, { audience: 'renovando-app', expiresIn: '1h' });
conferir('SEGURANÇA: token do app não abre o painel', (await req(ADM, '/me', { token: tokApiNoAdmin })).status === 401);

// ===== 3. Editor tentando virar administrador =====
zerar();
const emailEd = `ataque.${Date.now()}@renovando.local`, senhaEd = randomBytes(16).toString('base64url');
const ed = (await req(ADM, '/admins', { method: 'POST', token: tokAdm, json: { nome: 'Editor Ataque', email: emailEd, senha: senhaEd, papel: 'editor', ativo: true } })).dados;
criados.admins.push(ed.id);
const tokEd = (await req(ADM, '/login', { method: 'POST', json: { email: emailEd, senha: senhaEd } })).dados.token;
conferir('Editor não se promove a administrador', (await req(ADM, `/admins/${ed.id}`, { method: 'PUT', token: tokEd, json: { papel: 'admin' } })).status === 403
  && (db.prepare('SELECT papel FROM admins WHERE id = ?').get(ed.id) as any).papel === 'editor');
conferir('Editor não cria usuários do painel', (await req(ADM, '/admins', { method: 'POST', token: tokEd, json: { nome: 'X', email: `x${emailEd}`, senha: 'senhasegura123', papel: 'admin', ativo: true } })).status === 403);
const igAlvo = await igrejaTemporaria(db, envAdmin);
criados.igrejas.push(igAlvo.id);
const pixAntes = (db.prepare('SELECT chave_pix FROM igrejas WHERE id = ?').get(igAlvo.id) as any).chave_pix;
await req(ADM, `/igrejas/${igAlvo.id}`, { method: 'PUT', token: tokEd, json: { chavePix: 'pix.do.golpista@exemplo.com', tipoChavePix: 'email' } });
conferir('SEGURANÇA: editor não troca a chave PIX de uma igreja', (db.prepare('SELECT chave_pix FROM igrejas WHERE id = ?').get(igAlvo.id) as any).chave_pix === pixAntes);
const bloqueadas: string[] = [];
for (const [m, r] of [['GET', '/repasses'], ['GET', '/movimentacoes'], ['POST', '/importacoes/igrejas'], ['POST', '/ofertas/manual'], ['GET', '/usuarios']] as const) {
  if ((await req(ADM, r, { method: m, token: tokEd, json: m === 'POST' ? {} : undefined })).status !== 403) bloqueadas.push(`${m} ${r}`);
}
conferir('Editor não acessa repasses, movimentações, importação, oferta manual e usuários', bloqueadas.length === 0, bloqueadas.join(', '));

// ===== 4. Dados de outra pessoa (IDOR) =====
const alice = await entrarApp(`6370${sufixo()}`, 'Alice');
const bob = await entrarApp(`6370${sufixo()}`, 'Bob');
const oferta = (await req(API, '/ofertas', { method: 'POST', token: alice.token, json: { igrejaId: igAlvo.id, quantidade: 1, anonima: false } })).dados;
await req(API, `/dev/ofertas/${oferta.id}/pagar`, { method: 'POST' });
const cupomAlice = (await req(API, '/me/cupons', { token: alice.token })).dados[0];
conferir('Alice vê o próprio cupom', !!cupomAlice?.id && (await req(API, `/me/cupons/${cupomAlice.id}/imagem`, { token: alice.token })).status === 200);
conferir('SEGURANÇA: Bob não baixa o cupom da Alice', (await req(API, `/me/cupons/${cupomAlice.id}/imagem`, { token: bob.token })).status === 404);
conferir('SEGURANÇA: Bob não vê os cupons da Alice na lista dele', !(await req(API, '/me/cupons', { token: bob.token })).dados.some((c: any) => c.id === cupomAlice.id));
conferir('SEGURANÇA: ofertante comum não baixa o panfleto de uma igreja', (await req(API, `/me/igrejas/${igAlvo.id}/panfleto`, { token: bob.token })).status === 404);
const vistaEditor = (await req(ADM, `/ofertas/${oferta.id}`, { token: tokEd })).dados;
const vistaAdmin = (await req(ADM, `/ofertas/${oferta.id}`, { token: tokAdm })).dados;
conferir('LGPD: editor vê o WhatsApp do ofertante mascarado; o administrador vê completo', /••••/.test(vistaEditor.whatsapp) && /^\d{11}$/.test(vistaAdmin.whatsapp), `${vistaEditor.whatsapp} / ${vistaAdmin.whatsapp?.length}`);
const ofertaPublica = (await req(API, `/ofertas/${oferta.id}`)).dados;
conferir('Link da oferta não expõe quem ofertou', !('usuarioId' in ofertaPublica) && !JSON.stringify(ofertaPublica).includes(alice.usuario.id));

// ===== 5. Manipulação de preço e de dados enviados =====
const barata = await req(API, '/ofertas', { method: 'POST', token: bob.token, json: { igrejaId: igAlvo.id, quantidade: 5, anonima: false, valor: 0.01 } });
conferir('SEGURANÇA: o valor da oferta é calculado pelo servidor (não dá para pagar menos)', barata.status === 201 && barata.dados.valor === 100, `valor=${barata.dados.valor}`);
const invalidas = [];
for (const q of [0, -3, 1.5, 100000, '5', null]) if ((await req(API, '/ofertas', { method: 'POST', token: bob.token, json: { igrejaId: igAlvo.id, quantidade: q, anonima: false } })).status !== 400) invalidas.push(String(q));
conferir('Quantidade de cupons inválida é recusada (0, negativa, fração, enorme, texto)', invalidas.length === 0, invalidas.join(', '));
conferir('Oferta com cupons exige login (sem login só anônima)', (await req(API, '/ofertas', { method: 'POST', json: { igrejaId: igAlvo.id, quantidade: 1, anonima: false } })).status === 401);
zerar();
const igSuja = await req(API, '/igrejas', { method: 'POST', json: {
  razaoSocial: 'Igreja Atalho', nomeFantasia: `Igreja Atalho ${sufixo()}`, cidade: 'Palmas', uf: 'TO', tipoChavePix: 'email', chavePix: 'a@exemplo.com',
  pastorNome: 'Pastor Atalho', pastorWhatsapp: `6370${sufixo()}`, status: 'ativa', semeadorId: 'x', id: 'id-escolhido',
} });
const igSujaDb = db.prepare("SELECT id, status FROM igrejas WHERE razao_social = 'Igreja Atalho' ORDER BY criado_em DESC").get() as any;
if (igSujaDb) criados.igrejas.push(igSujaDb.id);
conferir('SEGURANÇA: cadastro público de igreja não escolhe a própria situação nem o id', igSuja.status === 201 && igSujaDb?.status === 'pendente' && igSujaDb.id !== 'id-escolhido');
conferir('Oferta para igreja ainda não aprovada é recusada', (await req(API, '/ofertas', { method: 'POST', token: bob.token, json: { igrejaId: igSujaDb?.id, quantidade: 1, anonima: false } })).status === 400);
const poluicao = await req(API, '/contato', { method: 'POST', cru: '{"__proto__":{"admin":true},"constructor":{"prototype":{"admin":true}}}' });
conferir('Envio com "__proto__" não quebra nem contamina o servidor', poluicao.status === 400 && (await req(API, '/campanha')).status === 200);

// ===== 6. Injeção de SQL =====
const sqls = ["' OR '1'='1", "'; DROP TABLE igrejas; --", '" OR 1=1 --', "1 UNION SELECT whatsapp FROM usuarios --"];
let sqlRuim = '';
for (const s of sqls) {
  const a = await req(API, `/igrejas?busca=${encodeURIComponent(s)}`);
  const b = await req(API, `/igrejas/${encodeURIComponent(s)}`);
  const c = await req(ADM, `/relatorios/ofertas?igrejaId=${encodeURIComponent(s)}&busca=${encodeURIComponent(s)}`, { token: tokAdm });
  if (a.status >= 500 || b.status !== 404 || c.status >= 500 || (Array.isArray(a.dados) && a.dados.length > 0)) sqlRuim = s;
}
conferir('SEGURANÇA: injeção de SQL não funciona (busca, endereço e relatórios)', !sqlRuim && (db.prepare("SELECT COUNT(*) AS n FROM igrejas").get() as any).n > 0, sqlRuim);

// ===== 7. Injeção de script (XSS) nas páginas públicas =====
const xss = `<script>alert(1)</script><img src=x onerror=alert(2)>`;
db.prepare('UPDATE igrejas SET nome_fantasia = ?, status = ? WHERE id = ?').run(`Igreja ${xss}`, 'ativa', igAlvo.id);
const paginaIg = await req('http://localhost:3333', `/igreja/${igAlvo.slug}`);
conferir('SEGURANÇA: nome com <script> aparece como texto na página da igreja', paginaIg.status === 200 && !paginaIg.texto.includes('<script>alert') && paginaIg.texto.includes('&lt;script&gt;'));
const indicacao = await req('http://localhost:3333', `/indicacao/${encodeURIComponent('"><script>alert(1)</script>')}`);
conferir('SEGURANÇA: link de indicação não injeta script', !indicacao.texto.includes('<script>alert'));
conferir('Páginas públicas com CSP que bloqueia scripts', /default-src 'none'/.test(paginaIg.cabecalhos.get('content-security-policy') ?? ''));
zerar();
await req(API, '/contato', { method: 'POST', json: { nome: xss, whatsapp: `6370${sufixo()}`, email: 'a@exemplo.com', assunto: 'Teste', mensagem: `${xss} mensagem de teste do ataque` } });
const msg = db.prepare("SELECT id FROM mensagens WHERE mensagem LIKE '%mensagem de teste do ataque%'").get() as any;
conferir('Mensagem com script fica guardada como texto (o painel mostra sem executar)', !!msg);
if (msg) db.prepare('DELETE FROM mensagens WHERE id = ?').run(msg.id);

// ===== 8. Arquivos disfarçados e caminhos proibidos =====
const enviar = async (nome: string, tipo: string, conteudo: Buffer | string, base = ADM, caminho = '/upload?finalidade=noticia', token: string | undefined = tokAdm) => {
  const fd = new FormData();
  fd.append('arquivo', new Blob([conteudo], { type: tipo }), nome);
  const r = await fetch(base + caminho, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
  return r.status;
};
const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
conferir('SEGURANÇA: SVG com script não é aceito como imagem', (await enviar('a.svg', 'image/svg+xml', svg)) >= 400);
conferir('SEGURANÇA: HTML disfarçado de PNG é recusado', (await enviar('a.png', 'image/png', '<html><script>alert(1)</script></html>')) >= 400);
zerar();
conferir('SEGURANÇA: anexo do Fale conosco disfarçado de PDF é recusado', (await enviar('a.pdf', 'application/pdf', '<html>falso</html>', API, '/contato/anexos', undefined)) >= 400);
const caminhos = ['/uploads/..%2f..%2fapi%2f.env', '/uploads/%2e%2e/%2e%2e/api/.env', '/uploads/../../api/.env', '/uploads/..\\..\\api\\.env'];
let vazou = '';
for (const c of caminhos) {
  const r = await fetch(`http://localhost:3333${c}`);
  const t = await r.text();
  if (r.status === 200 && /JWT_SEGREDO|CHAVE_/.test(t)) vazou = c;
}
const anexo = await req(ADM, `/anexos/${encodeURIComponent('../../api/.env')}`, { token: tokAdm });
conferir('SEGURANÇA: não dá para ler arquivos do servidor com "../" (uploads e anexos)', !vazou && anexo.status === 404, vazou);

// ===== 9. Força bruta e tamanho =====
zerar();
const foneBruta = `6370${sufixo()}`;
await req(API, '/auth/codigo', { method: 'POST', json: { whatsapp: foneBruta } });
let travou = false;
for (let i = 0; i < 7; i++) {
  const r = await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: foneBruta, codigo: String(100000 + i) } });
  if (r.status === 429) travou = true;
}
const depois = await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: foneBruta, codigo: '123456' } });
conferir('SEGURANÇA: código do WhatsApp trava depois de 5 tentativas erradas (nem o certo vale mais)', travou && depois.status !== 200);
zerar();
let loginTravou = false;
for (let i = 0; i < 12; i++) if ((await req(ADM, '/login', { method: 'POST', json: { email: envAdmin.ADMIN_EMAIL, senha: `errada${i}` } })).status === 429) loginTravou = true;
conferir('SEGURANÇA: login do painel trava com muitas senhas erradas', loginTravou);
zerar();
const grande = await req(API, '/contato', { method: 'POST', cru: JSON.stringify({ mensagem: 'x'.repeat(2_000_000) }) });
conferir('Pedido gigante (2 MB) é recusado sem derrubar a API', grande.status === 413 && (await req(API, '/campanha')).status === 200);

// ===== 10. Sessões e pagamento =====
conferir('SEGURANÇA: aviso de pagamento falso (sem assinatura) é recusado', (await req(API, '/webhooks/pix', { method: 'POST', json: { txid: 'qualquer' } })).status === 401
  && (await req(API, '/webhooks/pix/segredo-chutado/pix', { method: 'POST', json: [{ txid: 'a'.repeat(32) }] })).status === 401);
const usado = `6370${sufixo()}`;
zerar();
await req(API, '/auth/codigo', { method: 'POST', json: { whatsapp: usado } });
const v1 = await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: usado, codigo: '123456' } });
criados.usuarios.push(v1.dados.usuario?.id);
conferir('SEGURANÇA: o mesmo código do WhatsApp não vale duas vezes', v1.status === 200 && (await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: usado, codigo: '123456' } })).status === 400);
await req(API, '/me/sair-de-todos', { method: 'POST', token: bob.token });
conferir('"Sair de todos os aparelhos" derruba o login antigo na hora', (await req(API, '/me/cupons', { token: bob.token })).status === 401);
const r1 = await req('http://localhost:3333', '/api/campanha'), r2 = await req('http://localhost:4000', '/api/me');
conferir('Servidores não revelam a tecnologia (sem X-Powered-By) e mandam nosniff', !r1.cabecalhos.get('x-powered-by') && !r2.cabecalhos.get('x-powered-by') && r1.cabecalhos.get('x-content-type-options') === 'nosniff');
const erro500 = await req(API, '/ofertas', { method: 'POST', token: alice.token, cru: '{"igrejaId": ' });
conferir('Erro não mostra detalhes internos (pilha, caminhos de arquivo)', erro500.status === 400 && !/at |\\src\\|\/src\/|node_modules/.test(erro500.texto));

// ---------- limpeza ----------
apagarContas(db, ...criados.usuarios);
for (const id of criados.igrejas) apagarIgreja(db, id);
for (const id of criados.admins) await req(ADM, `/admins/${id}`, { method: 'DELETE', token: tokAdm });
db.prepare("DELETE FROM auditoria WHERE criado_em > datetime('now', '-1 hour') AND (acao = 'login_falhou' OR resumo LIKE '%Ataque%' OR resumo LIKE '%ataque.%')").run();
db.prepare("DELETE FROM otps WHERE expira_em < datetime('now', '+1 hour')").run();
zerar();

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
