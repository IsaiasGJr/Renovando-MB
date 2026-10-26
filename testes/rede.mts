// Testes da rede de semeadores (N1/N2), parceiro, repasses (saldo e pagamentos registrados), aprovações,
// detalhe e registro manual de oferta, formato das artes e resumo de sorteios.
// Nada aqui transfere dinheiro: o sistema só calcula e registra. Tudo o que o teste cria é apagado no fim.
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import { apagarContas, apagarIgreja, igrejaTemporaria } from './_apoio.mjs';

const [envAdminPath, dbPath] = process.argv.slice(2);
const envAdmin = Object.fromEntries(readFileSync(envAdminPath, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.trim().split(/=(.*)/s).slice(0, 2)));
const API = 'http://localhost:3333/api';
const ADM = 'http://localhost:4000/api';
let ok = 0, falhas = 0;
const conferir = (n: string, c: unknown, x = '') => { c ? ok++ : falhas++; console.log(`${c ? 'OK  ' : 'FALHOU'} ${n}${x ? ` (${x})` : ''}`); };
async function req(base: string, caminho: string, { method = 'GET', json, token, body }: { method?: string; json?: unknown; token?: string; body?: FormData } = {}) {
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  if (json !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(base + caminho, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : body });
  const t = await r.text();
  let d: any; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, dados: d };
}
const db = new DatabaseSync(dbPath);
const limpar = () => db.prepare('DELETE FROM limites').run();
const centavos = (v: number) => Math.round(v * 100);
const sufixo = () => String(Date.now() + Math.floor(Math.random() * 1000)).slice(-7);

limpar();
const tokAdm = (await req(ADM, '/login', { method: 'POST', json: { email: envAdmin.ADMIN_EMAIL, senha: envAdmin.ADMIN_SENHA } })).dados.token;
const entrarApp = async (fone: string, nome = 'Teste') => {
  await req(API, '/auth/codigo', { method: 'POST', json: { whatsapp: fone } });
  return (await req(API, '/auth/verificar', { method: 'POST', json: { whatsapp: fone, codigo: '123456', nome } })).dados;
};
const criados = { semeadores: [] as string[], usuarios: [] as string[], igrejas: [] as string[], parceiro: '' };

// ---------- 1. Rede: N1 aprova, N2 entra pelo convite do N1, N2 não convida ----------
const foneN1 = `6378${sufixo()}`;
await req(API, '/semeadores', { method: 'POST', json: { nome: 'Rede', sobrenome: 'Nivel Um', whatsapp: foneN1, cpf: '00000000191', chavePix: 'n1@exemplo.com' } });
const n1 = db.prepare("SELECT id, codigo FROM semeadores WHERE sobrenome = 'Nivel Um' ORDER BY criado_em DESC").get() as { id: string; codigo: string };
criados.semeadores.push(n1.id);
const apr = (await req(ADM, '/aprovacoes', { token: tokAdm })).dados;
conferir('Aprovações: lista o semeador pendente (como N1)', apr.semeadores.some((x: any) => x.id === n1.id && x.nivel === 1));
conferir('Aprovações: aprovar', (await req(ADM, `/aprovacoes/semeadores/${n1.id}`, { method: 'POST', token: tokAdm, json: { acao: 'aprovar' } })).dados.status === 'ativo');
conferir('Aprovações: não analisa o mesmo cadastro duas vezes', (await req(ADM, `/aprovacoes/semeadores/${n1.id}`, { method: 'POST', token: tokAdm, json: { acao: 'rejeitar' } })).status === 409);

limpar();
const foneN2 = `6377${sufixo()}`;
await req(API, '/semeadores', { method: 'POST', json: { nome: 'Rede', sobrenome: 'Nivel Dois', whatsapp: foneN2, cpf: '00000000191', chavePix: 'n2@exemplo.com', codigoIndicacao: n1.codigo } });
const n2 = db.prepare("SELECT id, codigo, pai_id FROM semeadores WHERE sobrenome = 'Nivel Dois' ORDER BY criado_em DESC").get() as { id: string; codigo: string; pai_id: string };
criados.semeadores.push(n2.id);
conferir('Convite: semeador entra como N2 do N1', n2.pai_id === n1.id);
await req(ADM, `/aprovacoes/semeadores/${n2.id}`, { method: 'POST', token: tokAdm, json: { acao: 'aprovar' } });
const n3 = await req(API, '/semeadores', { method: 'POST', json: { nome: 'Rede', sobrenome: 'Nivel Tres', whatsapp: `6376${sufixo()}`, cpf: '00000000191', chavePix: 'n3@exemplo.com', codigoIndicacao: n2.codigo } });
conferir('Convite: N2 não pode convidar (rede de 2 níveis)', n3.status === 400 && /N2/.test(n3.dados.erro));
const listaSem = (await req(ADM, '/semeadores', { token: tokAdm })).dados as any[];
const n2Adm = listaSem.find((x) => x.id === n2.id);
conferir('Admin: semeador mostra nível e quem indicou', n2Adm?.nivel === 2 && n2Adm?.indicadoPor === 'Rede Nivel Um' && listaSem.find((x) => x.id === n1.id)?.n2 === 1);
conferir('Admin: N2 não pode ficar abaixo de outro N2', (await req(ADM, `/semeadores/${n1.id}`, { method: 'PUT', token: tokAdm, json: { paiId: n2.id } })).status === 400);

// ---------- 2. Parceiro da campanha ----------
const fonePar = `6375${sufixo()}`;
const par = (await req(ADM, '/parceiros', { method: 'POST', token: tokAdm, json: { nome: 'Parceiro Teste Rede', whatsapp: fonePar, chavePix: 'parceiro@exemplo.com', tipoChavePix: 'email', ativo: false } })).dados;
criados.parceiro = par.id;
const parBruto = db.prepare('SELECT whatsapp, chave_pix FROM parceiros WHERE id = ?').get(par.id) as { whatsapp: string; chave_pix: string };
conferir('Parceiro: WhatsApp e chave PIX cifrados no banco', parBruto.whatsapp.startsWith('v1:') && parBruto.chave_pix.startsWith('v1:'));
await req(ADM, `/parceiros/${par.id}`, { method: 'PUT', token: tokAdm, json: { ativo: true } });
const campanhas = (await req(ADM, '/campanhas', { token: tokAdm })).dados as any[];
const camp = campanhas.find((c) => c.ativa);
const parceiroOriginal = camp.parceiroId ?? null;
await req(ADM, `/campanhas/${camp.id}`, { method: 'PUT', token: tokAdm, json: { parceiroId: par.id } });

// ---------- 3. Ofertas e repasses ----------
const igA = await igrejaTemporaria(db, envAdmin);
const igB = await igrejaTemporaria(db, envAdmin);
criados.igrejas.push(igA.id, igB.id);
await req(ADM, `/igrejas/${igA.id}`, { method: 'PUT', token: tokAdm, json: { semeadorId: n1.id } });
await req(ADM, `/igrejas/${igB.id}`, { method: 'PUT', token: tokAdm, json: { semeadorId: n2.id } });
limpar();
const ofertante = await entrarApp(`6374${sufixo()}`, 'Ofertante');
criados.usuarios.push(ofertante.usuario.id);
const ofertar = async (igrejaId: string, quantidade: number) => {
  const o = (await req(API, '/ofertas', { method: 'POST', token: ofertante.token, json: { igrejaId, quantidade, anonima: false } })).dados;
  await req(API, `/dev/ofertas/${o.id}/pagar`, { method: 'POST' });
  return o;
};
const oA = await ofertar(igA.id, 5); // R$ 100
const oB = await ofertar(igB.id, 3); // R$ 60
const lanc = (ofertaId: string) => db.prepare('SELECT beneficiario_tipo AS tipo, beneficiario_id AS id, papel, percentual, valor FROM lancamentos WHERE oferta_id = ?').all(ofertaId) as any[];
const lA = lanc(oA.id), lB = lanc(oB.id);
const soma = (l: any[]) => l.reduce((s, x) => s + centavos(x.valor), 0);
conferir('Repasses: a soma dos lançamentos é exatamente o valor da oferta', soma(lA) === centavos(oA.valor) && soma(lB) === centavos(oB.valor), `${soma(lA) / 100} / ${soma(lB) / 100}`);
const pct = (d: any[], tipo: string) => d.find((x: any) => x.tipo === tipo)?.percentual ?? 0;
const semN2 = camp.divisao, comN2 = camp.divisaoN2;
const deA = (tipo: string, id: string | null) => lA.filter((x) => x.tipo === tipo && x.id === id).reduce((s, x) => s + x.valor, 0);
conferir('Repasses sem N2: igreja recebe a parte dela', centavos(deA('igreja', igA.id)) === Math.floor(oA.valor * pct(semN2, 'igreja')), `${deA('igreja', igA.id)}`);
conferir('Repasses sem N2: o N1 recebe a parte de semeador', centavos(deA('semeador', n1.id)) === Math.floor(oA.valor * pct(semN2, 'semeador_n1')));
conferir('Repasses: o parceiro da campanha recebe a parte dele', centavos(deA('parceiro', par.id)) === Math.floor(oA.valor * pct(semN2, 'parceiro')));
const deB = (tipo: string, id: string | null) => lB.filter((x) => x.tipo === tipo && x.id === id).reduce((s, x) => s + x.valor, 0);
conferir('Repasses com N2: usa a regra "com N2" gravada na oferta', (JSON.parse((db.prepare('SELECT divisao_json FROM ofertas WHERE id = ?').get(oB.id) as any).divisao_json) as any[]).some((x) => x.tipo === 'semeador_n2'));
conferir('Repasses com N2: o N2 recebe a parte de N2', centavos(deB('semeador', n2.id)) === Math.floor(oB.valor * pct(comN2, 'semeador_n2')), `${deB('semeador', n2.id)}`);
conferir('Repasses com N2: o N1 que trouxe o N2 recebe a parte de N1', centavos(deB('semeador', n1.id)) === Math.floor(oB.valor * pct(comN2, 'semeador_n1')), `${deB('semeador', n1.id)}`);

// ---------- 4. Painéis no app (saldo, rede, parceiro) ----------
limpar();
const appN1 = await entrarApp(foneN1, 'N1');
criados.usuarios.push(appN1.usuario.id);
const painelN1 = (await req(API, '/me/painel', { token: appN1.token })).dados;
const esperadoN1 = deA('semeador', n1.id) + deB('semeador', n1.id);
conferir('Painel N1: nível, rede com o N2 e saldo a receber', painelN1.semeador?.nivel === 1 && painelN1.semeador.rede.length === 1 && centavos(painelN1.semeador.saldo.aReceber) === centavos(esperadoN1), `${painelN1.semeador?.saldo?.aReceber}`);
conferir('Painel N1: a rede não mostra dados pessoais do N2', !JSON.stringify(painelN1.semeador.rede).includes(foneN2) && painelN1.semeador.rede[0].nome === 'Rede N.');
const appPar = await entrarApp(fonePar, 'Parceiro');
criados.usuarios.push(appPar.usuario.id);
const painelPar = (await req(API, '/me/painel', { token: appPar.token })).dados;
conferir('Painel do parceiro: campanha vinculada e saldo', painelPar.parceiro?.campanhas.length >= 1 && centavos(painelPar.parceiro.saldo.aReceber) > 0);
conferir('Painel do parceiro: movimentações sem dados de quem ofertou', !JSON.stringify(painelPar.parceiro.movimentacoes).includes('Ofertante'));

// ---------- 5. Registrar pagamento (só registro) ----------
const repasses = (await req(ADM, '/repasses', { token: tokAdm })).dados as any[];
const linhaN1 = repasses.find((r) => r.beneficiarioTipo === 'semeador' && r.beneficiarioId === n1.id);
conferir('Repasses no admin: N1 aparece com o valor a pagar e a chave PIX', linhaN1 && centavos(linhaN1.aPagar) === centavos(esperadoN1) && linhaN1.chavePix === 'n1@exemplo.com');
conferir('Repasses: exige a referência do pagamento', (await req(ADM, `/repasses/semeador/${n1.id}/pagar`, { method: 'POST', token: tokAdm, json: { referencia: '' } })).status === 400);
const pago = await req(ADM, `/repasses/semeador/${n1.id}/pagar`, { method: 'POST', token: tokAdm, json: { referencia: 'COMPROVANTE-TESTE-1' } });
conferir('Repasses: registra o pagamento do saldo', pago.status === 200 && centavos(pago.dados.valor) === centavos(esperadoN1));
const det = (await req(ADM, `/repasses/semeador/${n1.id}`, { token: tokAdm })).dados;
conferir('Repasses: saldo zera e vira "recebido"', det.saldo.aReceber === 0 && centavos(det.saldo.recebido) === centavos(esperadoN1) && det.pagamentos[0].referencia === 'COMPROVANTE-TESTE-1');
conferir('Repasses: sem saldo não registra de novo', (await req(ADM, `/repasses/semeador/${n1.id}/pagar`, { method: 'POST', token: tokAdm, json: { referencia: 'X-2' } })).status === 400);

// ---------- 6. Oferta: detalhe, cupons e registro manual ----------
const detalhe = (await req(ADM, `/ofertas/${oA.id}`, { token: tokAdm })).dados;
conferir('Oferta: detalhe com cupons e divisão', detalhe.cupons.length === 5 && detalhe.divisao.length >= 3 && detalhe.ofertante.startsWith('Ofertante'));
const csv = await fetch(`${ADM}/ofertas/${oA.id}/cupons.csv`, { headers: { Authorization: `Bearer ${tokAdm}` } }).then((r) => r.text());
conferir('Oferta: exporta os cupons em planilha', csv.split('\n').length === 6 && csv.includes('numero;emitido_em'));
const foneManual = `6373${sufixo()}`;
conferir('Oferta manual: exige dizer como foi recebida', (await req(ADM, '/ofertas/manual', { method: 'POST', token: tokAdm, json: { igrejaId: igA.id, quantidade: 2, whatsapp: foneManual } })).status === 400);
const manual = await req(ADM, '/ofertas/manual', { method: 'POST', token: tokAdm, json: { igrejaId: igA.id, quantidade: 2, nome: 'Maria', sobrenome: 'Manual', whatsapp: foneManual, observacao: 'Dinheiro no culto de domingo (teste)' } });
conferir('Oferta manual: entra paga, com números da sorte e repasses', manual.status === 201 && manual.dados.numeros.length === 2 && lanc(manual.dados.id).length >= 3);
const uManual = db.prepare('SELECT id, whatsapp FROM usuarios WHERE id = (SELECT usuario_id FROM ofertas WHERE id = ?)').get(manual.dados.id) as { id: string; whatsapp: string };
criados.usuarios.push(uManual.id);
conferir('Oferta manual: pessoa nova criada com WhatsApp cifrado', uManual.whatsapp.startsWith('v1:'));
conferir('Oferta manual: marcada como manual, com quem registrou', (db.prepare('SELECT origem, registrada_por FROM ofertas WHERE id = ?').get(manual.dados.id) as any).origem === 'manual');

// Editor não mexe em dinheiro
limpar();
const emailEd = `editor.rede.${Date.now()}@renovando.local`;
const senhaEd = randomBytes(18).toString('base64url');
const ed = (await req(ADM, '/admins', { method: 'POST', token: tokAdm, json: { nome: 'Editor Rede', email: emailEd, senha: senhaEd, papel: 'editor', ativo: true } })).dados;
const tokEd = (await req(ADM, '/login', { method: 'POST', json: { email: emailEd, senha: senhaEd } })).dados.token;
conferir('Editor não vê repasses nem registra pagamento', (await req(ADM, '/repasses', { token: tokEd })).status === 403 && (await req(ADM, `/repasses/igreja/${igA.id}/pagar`, { method: 'POST', token: tokEd, json: { referencia: 'X-123' } })).status === 403);
conferir('Editor não registra oferta manual', (await req(ADM, '/ofertas/manual', { method: 'POST', token: tokEd, json: { igrejaId: igA.id, quantidade: 1, anonima: true, observacao: 'teste' } })).status === 403);
await req(ADM, `/admins/${ed.id}`, { method: 'DELETE', token: tokAdm });

// ---------- 7. Recusa com motivo ----------
limpar();
await req(API, '/semeadores', { method: 'POST', json: { nome: 'Rede', sobrenome: 'Recusado', whatsapp: `6372${sufixo()}`, cpf: '00000000191', chavePix: 'r@exemplo.com' } });
const rec = db.prepare("SELECT id FROM semeadores WHERE sobrenome = 'Recusado' ORDER BY criado_em DESC").get() as { id: string };
criados.semeadores.push(rec.id);
await req(ADM, `/aprovacoes/semeadores/${rec.id}`, { method: 'POST', token: tokAdm, json: { acao: 'rejeitar', motivo: 'Dados incompletos (teste)' } });
const recDb = db.prepare('SELECT status, observacao FROM semeadores WHERE id = ?').get(rec.id) as any;
conferir('Recusa guarda o motivo', recDb.status === 'rejeitado' && recDb.observacao === 'Dados incompletos (teste)');

// ---------- 8. Formato das artes, sorteios e meta ----------
const enviar = async (largura: number, altura: number, finalidade: string) => {
  const img = await sharp({ create: { width: largura, height: altura, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const fd = new FormData(); fd.append('arquivo', new Blob([img], { type: 'image/png' }), 'arte.png');
  return req(ADM, `/upload?finalidade=${finalidade}`, { method: 'POST', token: tokAdm, body: fd });
};
const errada = await enviar(800, 800, 'panfleto');
conferir('Artes: panfleto no formato errado é recusado com explicação', errada.status === 400 && /1200 × 470/.test(errada.dados.erro));
const certa = await enviar(1200, 470, 'panfleto');
conferir('Artes: panfleto 1200 × 470 é aceito', certa.status === 201);
conferir('Artes: cupom 640 × 930 é aceito', (await enviar(640, 930, 'cupom')).status === 201);
const sorteios = (await req(ADM, '/sorteios/resumo', { token: tokAdm })).dados;
conferir('Sorteios: resumo (total, pendentes, distribuídos)', sorteios.total >= 1 && sorteios.total === sorteios.pendentes + sorteios.distribuidos);
await req(ADM, `/campanhas/${camp.id}`, { method: 'PUT', token: tokAdm, json: { metaOfertas: 1000000 } });
conferir('Meta de ofertas aparece no painel', (await req(ADM, '/dashboard', { token: tokAdm })).dados.meta === 1000000);

// ---------- limpeza ----------
await req(ADM, `/campanhas/${camp.id}`, { method: 'PUT', token: tokAdm, json: { parceiroId: parceiroOriginal, metaOfertas: camp.metaOfertas ?? 0 } });
for (const id of criados.igrejas) apagarIgreja(db, id);
apagarContas(db, ...criados.usuarios);
for (const t of ['semeador', 'parceiro']) {
  db.prepare('DELETE FROM pagamentos_repasse WHERE beneficiario_tipo = ? AND beneficiario_id IN (?, ?, ?, ?)').run(t, criados.semeadores[0] ?? '', criados.semeadores[1] ?? '', criados.semeadores[2] ?? '', criados.parceiro);
}
db.prepare('UPDATE semeadores SET pai_id = NULL WHERE pai_id IN (?, ?)').run(criados.semeadores[0], criados.semeadores[1]);
for (const id of criados.semeadores) db.prepare('DELETE FROM semeadores WHERE id = ?').run(id);
db.prepare('DELETE FROM parceiros WHERE id = ?').run(criados.parceiro);
limpar();

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
