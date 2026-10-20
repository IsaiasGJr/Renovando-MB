// Testes das funcionalidades novas (página da igreja, banners, artistas, contato, parcerias, painéis, páginas legais).
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { apagarContas } from './_apoio.mjs';

const [envAdminPath, dbPath] = process.argv.slice(2);
const envAdmin = Object.fromEntries(readFileSync(envAdminPath, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.trim().split(/=(.*)/s).slice(0, 2)));
const API = 'http://localhost:3333/api';
const ADM = 'http://localhost:4000/api';
let ok = 0, falhas = 0;
const conferir = (n, c, x = '') => { c ? ok++ : falhas++; console.log(`${c ? 'OK  ' : 'FALHOU'} ${n}${x ? ` (${x})` : ''}`); };
async function req(base, caminho, { method = 'GET', json, token, body } = {}) {
  const h = {};
  if (token) h.Authorization = `Bearer ${token}`;
  if (json !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(base + caminho, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : body });
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, dados: d, headers: r.headers };
}
const db = new DatabaseSync(dbPath);
db.prepare('DELETE FROM limites').run(); // ambiente de teste: zera contadores de tentativas
const tokAdm = (await req(ADM, '/login', { method: 'POST', json: { email: envAdmin.ADMIN_EMAIL, senha: envAdmin.ADMIN_SENHA } })).dados.token;
const login = async (fone, nome) => {
  await req(API, '/auth/codigo', { method: 'POST', json: { whatsapp: fone } });
  return (await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: fone, codigo: '123456', nome } })).dados.token;
};
const sufixo = String(Date.now()).slice(-7);

// 1. Página da igreja
const igrejas = (await req(API, '/igrejas')).dados;
conferir('igrejas trazem endereço (slug) e logo', igrejas.every((i) => i.slug) && igrejas.every((i) => 'logoUrl' in i));
const pag = await req(API, `/igrejas/${igrejas[0].slug}`);
conferir('página pública da igreja', pag.status === 200 && pag.dados.nome === igrejas[0].nome);
const pendente = db.prepare("SELECT slug FROM igrejas WHERE status = 'pendente' LIMIT 1").get();
conferir('igreja pendente não tem página pública', !pendente || (await req(API, `/igrejas/${pendente.slug}`)).status === 404);
const linkWeb = await fetch(`http://localhost:3333/igreja/${igrejas[0].slug}`).then((r) => r.text());
conferir('link compartilhável abre o app na igreja', linkWeb.includes(`renovando://igreja/${igrejas[0].slug}`));

// 2. Banners, parceiros, galeria, páginas legais
conferir('banners publicados', (await req(API, '/banners')).dados.length >= 1);
const novoBanner = await req(ADM, '/banners', { method: 'POST', token: tokAdm, json: { titulo: 'Banner teste', link: 'javascript:alert(1)' } });
conferir('banner com link perigoso é recusado', novoBanner.status === 400);
conferir('parceiros publicados', (await req(API, '/parceiros')).dados.length >= 1);
const priv = (await req(API, '/paginas/privacidade')).dados;
conferir('política de privacidade publicada', priv.titulo === 'Política de Privacidade' && priv.conteudo.length > 200);
conferir('termos de uso publicados', (await req(API, '/paginas/termos')).status === 200);

// 3. Artista: biografia + galeria pelo admin, página pública
const artistas = (await req(ADM, '/artistas', { token: tokAdm })).dados;
const art = artistas[0];
await req(ADM, `/artistas/${art.id}`, { method: 'PUT', token: tokAdm, json: { bio: 'Biografia de teste.', galeria: ['/uploads/a.png', '/uploads/b.png'] } });
const artPub = (await req(API, `/artistas/${art.slug}`)).dados;
conferir('página do artista com biografia e galeria', artPub.bio === 'Biografia de teste.' && artPub.galeria.length === 2);
await req(ADM, `/artistas/${art.id}`, { method: 'PUT', token: tokAdm, json: { bio: art.bio, galeria: art.galeria } }); // devolve como estava

// 4. Fale conosco com anexo
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
let fd = new FormData(); fd.append('arquivo', new Blob([pdf], { type: 'application/pdf' }), 'proposta.pdf');
const anexo = await req(API, '/contato/anexos', { method: 'POST', body: fd });
conferir('anexo PDF aceito', anexo.status === 201 && anexo.dados.arquivo.endsWith('.pdf'));
fd = new FormData(); fd.append('arquivo', new Blob(['<script>x</script>'], { type: 'application/pdf' }), 'falso.pdf');
conferir('arquivo disfarçado de PDF é recusado', (await req(API, '/contato/anexos', { method: 'POST', body: fd })).status === 400);
conferir('anexo NÃO fica público', (await fetch(`http://localhost:3333/uploads/${anexo.dados.arquivo}`)).status === 404);
const foneContato = `6386${sufixo}`;
const contato = await req(API, '/contato', { method: 'POST', json: { nome: 'Contato', sobrenome: 'Teste', whatsapp: foneContato, mensagem: 'Mensagem de teste do Fale conosco.', anexos: [anexo.dados] } });
conferir('mensagem enviada', contato.status === 201);
const msgs = (await req(ADM, '/mensagens?status=nova', { token: tokAdm })).dados;
const msg = msgs.find((m) => m.mensagem === 'Mensagem de teste do Fale conosco.');
conferir('admin vê a mensagem com WhatsApp e anexo', msg && msg.whatsapp === foneContato && msg.anexos.length === 1);
conferir('WhatsApp da mensagem cifrado no banco', db.prepare('SELECT whatsapp FROM mensagens WHERE id = ?').get(msg.id).whatsapp.startsWith('v1:'));
const down = await fetch(`${ADM}/anexos/${anexo.dados.arquivo}`, { headers: { Authorization: `Bearer ${tokAdm}` } });
conferir('admin baixa o anexo', down.status === 200 && (await down.text()).startsWith('%PDF'));
conferir('anexo sem login é negado', (await fetch(`${ADM}/anexos/${anexo.dados.arquivo}`)).status === 401);
conferir('dashboard conta mensagens novas', (await req(ADM, '/dashboard', { token: tokAdm })).dados.pendencias.mensagens >= 1);
await req(ADM, `/mensagens/${msg.id}`, { method: 'DELETE', token: tokAdm });

// 5. Painel do pastor
const fonePastor = `6385${sufixo}`;
const nova = await req(API, '/igrejas', { method: 'POST', json: { razaoSocial: 'Igreja Painel Teste', nomeFantasia: 'Igreja Painel Teste', cidade: 'Palmas', uf: 'TO', tipoChavePix: 'email', chavePix: 'painel@exemplo.com', pastorNome: 'Pastor Painel', pastorWhatsapp: fonePastor } });
const igrejaNova = db.prepare("SELECT id, slug FROM igrejas WHERE nome_fantasia = 'Igreja Painel Teste' ORDER BY criado_em DESC").get();
const tokPastor = await login(fonePastor, 'Pastor');
let painel = (await req(API, '/me/painel', { token: tokPastor })).dados;
conferir('pastor vê a igreja em análise no painel', painel.igrejas?.some((i) => i.id === igrejaNova.id && i.status === 'pendente'), `status=${nova.status}`);
await req(ADM, `/igrejas/${igrejaNova.id}`, { method: 'PUT', token: tokAdm, json: { status: 'ativa' } });
const tokOfertante = await login(`6384${sufixo}`, 'Ofertante');
const of = (await req(API, '/ofertas', { method: 'POST', token: tokOfertante, json: { igrejaId: igrejaNova.id, quantidade: 5, anonima: false } })).dados;
await req(API, `/dev/ofertas/${of.id}/pagar`, { method: 'POST' });
painel = (await req(API, '/me/painel', { token: tokPastor })).dados;
const minha = painel.igrejas.find((i) => i.id === igrejaNova.id);
conferir('painel do pastor soma oferta e repasse', minha.arrecadado === 100 && minha.repasse === 80 && minha.cupons === 5, `arrecadado=${minha.arrecadado} repasse=${minha.repasse}`);
conferir('ofertante comum não vê igreja nenhuma', (await req(API, '/me/painel', { token: tokOfertante })).dados.igrejas.length === 0);

// 6. Painel do semeador + vínculo pelo código
const foneSem = `6383${sufixo}`;
await req(API, '/semeadores', { method: 'POST', json: { nome: 'Semeador', sobrenome: 'Painel', whatsapp: foneSem, cpf: '00000000191', chavePix: 'sem@exemplo.com' } });
const sem = db.prepare("SELECT id, codigo FROM semeadores WHERE sobrenome = 'Painel' ORDER BY criado_em DESC").get();
await req(ADM, `/semeadores/${sem.id}`, { method: 'PUT', token: tokAdm, json: { status: 'ativo' } });
await req(ADM, `/igrejas/${igrejaNova.id}`, { method: 'PUT', token: tokAdm, json: { semeadorId: sem.id } });
const tokSem = await login(foneSem, 'Semeador');
const ps = (await req(API, '/me/painel', { token: tokSem })).dados.semeador;
conferir('painel do semeador: código, igreja vinculada e comissão', ps && ps.codigo === sem.codigo && ps.igrejas.length === 1 && ps.comissao === 7, `comissao=${ps?.comissao}`);
const conv = await fetch(`http://localhost:3333/indicacao/${sem.codigo}`).then((r) => r.text());
conferir('link de indicação abre o cadastro com o código', conv.includes(`renovando://cadastro-igreja?ref=${sem.codigo}`));

// limpeza
for (const t of [tokPastor, tokOfertante, tokSem]) await req(API, '/me', { method: 'DELETE', token: t, json: { confirmacao: 'EXCLUIR' } });
apagarContas(db, ...db.prepare("SELECT id FROM usuarios WHERE excluido_em IS NOT NULL").all().map((u) => u.id));
// Apaga tudo o que o teste criou (igreja, oferta, cupons e semeador), para não sujar o sistema.
db.prepare('DELETE FROM cupons WHERE oferta_id IN (SELECT id FROM ofertas WHERE igreja_id = ?)').run(igrejaNova.id);
db.prepare('DELETE FROM ofertas WHERE igreja_id = ?').run(igrejaNova.id);
db.prepare('DELETE FROM igrejas WHERE id = ?').run(igrejaNova.id);
db.prepare('DELETE FROM semeadores WHERE id = ?').run(sem.id);
db.prepare('DELETE FROM limites').run();

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
