import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { closeSync, openSync, readSync, unlinkSync } from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { assinar, exigirUsuario, usuarioOpcional } from '../auth.ts';
import { executar, inserir, PASTA_ANEXOS, todos, um } from '../../../compartilhado/src/db.ts';
import {
  buscarOferta,
  campanhaAtiva,
  confirmarPagamento,
  criarOferta,
  cupomParaImagem,
  cuponsDoUsuario,
  excluirConta,
} from '../../../compartilhado/src/dominio.ts';
import { registrar } from '../../../compartilhado/src/auditoria.ts';
import { provedorPix } from '../../../compartilhado/src/pagamentos.ts';
import { TOKEN_VALIDO } from '../../../compartilhado/src/avisos.ts';
import { dataEmissao, gerarImagemCupom } from '../../../compartilhado/src/cupom.ts';
import { cifrar, indice } from '../../../compartilhado/src/cripto.ts';
import { cachePublico, limitar, limitePorIp } from '../../../compartilhado/src/seguranca.ts';
import { env } from '../env.ts';
import { enviarCodigoWhatsapp } from '../whatsapp.ts';
import { ErroHttp, naoEncontrado, novoId, param, query, slugUnico, soDigitos, validar } from '../../../compartilhado/src/util.ts';

export const publico = Router();

const MIN = 60_000;
// Cadastros públicos: no máximo 5 por hora por IP (evita spam no admin).
const limiteCadastro = limitePorIp('cadastro', 5, 60 * MIN);

// Conteúdo público muda pouco: o app e a rede podem reaproveitar por 1 minuto.
const cache = cachePublico(60);

const whatsapp = z.string().transform(soDigitos).pipe(z.string().length(11, 'informe DDD + número'));

// ---------- Campanha e conteúdo ----------

publico.get('/campanha', cache, (_req, res) => {
  res.json(campanhaAtiva());
});

publico.get('/premios', cache, (_req, res) => {
  const c = campanhaAtiva();
  const premios = todos<Record<string, unknown>>(
    'SELECT * FROM premios WHERE campanha_id = ? ORDER BY ordem, data_sorteio',
    c.id,
  ).map((p) => ({
    id: p.id,
    nome: p.nome,
    descricao: p.descricao,
    imagemUrl: p.imagemUrl,
    principal: !!p.principal,
    dataSorteio: p.dataSorteio,
    ganhador: p.ganhadorNumero
      ? { nome: p.ganhadorNome, numero: p.ganhadorNumero, cidade: p.ganhadorCidade }
      : undefined,
  }));
  res.json(premios);
});

const COLUNAS_IGREJA = "SELECT id, slug, nome_fantasia AS nome, cidade, uf, logo_url FROM igrejas WHERE status = 'ativa'";
publico.get('/igrejas', cache, (req, res) => {
  const busca = (query(req, 'busca') ?? '').trim().toLowerCase();
  // Sem busca, usa direto o índice (status, nome) e não precisa comparar texto linha a linha.
  res.json(
    busca
      ? todos(`${COLUNAS_IGREJA} AND lower(nome_fantasia || ' ' || cidade || ' ' || uf) LIKE ? ORDER BY nome_fantasia`, `%${busca}%`)
      : todos(`${COLUNAS_IGREJA} ORDER BY nome_fantasia`),
  );
});

// Página da igreja na campanha (link que a igreja divulga para a comunidade ofertar direto nela).
publico.get('/igrejas/:slug', cache, (req, res) => {
  const i = um(
    `SELECT id, slug, nome_fantasia AS nome, cidade, uf, logo_url, descricao FROM igrejas WHERE slug = ? AND status = 'ativa'`,
    param(req, 'slug'),
  );
  if (!i) throw naoEncontrado('Igreja');
  res.json(i);
});

publico.get('/banners', cache, (_req, res) => {
  res.json(todos('SELECT id, titulo, subtitulo, imagem_url, link FROM banners WHERE ativo = 1 ORDER BY ordem'));
});

publico.get('/parceiros', cache, (_req, res) => {
  res.json(todos('SELECT id, nome, logo_url, site FROM parceiros WHERE ativo = 1 ORDER BY ordem, nome'));
});

publico.get('/galeria', cache, (req, res) => {
  res.json(todos('SELECT id, titulo, imagem_url FROM galeria WHERE ativo = 1 AND grupo = ? ORDER BY ordem', query(req, 'grupo') ?? 'palmas'));
});

publico.get('/paginas/:slug', cache, (req, res) => {
  const p = um('SELECT slug, titulo, conteudo, atualizado_em FROM paginas WHERE slug = ?', param(req, 'slug'));
  if (!p) throw naoEncontrado('Página');
  res.json(p);
});

publico.get('/noticias', cache, (_req, res) => {
  res.json(
    todos(
      `SELECT id, titulo, slug, resumo, imagem_url, publicada_em, length(conteudo) AS tamanho
         FROM noticias WHERE publicada = 1 ORDER BY publicada_em DESC`,
    ),
  );
});

publico.get('/noticias/:slug', cache, (req, res) => {
  const n = um('SELECT * FROM noticias WHERE slug = ? AND publicada = 1', param(req, 'slug'));
  if (!n) throw naoEncontrado('Notícia');
  res.json(n);
});

publico.get('/depoimentos', cache, (_req, res) => {
  res.json(todos('SELECT id, titulo, texto, autor, local FROM depoimentos WHERE publicado = 1 ORDER BY ordem'));
});

publico.get('/faqs', cache, (_req, res) => {
  res.json(todos('SELECT id, pergunta, resposta FROM faqs WHERE publicada = 1 ORDER BY ordem'));
});

publico.get('/artistas', cache, (_req, res) => {
  res.json(todos('SELECT id, slug, nome, foto_url FROM artistas WHERE ativo = 1 ORDER BY ordem, nome'));
});

publico.get('/artistas/:slug', cache, (req, res) => {
  const a = um<Record<string, unknown>>('SELECT id, slug, nome, foto_url, bio, galeria FROM artistas WHERE slug = ? AND ativo = 1', param(req, 'slug'));
  if (!a) throw naoEncontrado('Artista');
  res.json({ ...a, galeria: JSON.parse(String(a.galeria || '[]')) });
});

// ---------- Cadastros públicos ----------

const novaIgreja = z.object({
  cnpj: z.string().optional().default(''),
  razaoSocial: z.string().trim().min(2),
  nomeFantasia: z.string().trim().min(2),
  cep: z.string().optional().default(''),
  endereco: z.string().optional().default(''),
  cidade: z.string().trim().min(2),
  uf: z.string().trim().length(2).transform((s) => s.toUpperCase()),
  tipoChavePix: z.enum(['cnpj', 'cpf', 'email', 'telefone', 'aleatoria']),
  chavePix: z.string().trim().min(5),
  pastorNome: z.string().trim().min(3),
  pastorWhatsapp: whatsapp,
  codigoSemeador: z.string().optional(),
});

publico.post('/igrejas', limiteCadastro, (req, res) => {
  const { codigoSemeador, ...d } = validar(novaIgreja, req.body);
  const semeador = codigoSemeador
    ? um<{ id: string }>("SELECT id FROM semeadores WHERE codigo = ? AND status = 'ativo'", codigoSemeador.toUpperCase())
    : undefined;
  if (codigoSemeador && !semeador) throw new ErroHttp(400, 'Código de semeador não encontrado.');
  const protocolo = `IG${Date.now().toString(36).toUpperCase()}`;
  const slug = slugUnico((x) => !!um('SELECT 1 FROM igrejas WHERE slug = ?', x), d.nomeFantasia);
  inserir('igrejas', {
    id: novoId(), ...d, cnpj: soDigitos(d.cnpj), pastorWhatsapp: cifrar(d.pastorWhatsapp), chavePix: cifrar(d.chavePix),
    pastorWhatsappIndice: indice(d.pastorWhatsapp), slug, semeadorId: semeador?.id ?? null, protocolo,
  });
  res.status(201).json({ protocolo, status: 'pendente' });
});

const novoSemeador = z.object({
  nome: z.string().trim().min(2),
  sobrenome: z.string().trim().min(2),
  whatsapp,
  cpf: z.string().transform(soDigitos).pipe(z.string().length(11, 'CPF deve ter 11 dígitos')),
  chavePix: z.string().trim().min(5),
  codigoIndicacao: z.string().optional(),
});

publico.post('/semeadores', limiteCadastro, (req, res) => {
  const { codigoIndicacao, ...d } = validar(novoSemeador, req.body);
  const pai = codigoIndicacao
    ? um<{ id: string }>("SELECT id FROM semeadores WHERE codigo = ? AND status = 'ativo'", codigoIndicacao.toUpperCase())
    : undefined;
  const codigo = `${d.nome.slice(0, 3).toUpperCase().normalize('NFD').replace(/[^A-Z]/g, '')}${randomInt(1000, 9999)}`;
  inserir('semeadores', {
    id: novoId(), ...d, whatsapp: cifrar(d.whatsapp), whatsappIndice: indice(d.whatsapp), cpf: cifrar(d.cpf), chavePix: cifrar(d.chavePix),
    codigo, paiId: pai?.id ?? null,
  });
  res.status(201).json({ status: 'pendente' });
});

const solicitacaoShow = z.object({
  nome: z.string().trim().min(2),
  whatsapp,
  email: z.string().trim().email(),
  igreja: z.string().optional().default(''),
  cidade: z.string().trim().min(2),
  uf: z.string().trim().length(2).transform((s) => s.toUpperCase()),
  dataEvento: z.string().min(8),
  tipo: z.string().optional().default(''),
  publico: z.string().optional().default(''),
  artistas: z.array(z.string()).min(1, 'escolha ao menos um artista'),
  mensagem: z.string().optional().default(''),
});

publico.post('/shows/solicitacoes', limiteCadastro, (req, res) => {
  const d = validar(solicitacaoShow, req.body);
  inserir('solicitacoes_show', { id: novoId(), ...d, whatsapp: cifrar(d.whatsapp), email: cifrar(d.email), artistas: d.artistas.join(', ') });
  res.status(201).json({ ok: true });
});

// ---------- Login por código (WhatsApp) ----------

// O código fica guardado só como resumo (hash): quem copiar o banco não consegue entrar com ele.
const resumoCodigo = (codigo: string) => createHash('sha256').update(`renovando-otp:${codigo}`).digest('hex');

publico.post('/auth/codigo', async (req, res) => {
  const { whatsapp: fone } = validar(z.object({ whatsapp }), req.body);
  // Envio de código custa dinheiro e pode incomodar: 3 por número e 10 por IP a cada 15 minutos.
  limitar(`codigo-ip:${req.ip}`, 10, 15 * MIN);
  limitar(`codigo-fone:${fone}`, 3, 15 * MIN, 'Já enviamos códigos para este número. Aguarde 15 minutos para pedir outro.');
  // Em desenvolvimento o código é sempre 123456 e nada é enviado.
  const codigo = env.dev ? '123456' : String(randomInt(0, 1_000_000)).padStart(6, '0');
  if (!env.dev) await enviarCodigoWhatsapp(fone, codigo);
  executar(
    `INSERT INTO otps (whatsapp, codigo, tentativas, expira_em) VALUES (?, ?, 0, ?)
     ON CONFLICT(whatsapp) DO UPDATE SET codigo = excluded.codigo, tentativas = 0, expira_em = excluded.expira_em`,
    indice(fone),
    resumoCodigo(codigo),
    new Date(Date.now() + 10 * 60_000).toISOString(),
  );
  if (env.dev) console.log(`[otp] ${fone}: ${codigo}`);
  res.json({ ok: true });
});

/** Confere o código enviado ao WhatsApp. Consome o código se estiver certo. */
function conferirCodigo(fone: string, codigo: string) {
  const chave = indice(fone);
  const otp = um<{ codigo: string; tentativas: number; expiraEm: string }>('SELECT * FROM otps WHERE whatsapp = ?', chave);
  if (!otp || new Date(otp.expiraEm) < new Date()) throw new ErroHttp(400, 'Código expirado. Peça um novo.');
  if (otp.tentativas >= 5) throw new ErroHttp(429, 'Muitas tentativas. Peça um novo código.');
  const esperado = Buffer.from(otp.codigo);
  const recebido = Buffer.from(resumoCodigo(codigo));
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) {
    executar('UPDATE otps SET tentativas = tentativas + 1 WHERE whatsapp = ?', chave);
    throw new ErroHttp(400, 'Código inválido. Confira e tente de novo.');
  }
  executar('DELETE FROM otps WHERE whatsapp = ?', chave);
}

publico.post('/auth/verificar', limitePorIp('verificar', 20, 15 * MIN), (req, res) => {
  const d = validar(
    z.object({
      whatsapp,
      codigo: z.string().length(6),
      nome: z.string().optional(),
      sobrenome: z.string().optional(),
    }),
    req.body,
  );
  conferirCodigo(d.whatsapp, d.codigo);

  const existente = um<{ id: string; nome: string; sobrenome: string; sessaoVersao: number }>(
    'SELECT id, nome, sobrenome, sessao_versao FROM usuarios WHERE whatsapp_indice = ?',
    indice(d.whatsapp),
  );
  // O número volta aberto só para o próprio dono, na resposta do login.
  let usuario = existente
    ? { id: existente.id, nome: existente.nome, sobrenome: existente.sobrenome, whatsapp: d.whatsapp }
    : null;
  if (!usuario) {
    usuario = { id: novoId(), nome: d.nome?.trim() || 'Ofertante', sobrenome: d.sobrenome?.trim() ?? '', whatsapp: d.whatsapp };
    inserir('usuarios', { ...usuario, whatsapp: cifrar(d.whatsapp), whatsappIndice: indice(d.whatsapp) });
  }
  // Login vale 30 dias (antes 90). Depois disso, basta pedir um código novo.
  res.json({ token: assinar({ sub: usuario.id, tipo: 'usuario', v: existente?.sessaoVersao ?? 0 }, '30d'), usuario });
});

// ---------- Ofertas e cupons ----------

publico.post('/ofertas', limitePorIp('oferta', 30, 15 * MIN), usuarioOpcional, async (req, res) => {
  const d = validar(
    z.object({
      igrejaId: z.string(),
      quantidade: z.number().int().min(1).max(500),
      anonima: z.boolean(),
    }),
    req.body,
  );
  res.status(201).json(await criarOferta({ ...d, usuarioId: d.anonima ? undefined : req.usuarioId }));
});

publico.get('/ofertas/:id', (req, res) => {
  res.json(buscarOferta(param(req, 'id')));
});

publico.get('/me/cupons', exigirUsuario, (req, res) => {
  res.json(cuponsDoUsuario(req.usuarioId!));
});

// "Baixar cupom", como no site: o bilhete da campanha com o número e os dados do cupom.
publico.get('/me/cupons/:id/imagem', limitePorIp('cupom-imagem', 120, 15 * MIN), exigirUsuario, async (req, res) => {
  const c = cupomParaImagem(req.usuarioId!, param(req, 'id'));
  const imagem = await gerarImagemCupom(
    { numero: c.numero, igreja: c.igreja, campanha: c.campanha, emissao: dataEmissao(c.criadoEm), titular: `${c.nome} ${c.sobrenome}`.trim() },
    c.imagemCupom,
  );
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Content-Disposition', `attachment; filename="cupom-${c.numero}.jpg"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(imagem);
});

// Exclusão de conta pela PÁGINA WEB (sem o app instalado), como exige o Google Play.
// Diferente do login: nunca cria conta. A resposta é a mesma exista ou não a conta,
// para a página não servir para descobrir quais números estão cadastrados.
publico.post('/conta/excluir', limitePorIp('excluir-web', 10, 15 * MIN), (req, res) => {
  const d = validar(
    z.object({
      whatsapp,
      codigo: z.string().length(6, 'o código tem 6 dígitos'),
      confirmacao: z.literal('EXCLUIR', 'digite EXCLUIR para confirmar'),
    }),
    req.body,
  );
  conferirCodigo(d.whatsapp, d.codigo);
  const u = um<{ id: string }>('SELECT id FROM usuarios WHERE whatsapp_indice = ? AND excluido_em IS NULL', indice(d.whatsapp));
  if (u) {
    const { cupons } = excluirConta(u.id);
    registrar({ autor: 'Ofertante (pela página web)', acao: 'excluir', recurso: 'conta', registroId: u.id, resumo: 'Conta excluída pela página de exclusão', detalhes: { cupons }, ip: req.ip });
  }
  res.json({ ok: true });
});

// ---------- Fale conosco ----------

// Anexos: imagem ou PDF, até 5 MB, guardados FORA da pasta pública (só o admin baixa).
const TIPOS_ANEXO: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'application/pdf': '.pdf' };
const anexo = multer({
  storage: multer.diskStorage({
    destination: PASTA_ANEXOS,
    filename: (_req, f, cb) => cb(null, `${novoId()}${TIPOS_ANEXO[f.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, f, cb) => cb(null, f.mimetype in TIPOS_ANEXO),
});

/** Confere os primeiros bytes: só aceita PDF ou imagem de verdade. */
function anexoValido(caminho: string) {
  const b = Buffer.alloc(12);
  const fd = openSync(caminho, 'r');
  readSync(fd, b, 0, 12, 0);
  closeSync(fd);
  const hex = b.toString('hex');
  return b.subarray(0, 5).toString('latin1') === '%PDF-' || hex.startsWith('89504e47') || hex.startsWith('ffd8ff')
    || (hex.startsWith('52494646') && b.subarray(8, 12).toString('latin1') === 'WEBP');
}

publico.post('/contato/anexos', limitePorIp('anexo', 10, 60 * MIN), anexo.single('arquivo'), (req, res) => {
  if (!req.file) throw new ErroHttp(400, 'Envie uma imagem (PNG, JPG, WEBP) ou PDF de até 5 MB.');
  if (!anexoValido(req.file.path)) {
    unlinkSync(req.file.path);
    throw new ErroHttp(400, 'O arquivo enviado não é uma imagem ou PDF válido.');
  }
  res.status(201).json({ arquivo: req.file.filename, nome: req.file.originalname.slice(0, 120) });
});

publico.post('/contato', limiteCadastro, (req, res) => {
  const d = validar(
    z.object({
      nome: z.string().trim().min(2),
      sobrenome: z.string().trim().optional().default(''),
      whatsapp,
      mensagem: z.string().trim().min(5, 'escreva sua mensagem').max(5000),
      anexos: z.array(z.object({ arquivo: z.string().regex(/^[\w-]+\.(png|jpg|webp|pdf)$/), nome: z.string().max(120) })).max(3).default([]),
    }),
    req.body,
  );
  inserir('mensagens', { id: novoId(), ...d, whatsapp: cifrar(d.whatsapp), anexos: JSON.stringify(d.anexos) });
  res.status(201).json({ ok: true });
});

// ---------- Painel do semeador e da igreja (quem entra com o WhatsApp cadastrado) ----------

publico.get('/me/painel', exigirUsuario, (req, res) => {
  const u = um<{ whatsappIndice: string }>('SELECT whatsapp_indice FROM usuarios WHERE id = ?', req.usuarioId!);
  if (!u) throw naoEncontrado('Conta');
  const camp = um<{ divisaoJson: string; valorCupom: number }>('SELECT divisao_json, valor_cupom FROM campanhas WHERE ativa = 1');
  const divisao = JSON.parse(camp?.divisaoJson ?? '[]') as { rotulo: string; percentual: number }[];
  const pct = (rotulo: string) => divisao.find((x) => x.rotulo.toLowerCase() === rotulo)?.percentual ?? 0;
  // Totais de todas as igrejas envolvidas numa única consulta (em vez de uma por igreja).
  const totaisDe = (ids: string[]) => {
    const mapa = new Map<string, { arrecadado: number; ofertas: number; cupons: number }>();
    if (!ids.length) return mapa;
    for (const t of todos<{ igrejaId: string; arrecadado: number; ofertas: number; cupons: number }>(
      `SELECT igreja_id, COALESCE(SUM(valor),0) AS arrecadado, COUNT(*) AS ofertas,
              COALESCE(SUM(CASE WHEN anonima = 0 THEN quantidade ELSE 0 END),0) AS cupons
         FROM ofertas WHERE status = 'paga' AND igreja_id IN (${ids.map(() => '?').join(',')}) GROUP BY igreja_id`,
      ...ids,
    )) mapa.set(t.igrejaId, { arrecadado: t.arrecadado, ofertas: t.ofertas, cupons: t.cupons });
    return mapa;
  };
  const zerado = { arrecadado: 0, ofertas: 0, cupons: 0 };
  const percentuais = { igreja: pct('igreja'), semeador: pct('semeador') };

  // Igrejas em que esta pessoa é a responsável (pastor)
  const minhas = todos<{ id: string; slug: string; nomeFantasia: string; cidade: string; uf: string; status: string; logoUrl: string; protocolo: string }>(
    `SELECT id, slug, nome_fantasia, cidade, uf, status, logo_url, protocolo FROM igrejas WHERE pastor_whatsapp_indice = ? ORDER BY nome_fantasia`,
    u.whatsappIndice,
  );

  // Semeador com este WhatsApp
  const s = um<{ id: string; nome: string; codigo: string; status: string }>(
    'SELECT id, nome, codigo, status FROM semeadores WHERE whatsapp_indice = ?',
    u.whatsappIndice,
  );
  const vinculadas = s
    ? todos<{ id: string; nomeFantasia: string; cidade: string; uf: string; status: string }>(
        'SELECT id, nome_fantasia, cidade, uf, status FROM igrejas WHERE semeador_id = ? ORDER BY nome_fantasia',
        s.id,
      )
    : [];

  const totais = totaisDe([...new Set([...minhas, ...vinculadas].map((i) => i.id))]);
  const igrejas = minhas.map((i) => {
    const t = totais.get(i.id) ?? zerado;
    return { ...i, ...t, repasse: Math.round(t.arrecadado * percentuais.igreja) / 100 };
  });

  let semeador = null;
  if (s) {
    const lista = vinculadas.map((i) => ({ ...i, arrecadado: (totais.get(i.id) ?? zerado).arrecadado }));
    const volume = lista.filter((i) => i.status === 'ativa').reduce((acc, i) => acc + i.arrecadado, 0);
    const indicados = um<{ n: number }>('SELECT COUNT(*) AS n FROM semeadores WHERE pai_id = ?', s.id)!.n;
    semeador = { ...s, igrejas: lista, volume, comissao: Math.round(volume * percentuais.semeador) / 100, semeadoresIndicados: indicados };
  }
  res.json({ igrejas, semeador, percentuais });
});

// ---------- Avisos no celular ----------

// O celular se cadastra quando a pessoa aceita receber avisos (com ou sem login).
publico.post('/dispositivos', limitePorIp('dispositivo', 30, 15 * MIN), usuarioOpcional, (req, res) => {
  const d = validar(z.object({ token: z.string().regex(TOKEN_VALIDO, 'token inválido'), plataforma: z.enum(['ios', 'android']) }), req.body);
  executar(
    `INSERT INTO dispositivos (token, usuario_id, plataforma) VALUES (?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET usuario_id = excluded.usuario_id, plataforma = excluded.plataforma,
       atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    d.token, req.usuarioId ?? null, d.plataforma,
  );
  res.status(201).json({ ok: true });
});

publico.delete('/dispositivos', (req, res) => {
  const { token } = validar(z.object({ token: z.string().regex(TOKEN_VALIDO, 'token inválido') }), req.body);
  executar('DELETE FROM dispositivos WHERE token = ?', token);
  res.json({ ok: true });
});

// Sair de todos os aparelhos: invalida todos os logins desta conta (inclusive o atual).
publico.post('/me/sair-de-todos', exigirUsuario, (req, res) => {
  executar('UPDATE usuarios SET sessao_versao = sessao_versao + 1 WHERE id = ?', req.usuarioId!);
  registrar({ autor: 'Ofertante (pelo app)', acao: 'encerrar_sessoes', recurso: 'conta', registroId: req.usuarioId, ip: req.ip });
  res.json({ ok: true });
});

// Exclusão de conta pelo próprio usuário (exigida pela LGPD e pelas lojas de apps).
publico.delete('/me', exigirUsuario, (req, res) => {
  validar(z.object({ confirmacao: z.literal('EXCLUIR', 'digite EXCLUIR para confirmar') }), req.body);
  const { cupons } = excluirConta(req.usuarioId!);
  // Registro sem dados pessoais: só que a exclusão aconteceu.
  registrar({ autor: 'Ofertante (pelo app)', acao: 'excluir', recurso: 'conta', registroId: req.usuarioId, resumo: 'Conta excluída pelo próprio ofertante', detalhes: { cupons }, ip: req.ip });
  res.json({ ok: true });
});

// Aviso do gateway de pagamento: confere a assinatura e confirma o PIX (pode chegar repetido).
publico.post('/webhooks/pix', (req, res) => {
  const pago = provedorPix().lerWebhook(req);
  if (pago) confirmarPagamento(pago.idNoGateway ? { idNoGateway: pago.idNoGateway } : { txid: pago.txid });
  res.json({ ok: true });
});

// Só em desenvolvimento: simula a confirmação do PIX.
if (env.dev) {
  console.warn('⚠ Rota de teste /dev/ofertas/:id/pagar ATIVA.');
  publico.post('/dev/ofertas/:id/pagar', (req, res) => {
    confirmarPagamento({ id: param(req, 'id') });
    res.json(buscarOferta(param(req, 'id')));
  });
}
