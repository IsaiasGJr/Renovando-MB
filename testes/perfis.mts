// Testes da entrada no painel pelo WhatsApp (como no site) e dos perfis: equipe, pastor, semeador N1/N2 e parceiro.
// Tudo o que o teste cria é apagado no fim.
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { apagarContas, apagarIgreja, igrejaTemporaria } from './_apoio.mjs';

const [envAdminPath, dbPath] = process.argv.slice(2);
const envAdmin = Object.fromEntries(readFileSync(envAdminPath, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.trim().split(/=(.*)/s).slice(0, 2)));
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
const limpar = () => db.prepare('DELETE FROM limites').run();
const fone = (p: string) => `${p}${String(Date.now() + Math.floor(Math.random() * 999)).slice(-7)}`;
limpar();
const tokAdm = (await req(ADM, '/login', { method: 'POST', json: { email: envAdmin.ADMIN_EMAIL, senha: envAdmin.ADMIN_SENHA } })).dados.token;

/** Código → verificar (em desenvolvimento o código é sempre 123456). */
async function verificar(whatsapp: string) {
  limpar();
  await req(ADM, '/entrar/whatsapp/codigo', { method: 'POST', json: { whatsapp } });
  return (await req(ADM, '/entrar/whatsapp/verificar', { method: 'POST', json: { whatsapp, codigo: '123456' } }));
}
async function entrarComo(whatsapp: string, tipo: string) {
  const v = await verificar(whatsapp);
  return (await req(ADM, '/entrar/perfil', { method: 'POST', json: { escolha: v.dados.escolha, tipo } })).dados;
}

// ---------- 1. Número sem acesso ----------
const semAcesso = fone('6371');
const c0 = await req(ADM, '/entrar/whatsapp/codigo', { method: 'POST', json: { whatsapp: semAcesso } });
conferir('Número sem acesso: resposta igual (não revela quem tem acesso)', c0.status === 200 && c0.dados.ok === true);
conferir('Número sem acesso: nenhum código é gerado', (await req(ADM, '/entrar/whatsapp/verificar', { method: 'POST', json: { whatsapp: semAcesso, codigo: '123456' } })).status === 400);

// ---------- 2. Equipe pelo WhatsApp ----------
const foneEquipe = fone('6370');
const email = `whats.${Date.now()}@renovando.local`;
const ed = (await req(ADM, '/admins', { method: 'POST', token: tokAdm, json: { nome: 'Equipe WhatsApp', email, senha: randomBytes(18).toString('base64url'), papel: 'editor', ativo: true, whatsapp: foneEquipe } })).dados;
conferir('Usuário do painel: WhatsApp de acesso cifrado no banco', (db.prepare('SELECT whatsapp FROM admins WHERE id = ?').get(ed.id) as any).whatsapp.startsWith('v1:'));
conferir('Usuário do painel: o mesmo WhatsApp não vale para dois usuários', (await req(ADM, '/admins', { method: 'POST', token: tokAdm, json: { nome: 'Outro', email: `x${email}`, senha: 'senhasegura123', papel: 'editor', whatsapp: foneEquipe } })).status === 409);
const vEq = await verificar(foneEquipe);
conferir('Equipe: código certo mostra o perfil de equipe', vEq.status === 200 && vEq.dados.perfis.some((p: any) => p.tipo === 'equipe'));
conferir('Código errado é recusado', (await req(ADM, '/entrar/whatsapp/verificar', { method: 'POST', json: { whatsapp: foneEquipe, codigo: '000000' } })).status === 400);
const sEq = (await req(ADM, '/entrar/perfil', { method: 'POST', json: { escolha: vEq.dados.escolha, tipo: 'equipe' } })).dados;
conferir('Equipe: entra no painel completo (mesma sessão do e-mail e senha)', sEq.tipo === 'equipe' && (await req(ADM, '/me', { token: sEq.token })).status === 200);
conferir('Escolha não aceita perfil que a pessoa não tem', (await req(ADM, '/entrar/perfil', { method: 'POST', json: { escolha: vEq.dados.escolha, tipo: 'parceiro' } })).status === 403);

// ---------- 3. Pastor ----------
const temp = await igrejaTemporaria(db, envAdmin);
const pastor = await entrarComo(temp.pastorWhatsapp, 'pastor');
conferir('Pastor: entra no painel dele', pastor.tipo === 'perfil' && pastor.perfil.tipo === 'pastor');
const pp = (await req(ADM, '/perfil/painel', { token: pastor.token })).dados;
conferir('Pastor: vê a igreja, o saldo e as ofertas recentes', pp.igrejas?.some((i: any) => i.id === temp.id) && 'saldo' in pp.igrejas[0] && Array.isArray(pp.ofertas));
conferir('SEGURANÇA: token do pastor não abre rotas da equipe', (await req(ADM, '/igrejas', { token: pastor.token })).status === 401 && (await req(ADM, '/repasses', { token: pastor.token })).status === 401);
conferir('SEGURANÇA: token da equipe não abre o painel de perfil', (await req(ADM, '/perfil/painel', { token: tokAdm })).status === 401);
const ed1 = await req(ADM, `/perfil/minha-igreja/${temp.id}`, { method: 'PUT', token: pastor.token, json: { descricao: 'Mensagem do pastor (teste)', chavePix: 'golpe@x.com' } });
const brutoIg = db.prepare('SELECT descricao, chave_pix FROM igrejas WHERE id = ?').get(temp.id) as any;
conferir('Pastor: edita a mensagem da igreja, mas NUNCA a chave PIX', ed1.status === 200 && brutoIg.descricao === 'Mensagem do pastor (teste)' && brutoIg.chave_pix.startsWith('v1:'));
const outra = (db.prepare("SELECT id FROM igrejas WHERE status = 'ativa' AND id <> ? LIMIT 1").get(temp.id) as any).id;
conferir('Pastor: não mexe em igreja de outro pastor', (await req(ADM, `/perfil/minha-igreja/${outra}`, { method: 'PUT', token: pastor.token, json: { descricao: 'x' } })).status === 404);
const pdf = await fetch(`${ADM}/perfil/igrejas/${temp.id}/panfleto?porPagina=6`, { headers: { Authorization: `Bearer ${pastor.token}` } });
conferir('Pastor: baixa o panfleto da igreja', pdf.status === 200 && (await pdf.text()).startsWith('%PDF'));
conferir('Pastor: não cadastra igrejas (é coisa de semeador)', (await req(ADM, '/perfil/igrejas', { method: 'POST', token: pastor.token, json: {} })).status === 403);

// ---------- 4. Semeador N1 (que também é pastor) e N2 ----------
limpar();
const foneN1 = temp.pastorWhatsapp; // a mesma pessoa: pastor e semeador
await req(API, '/semeadores', { method: 'POST', json: { nome: 'Perfil', sobrenome: 'Semeador Um', whatsapp: foneN1, cpf: '00000000191', chavePix: 'n1@exemplo.com' } });
const n1 = db.prepare("SELECT id FROM semeadores WHERE sobrenome = 'Semeador Um' ORDER BY criado_em DESC").get() as { id: string };
const vPend = await verificar(foneN1);
conferir('Cadastro de semeador em análise aparece como situação', vPend.dados.situacoes.some((s: any) => s.tipo === 'semeador' && s.status === 'pendente'));
await req(ADM, `/aprovacoes/semeadores/${n1.id}`, { method: 'POST', token: tokAdm, json: { acao: 'aprovar' } });
const vDois = await verificar(foneN1);
conferir('Mesma pessoa com 2 perfis: escolhe entre pastor e semeador', vDois.dados.perfis.length === 2 && vDois.dados.perfis.some((p: any) => p.rotulo === 'Semeador N1'));
const sem = (await req(ADM, '/entrar/perfil', { method: 'POST', json: { escolha: vDois.dados.escolha, tipo: 'semeador' } })).dados;
const ps = (await req(ADM, '/perfil/painel', { token: sem.token })).dados;
conferir('Painel do semeador não mostra o painel de pastor da mesma pessoa', ps.semeador?.nivel === 1 && !('igrejas' in ps));
limpar();
const igrejaNova = await req(ADM, '/perfil/igrejas', {
  method: 'POST', token: sem.token,
  json: { razaoSocial: 'Igreja do Semeador Teste', nomeFantasia: 'Igreja do Semeador Teste', cidade: 'Palmas', uf: 'TO', tipoChavePix: 'email', chavePix: 'ig@exemplo.com', pastorNome: 'Pastor Teste', pastorWhatsapp: fone('6369') },
});
const igDb = db.prepare('SELECT status, semeador_id FROM igrejas WHERE id = ?').get(igrejaNova.dados.id) as any;
conferir('Semeador cadastra igreja: fica pendente e ligada a ele', igrejaNova.status === 201 && igDb.status === 'pendente' && igDb.semeador_id === n1.id);
const foneN2 = fone('6368');
const n2 = await req(ADM, '/perfil/semeadores', { method: 'POST', token: sem.token, json: { nome: 'Perfil', sobrenome: 'Semeador Dois', whatsapp: foneN2, cpf: '00000000191', chavePix: 'n2@exemplo.com' } });
conferir('N1 cadastra N2 na rede dele', n2.status === 201 && (db.prepare('SELECT pai_id FROM semeadores WHERE id = ?').get(n2.dados.id) as any).pai_id === n1.id);
await req(ADM, `/aprovacoes/semeadores/${n2.dados.id}`, { method: 'POST', token: tokAdm, json: { acao: 'aprovar' } });
const semN2 = await entrarComo(foneN2, 'semeador');
conferir('N2 entra como Semeador N2', semN2.perfil?.rotulo === 'Semeador N2');
conferir('N2 não cadastra outros semeadores', (await req(ADM, '/perfil/semeadores', { method: 'POST', token: semN2.token, json: {} })).status === 403);
await req(ADM, `/semeadores/${n2.dados.id}`, { method: 'PUT', token: tokAdm, json: { status: 'inativo' } });
conferir('Semeador desativado perde o acesso na hora', (await req(ADM, '/perfil/painel', { token: semN2.token })).status === 401);

// ---------- 5. Parceiro ----------
const fonePar = fone('6367');
const par = (await req(ADM, '/parceiros', { method: 'POST', token: tokAdm, json: { nome: 'Parceiro Perfil Teste', whatsapp: fonePar, ativo: true } })).dados;
const sp = await entrarComo(fonePar, 'parceiro');
const pPar = (await req(ADM, '/perfil/painel', { token: sp.token })).dados;
conferir('Parceiro entra no portal dele (saldo e campanhas)', pPar.parceiro?.nome === 'Parceiro Perfil Teste' && 'saldo' in pPar.parceiro);

// ---------- 6. Movimentações (lista única) ----------
const mov = await req(ADM, '/movimentacoes?status=a_pagar', { token: tokAdm });
conferir('Movimentações: lista única com filtros (só administradores)', mov.status === 200 && typeof mov.dados.total === 'number' && (await req(ADM, '/movimentacoes', { token: sEq.token })).status === 403);

// ---------- limpeza ----------
await req(ADM, `/admins/${ed.id}`, { method: 'DELETE', token: tokAdm });
apagarIgreja(db, temp.id);
apagarIgreja(db, igrejaNova.dados.id);
db.prepare('DELETE FROM semeadores WHERE id IN (?, ?)').run(n2.dados.id, n1.id);
db.prepare('DELETE FROM parceiros WHERE id = ?').run(par.id);
apagarContas(db, ...(db.prepare("SELECT id FROM usuarios WHERE nome = 'Teste' AND criado_em > datetime('now', '-1 hour')").all() as any[]).map((u) => u.id));
db.prepare("DELETE FROM otps WHERE whatsapp LIKE 'painel:%'").run();
limpar();

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
