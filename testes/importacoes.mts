// Testes da importação por planilha: igrejas (WhatsApp do pastor e PIX), semeadores N1/N2 e parceiros.
// Tudo o que o teste cria ou muda é desfeito no fim.
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { apagarIgreja, igrejaTemporaria } from './_apoio.mjs';

const [envAdminPath, dbPath] = process.argv.slice(2);
const envAdmin = Object.fromEntries(readFileSync(envAdminPath, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.trim().split(/=(.*)/s).slice(0, 2)));
const ADM = 'http://localhost:4000/api';
let ok = 0, falhas = 0;
const conferir = (n: string, c: unknown, x = '') => { c ? ok++ : falhas++; console.log(`${c ? 'OK  ' : 'FALHOU'} ${n}${x ? ` (${x})` : ''}`); };
async function req(caminho: string, { method = 'GET', json, token }: { method?: string; json?: unknown; token?: string } = {}) {
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  if (json !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(ADM + caminho, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : undefined });
  const t = await r.text();
  let d: any; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, dados: d };
}
const db = new DatabaseSync(dbPath);
db.prepare('DELETE FROM limites').run();
const tok = (await req('/login', { method: 'POST', json: { email: envAdmin.ADMIN_EMAIL, senha: envAdmin.ADMIN_SENHA } })).dados.token;
const sufixo = () => String(Date.now() + Math.floor(Math.random() * 999)).slice(-7);

// ---------- Modelo ----------
const modelo = await fetch(`${ADM}/importacoes/igrejas/modelo.csv`, { headers: { Authorization: `Bearer ${tok}` } }).then((r) => r.text());
const linhasModelo = modelo.replace(/^﻿/, '').split('\n');
conferir('Modelo de igrejas vem com as igrejas cadastradas', linhasModelo[0].startsWith('endereco;igreja;cidade') && linhasModelo.length >= 76, `${linhasModelo.length - 1} igrejas`);
conferir('Modelo NÃO traz chave PIX nem WhatsApp das igrejas', !modelo.includes('v1:') && !/@/.test(modelo.split('\n').slice(1).map((l) => l.split(';')[6]).join('')));

// ---------- Igrejas ----------
const temp = await igrejaTemporaria(db, envAdmin);
const foneNovo = `6366${sufixo()}`;
const pixAntes = (db.prepare('SELECT chave_pix FROM igrejas WHERE id = ?').get(temp.id) as any).chave_pix;
const csvIg = `endereco;igreja;pastor_whatsapp;tipo_chave_pix;chave_pix\n${temp.slug};${temp.nome};(${foneNovo.slice(0, 2)}) ${foneNovo.slice(2)};;\nnao-existe-123;Igreja X;63999999999;;`;
const sim = await req('/importacoes/igrejas', { method: 'POST', token: tok, json: { csv: csvIg } });
conferir('Conferir mostra o que vai mudar e os erros, sem gravar', sim.dados.atualizar === 1 && sim.dados.erros === 1 && !sim.dados.aplicado
  && (db.prepare('SELECT pastor_whatsapp_indice FROM igrejas WHERE id = ?').get(temp.id) as any).pastor_whatsapp_indice !== null);
const comErro = await req('/importacoes/igrejas', { method: 'POST', token: tok, json: { csv: csvIg, aplicar: true } });
conferir('Planilha com erro NÃO é gravada', comErro.dados.aplicado === false);
const csvOk = `endereco;pastor_whatsapp;tipo_chave_pix;chave_pix\n${temp.slug};${foneNovo};email;novo.pix.teste@exemplo.com`;
const ap = await req('/importacoes/igrejas', { method: 'POST', token: tok, json: { csv: csvOk, aplicar: true } });
const depois = db.prepare('SELECT pastor_whatsapp, chave_pix, tipo_chave_pix FROM igrejas WHERE id = ?').get(temp.id) as any;
conferir('Importa WhatsApp do pastor e chave PIX (cifrados)', ap.dados.aplicado && depois.pastor_whatsapp.startsWith('v1:') && depois.chave_pix.startsWith('v1:') && depois.chave_pix !== pixAntes && depois.tipo_chave_pix === 'email');
db.prepare('DELETE FROM limites').run();
await fetch(`${ADM}/entrar/whatsapp/codigo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ whatsapp: foneNovo }) });
const v = await req('/entrar/whatsapp/verificar', { method: 'POST', json: { whatsapp: foneNovo, codigo: '123456' } });
conferir('Depois da importação o pastor já entra pelo WhatsApp', v.dados.perfis?.some((p: any) => p.tipo === 'pastor'));
const csvVazio = `endereco;pastor_whatsapp\n${temp.slug};`;
conferir('Célula vazia não apaga nada', (await req('/importacoes/igrejas', { method: 'POST', token: tok, json: { csv: csvVazio } })).dados.ignorar === 1);
conferir('Telefone errado vira erro claro', /11 dígitos/.test((await req('/importacoes/igrejas', { method: 'POST', token: tok, json: { csv: `endereco;pastor_whatsapp\n${temp.slug};1234` } })).dados.linhas[0].detalhe));

// ---------- Semeadores (N1 e N2 na mesma planilha, separador ",") ----------
const f1 = `6365${sufixo()}`, f2 = `6364${sufixo()}`;
const csvSem = `nome,sobrenome,whatsapp,cpf,chave_pix,codigo_n1\nImport,Rede Dois,${f2},00000000191,n2@x.com,${f1}\nImport,Rede Um,${f1},00000000191,n1@x.com,\n"Exemplo (apague esta linha)",X,63999990000,00000000000,a@b.com,`;
const sSim = await req('/importacoes/semeadores', { method: 'POST', token: tok, json: { csv: csvSem } });
conferir('Semeadores: confere N1 e N2 da mesma planilha (e ignora o exemplo)', sSim.dados.criar === 2 && sSim.dados.ignorar === 1 && sSim.dados.erros === 0, JSON.stringify(sSim.dados.linhas?.map((l: any) => l.detalhe)));
const sAp = await req('/importacoes/semeadores', { method: 'POST', token: tok, json: { csv: csvSem, aplicar: true } });
const n1 = db.prepare("SELECT id, status, cpf FROM semeadores WHERE sobrenome = 'Rede Um'").get() as any;
const n2 = db.prepare("SELECT id, pai_id FROM semeadores WHERE sobrenome = 'Rede Dois'").get() as any;
conferir('Semeadores: N2 ligado ao N1, ativos e com CPF cifrado', sAp.dados.aplicado && n2?.pai_id === n1?.id && n1.status === 'ativo' && n1.cpf.startsWith('v1:'));
conferir('Semeadores: o mesmo WhatsApp não duplica', (await req('/importacoes/semeadores', { method: 'POST', token: tok, json: { csv: csvSem } })).dados.ignorar === 3);

// ---------- Parceiros ----------
const nomePar = (db.prepare('SELECT nome FROM parceiros ORDER BY ordem LIMIT 1').get() as any).nome;
const antesPar = db.prepare('SELECT whatsapp, whatsapp_indice, chave_pix, tipo_chave_pix FROM parceiros WHERE nome = ?').get(nomePar) as any;
const fp = `6363${sufixo()}`;
const pAp = await req('/importacoes/parceiros', { method: 'POST', token: tok, json: { csv: `parceiro;whatsapp;tipo_chave_pix;chave_pix\n${nomePar};${fp};cnpj;12345678000199`, aplicar: true } });
conferir('Parceiros: atualiza WhatsApp e PIX do parceiro existente', pAp.dados.atualizar === 1 && (db.prepare('SELECT whatsapp FROM parceiros WHERE nome = ?').get(nomePar) as any).whatsapp.startsWith('v1:'));

// ---------- Permissão ----------
db.prepare('DELETE FROM limites').run();
const email = `import.${Date.now()}@renovando.local`, senha = randomBytes(18).toString('base64url');
const ed = (await req('/admins', { method: 'POST', token: tok, json: { nome: 'Editor Import', email, senha, papel: 'editor', ativo: true } })).dados;
const tokEd = (await req('/login', { method: 'POST', json: { email, senha } })).dados.token;
conferir('Editor não importa planilhas', (await req('/importacoes/igrejas', { method: 'POST', token: tokEd, json: { csv: csvOk } })).status === 403);

// ---------- limpeza ----------
await req(`/admins/${ed.id}`, { method: 'DELETE', token: tok });
db.prepare('UPDATE parceiros SET whatsapp = ?, whatsapp_indice = ?, chave_pix = ?, tipo_chave_pix = ? WHERE nome = ?').run(antesPar.whatsapp, antesPar.whatsapp_indice, antesPar.chave_pix, antesPar.tipo_chave_pix, nomePar);
db.prepare('UPDATE semeadores SET pai_id = NULL WHERE id = ?').run(n2?.id ?? '');
db.prepare("DELETE FROM semeadores WHERE sobrenome IN ('Rede Um', 'Rede Dois')").run();
apagarIgreja(db, temp.id);
db.prepare("DELETE FROM otps WHERE whatsapp LIKE 'painel:%'").run();
db.prepare("DELETE FROM auditoria WHERE recurso = 'importacoes' AND criado_em > datetime('now', '-1 hour')").run();
db.prepare('DELETE FROM limites').run();

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
