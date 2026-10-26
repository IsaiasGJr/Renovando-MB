// Apoio dos testes: nada de mexer em igrejas reais. Cada teste cria a sua igreja temporária
// (pelo cadastro público, então a chave PIX e o WhatsApp ficam cifrados como num cadastro de verdade)
// e, no fim, apaga tudo o que criou.
const API = 'http://localhost:3333/api';
const ADM = 'http://localhost:4000/api';

async function json(url, { method = 'GET', corpo, token } = {}) {
  const h = {};
  if (token) h.Authorization = `Bearer ${token}`;
  if (corpo !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(url, { method, headers: h, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });
  return r.json().catch(() => ({}));
}

/** Cria e aprova uma igreja de teste. Retorna { id, slug, nome, pastorWhatsapp, chavePix }. */
export async function igrejaTemporaria(db, envAdmin, extra = {}) {
  db.prepare('DELETE FROM limites').run(); // o cadastro público tem limite por hora
  const sufixo = `${Date.now()}`.slice(-7);
  const nome = `Igreja Temporária de Teste ${sufixo}`;
  const dados = {
    razaoSocial: nome, nomeFantasia: nome, cidade: 'Palmas', uf: 'TO', tipoChavePix: 'email',
    chavePix: `teste${sufixo}@exemplo.com`, pastorNome: 'Pastor de Teste', pastorWhatsapp: `6380${sufixo}`, ...extra,
  };
  await json(`${API}/igrejas`, { method: 'POST', corpo: dados });
  const linha = db.prepare('SELECT id, slug FROM igrejas WHERE nome_fantasia = ? ORDER BY criado_em DESC').get(nome);
  if (!linha) throw new Error('não foi possível criar a igreja temporária');
  const tok = (await json(`${ADM}/login`, { method: 'POST', corpo: { email: envAdmin.ADMIN_EMAIL, senha: envAdmin.ADMIN_SENHA } })).token;
  await json(`${ADM}/igrejas/${linha.id}`, { method: 'PUT', token: tok, corpo: { status: 'ativa' } });
  return { id: linha.id, slug: linha.slug, nome, pastorWhatsapp: dados.pastorWhatsapp, chavePix: dados.chavePix };
}

/** Apaga a igreja de teste com as ofertas e cupons dela. */
export function apagarIgreja(db, id) {
  db.prepare('UPDATE premios SET ganhador_cupom_id = NULL, ganhador_numero = NULL, ganhador_nome = NULL, ganhador_cidade = NULL, sorteado_em = NULL WHERE ganhador_cupom_id IN (SELECT c.id FROM cupons c JOIN ofertas o ON o.id = c.oferta_id WHERE o.igreja_id = ?)').run(id);
  db.prepare('DELETE FROM lancamentos WHERE oferta_id IN (SELECT id FROM ofertas WHERE igreja_id = ?)').run(id);
  db.prepare('DELETE FROM cupons WHERE oferta_id IN (SELECT id FROM ofertas WHERE igreja_id = ?)').run(id);
  db.prepare('DELETE FROM ofertas WHERE igreja_id = ?').run(id);
  db.prepare('DELETE FROM igrejas WHERE id = ?').run(id);
}

/** Apaga de vez as contas de teste (com ofertas e cupons delas). */
export function apagarContas(db, ...ids) {
  for (const id of ids.filter(Boolean)) {
    db.prepare('DELETE FROM lancamentos WHERE oferta_id IN (SELECT id FROM ofertas WHERE usuario_id = ?)').run(id);
    db.prepare('DELETE FROM cupons WHERE usuario_id = ? OR oferta_id IN (SELECT id FROM ofertas WHERE usuario_id = ?)').run(id, id);
    db.prepare('DELETE FROM ofertas WHERE usuario_id = ?').run(id);
    db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
  }
}
