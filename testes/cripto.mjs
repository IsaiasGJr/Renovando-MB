// Teste da criptografia de CPF e WhatsApp.
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
const db = new DatabaseSync(dbPath);
const abertos = (tabela, coluna) =>
  db.prepare(`SELECT COUNT(*) n FROM ${tabela} WHERE ${coluna} <> '' AND ${coluna} NOT LIKE 'v1:%' AND ${coluna} NOT LIKE 'excluido:%'`).get().n;

// 1. Nada aberto no banco
for (const [t, c] of [['usuarios', 'whatsapp'], ['semeadores', 'whatsapp'], ['semeadores', 'cpf'], ['igrejas', 'pastor_whatsapp'], ['solicitacoes_show', 'whatsapp']]) {
  conferir(`banco: ${t}.${c} sem valores abertos`, abertos(t, c) === 0);
}
conferir('banco: todo usuário tem índice de busca', db.prepare('SELECT COUNT(*) n FROM usuarios WHERE whatsapp_indice IS NULL').get().n === 0);
conferir('banco: códigos de login não guardam o número', db.prepare('SELECT COUNT(*) n FROM otps WHERE length(whatsapp) <> 64').get().n === 0);

// 2. Conta existente: entrar de novo acha a MESMA conta, com os cupons (igreja temporária do teste)
const igrejaT = await igrejaTemporaria(db, envAdmin);
const foneDemo = `6392${String(Date.now()).slice(-7)}`;
const entrar = async (extra = {}) => {
  await req(API, '/auth/codigo', { method: 'POST', json: { whatsapp: foneDemo } });
  return (await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: foneDemo, codigo: '123456', ...extra } })).dados;
};
const s0 = await entrar({ nome: 'Ofertante', sobrenome: 'Busca Cripto' });
const of0 = (await req(API, '/ofertas', { method: 'POST', token: s0.token, json: { igrejaId: igrejaT.id, quantidade: 2, anonima: false } })).dados;
await req(API, `/dev/ofertas/${of0.id}/pagar`, { method: 'POST' });
const s1 = await entrar();
conferir('login de conta existente encontra a mesma conta', s1.usuario?.id === s0.usuario.id && s1.usuario?.whatsapp === foneDemo, `${s1.usuario?.nome} ${s1.usuario?.sobrenome}`);
const cupons = (await req(API, '/me/cupons', { token: s1.token })).dados;
conferir('conta mantém os cupons', Array.isArray(cupons) && cupons.length === 2, `${cupons.length} cupons`);

// 3. Conta nova: gravada cifrada, mas o dono recebe o número aberto
const fone = `6391${String(Date.now()).slice(-7)}`;
await req(API, '/auth/codigo', { method: 'POST', json: { whatsapp: fone } });
const s2 = (await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: fone, codigo: '123456', nome: 'Cripto', sobrenome: 'Teste' } })).dados;
const bruto = db.prepare('SELECT whatsapp FROM usuarios WHERE id = ?').get(s2.usuario.id).whatsapp;
conferir('conta nova gravada cifrada', bruto.startsWith('v1:') && !bruto.includes(fone));
conferir('o próprio dono recebe o número aberto', s2.usuario.whatsapp === fone);
const s3 = (await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: fone, codigo: '000000' } }));
conferir('código errado continua sendo recusado', s3.status === 400);

// 4. Semeador: CPF e WhatsApp cifrados no banco, legíveis no admin
const cpfTeste = '00000000191';
const foneSem = `6390${String(Date.now()).slice(-7)}`;
await req(API, '/semeadores', { method: 'POST', json: { nome: 'Semeador', sobrenome: 'Cifrado', whatsapp: foneSem, cpf: cpfTeste, chavePix: 'teste@exemplo.com' } });
const semBruto = db.prepare("SELECT id, whatsapp, cpf FROM semeadores WHERE sobrenome = 'Cifrado' ORDER BY criado_em DESC").get();
conferir('semeador: CPF e WhatsApp cifrados no banco', semBruto.cpf.startsWith('v1:') && semBruto.whatsapp.startsWith('v1:') && !semBruto.cpf.includes(cpfTeste));
const tokAdm = (await req(ADM, '/login', { method: 'POST', json: { email: envAdmin.ADMIN_EMAIL, senha: envAdmin.ADMIN_SENHA } })).dados.token;
const semAdmin = (await req(ADM, `/semeadores/${semBruto.id}`, { token: tokAdm })).dados;
conferir('admin vê CPF e WhatsApp decifrados', semAdmin.cpf === cpfTeste && semAdmin.whatsapp === foneSem);

// 5. Edição pelo admin: grava cifrado, auditoria sem o valor
const novoFone = `6389${String(Date.now()).slice(-7)}`;
await req(ADM, `/semeadores/${semBruto.id}`, { method: 'PUT', token: tokAdm, json: { whatsapp: novoFone } });
const depois = db.prepare('SELECT whatsapp, cpf FROM semeadores WHERE id = ?').get(semBruto.id);
conferir('edição no admin grava cifrado e não estraga o CPF', depois.whatsapp.startsWith('v1:') && depois.cpf === semBruto.cpf);
const aud = db.prepare("SELECT detalhes FROM auditoria WHERE registro_id = ? AND acao = 'editar' ORDER BY criado_em DESC").get(semBruto.id);
conferir('auditoria não guarda o número (só ***)', aud && !aud.detalhes.includes(novoFone) && !aud.detalhes.includes(foneSem) && aud.detalhes.includes('***'));
await req(ADM, `/semeadores/${semBruto.id}`, { method: 'DELETE', token: tokAdm });
const audDel = db.prepare("SELECT detalhes FROM auditoria WHERE registro_id = ? AND acao = 'excluir'").get(semBruto.id);
conferir('auditoria de exclusão sem CPF/WhatsApp', audDel && !audDel.detalhes.includes(cpfTeste) && !audDel.detalhes.includes('v1:'));

// 6. Admin: igrejas e ofertantes decifrados; busca por número completo
const igrejas = (await req(ADM, '/igrejas', { token: tokAdm })).dados;
const daIgreja = igrejas.find((i) => i.id === igrejaT.id);
conferir('admin vê WhatsApp do pastor decifrado', daIgreja?.pastorWhatsapp === igrejaT.pastorWhatsapp);
const porNumero = (await req(ADM, `/usuarios?busca=${foneDemo}`, { token: tokAdm })).dados;
conferir('busca de ofertante pelo número completo', porNumero.length === 1 && porNumero[0].whatsapp === foneDemo);
const porNome = (await req(ADM, `/usuarios?busca=busca%20cripto`, { token: tokAdm })).dados;
conferir('busca de ofertante pelo nome', porNome.some((u) => u.whatsapp === foneDemo));
const csv = await fetch(`${ADM}/relatorios/ofertas.csv`, { headers: { Authorization: `Bearer ${tokAdm}` } }).then((x) => x.text());
conferir('planilha CSV com WhatsApp legível (não cifrado)', !csv.includes('v1:') && csv.includes(foneDemo));

// limpeza: igreja temporária e contas de teste
apagarIgreja(db, igrejaT.id);
apagarContas(db, s0.usuario.id, s2.usuario.id);

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
