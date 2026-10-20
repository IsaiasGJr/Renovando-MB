import bcrypt from 'bcryptjs';
import { Router, type Request } from 'express';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { z, type ZodObject, type ZodRawShape } from 'zod';
import { atualizar, executar, inserir, PASTA_ANEXOS, PASTA_UPLOADS, todos, transacao, um } from '../../../../compartilhado/src/db.ts';
import { formatarCampanha, sortearPremio, type Divisao } from '../../../../compartilhado/src/dominio.ts';
import { ErroHttp, naoEncontrado, novoId, param, query, slugify, slugUnico, soDigitos, validar } from '../../../../compartilhado/src/util.ts';
import { diferenca, registrar, type Acao } from '../../../../compartilhado/src/auditoria.ts';
import { cifrar, cifrarCampos, decifrar, decifrarCampos, indice } from '../../../../compartilhado/src/cripto.ts';
import { celulaCsv, ehImagemValida, limitar, TIPOS_IMAGEM, zerarLimite } from '../../../../compartilhado/src/seguranca.ts';
import { enviarAviso } from '../../../../compartilhado/src/avisos.ts';
import QRCode from 'qrcode';
import { assinar, exigirAdmin, somenteAdmin } from '../auth.ts';
import { env } from '../env.ts';
import { conferirCodigoTotp, enderecoOtpauth, novoSegredo } from '../totp.ts';

export const admin = Router();

// ---------- Login ----------

admin.post('/login', (req, res) => {
  const { email, senha, codigo } = validar(
    z.object({ email: z.string().trim().toLowerCase(), senha: z.string(), codigo: z.string().trim().optional() }),
    req.body,
  );
  // Contra tentativa e erro: 10 por IP e 5 por e-mail a cada 15 minutos.
  limitar(`login-ip:${req.ip}`, 10, 15 * 60_000);
  limitar(`login-email:${email}`, 5, 15 * 60_000, 'Muitas tentativas para este e-mail. Aguarde 15 minutos.');
  const a = um<{
    id: string; nome: string; email: string; senhaHash: string; papel: 'admin' | 'editor'; ativo: number; sessaoVersao: number;
    totpAtivo: number; totpSegredo: string; totpUltimoPasso: number;
  }>('SELECT * FROM admins WHERE lower(email) = ?', email);
  if (!a || !a.ativo || !bcrypt.compareSync(senha, a.senhaHash)) {
    registrar({ admin: a ? { id: a.id, nome: a.nome } : null, acao: 'login_falhou', recurso: 'sessao', resumo: email, ip: req.ip });
    throw new ErroHttp(401, 'E-mail ou senha incorretos.');
  }
  // Segunda etapa: depois da senha certa, pede o código de 6 dígitos do aplicativo autenticador.
  if (a.totpAtivo) {
    if (!codigo) return void res.json({ precisaCodigo: true });
    const passo = conferirCodigoTotp(decifrar(a.totpSegredo), codigo.replace(/\D/g, ''), a.totpUltimoPasso);
    if (passo === null) {
      registrar({ admin: a, acao: 'login_2fa_falhou', recurso: 'sessao', resumo: email, ip: req.ip });
      throw new ErroHttp(401, 'Código de verificação incorreto ou vencido.');
    }
    // O mesmo código não serve duas vezes.
    executar('UPDATE admins SET totp_ultimo_passo = ? WHERE id = ?', passo, a.id);
  }
  zerarLimite(`login-ip:${req.ip}`);
  zerarLimite(`login-email:${email}`);
  registrar({ admin: a, acao: 'login', recurso: 'sessao', ip: req.ip });
  res.json({
    token: assinar({ sub: a.id, papel: a.papel, v: a.sessaoVersao }),
    admin: { id: a.id, nome: a.nome, email: a.email, papel: a.papel, totpAtivo: !!a.totpAtivo },
    configurar2fa: env.doisFatoresObrigatorio && !a.totpAtivo,
  });
});

/** Atalho para registrar uma ação feita pelo usuário logado. */
function auditar(req: Request, acao: Acao, recurso: string, registroId: string | null, resumo: string, detalhes?: unknown) {
  registrar({ admin: req.admin, acao, recurso, registroId, resumo, detalhes, ip: req.ip });
}

/** Mantém só os campos que vieram no corpo: um PUT parcial não pode apagar o resto com valores padrão. */
function soEnviados(dados: Record<string, unknown>, corpo: unknown) {
  const enviados = new Set(Object.keys((corpo as Record<string, unknown>) ?? {}));
  return Object.fromEntries(Object.entries(dados).filter(([k]) => enviados.has(k)));
}

admin.use(exigirAdmin);

admin.get('/me', (req, res) => {
  const a = um<{ totpAtivo: number }>('SELECT id, nome, email, papel, totp_ativo FROM admins WHERE id = ?', req.admin!.id)!;
  res.json({ ...a, totpAtivo: !!a.totpAtivo, doisFatoresObrigatorio: env.doisFatoresObrigatorio });
});

// ---------- Verificação em duas etapas (aplicativo autenticador) ----------

const conferirSenha = (id: string, senha: string) => {
  const a = um<{ senhaHash: string }>('SELECT senha_hash FROM admins WHERE id = ?', id);
  if (!a || !bcrypt.compareSync(senha, a.senhaHash)) throw new ErroHttp(401, 'Senha incorreta.');
};

// 1) Gera o segredo e o QR Code (ainda não vale para o login).
admin.post('/me/2fa/iniciar', async (req, res) => {
  const { senha } = validar(z.object({ senha: z.string() }), req.body);
  limitar(`2fa:${req.admin!.id}`, 10, 15 * 60_000);
  conferirSenha(req.admin!.id, senha);
  const a = um<{ email: string; totpAtivo: number }>('SELECT email, totp_ativo FROM admins WHERE id = ?', req.admin!.id)!;
  if (a.totpAtivo) throw new ErroHttp(409, 'A verificação em duas etapas já está ativa.');
  const segredo = novoSegredo();
  executar('UPDATE admins SET totp_segredo = ?, totp_ultimo_passo = -1 WHERE id = ?', cifrar(segredo), req.admin!.id);
  const otpauth = enderecoOtpauth(segredo, a.email);
  res.json({ segredo, otpauth, qrCode: await QRCode.toDataURL(otpauth, { margin: 1, width: 240, color: { dark: '#36002A' } }) });
});

// 2) Confirma com o primeiro código do aplicativo: a partir daí o login pede o código.
admin.post('/me/2fa/ativar', (req, res) => {
  const { codigo } = validar(z.object({ codigo: z.string().trim() }), req.body);
  limitar(`2fa:${req.admin!.id}`, 10, 15 * 60_000);
  const a = um<{ totpSegredo: string; sessaoVersao: number; papel: 'admin' | 'editor' }>(
    'SELECT totp_segredo, sessao_versao, papel FROM admins WHERE id = ?', req.admin!.id,
  )!;
  if (!a.totpSegredo) throw new ErroHttp(400, 'Comece pelo passo 1 (gerar o QR Code).');
  const passo = conferirCodigoTotp(decifrar(a.totpSegredo), codigo.replace(/\D/g, ''));
  if (passo === null) throw new ErroHttp(400, 'Código incorreto. Confira o horário do celular e tente o código atual.');
  // Ativar derruba as outras sessões abertas (que entraram sem o código); esta continua com um token novo.
  const versao = a.sessaoVersao + 1;
  executar('UPDATE admins SET totp_ativo = 1, totp_ultimo_passo = ?, sessao_versao = ? WHERE id = ?', passo, versao, req.admin!.id);
  auditar(req, 'ativar_2fa', 'sessao', req.admin!.id, 'Verificação em duas etapas ativada');
  res.json({ ok: true, token: assinar({ sub: req.admin!.id, papel: a.papel, v: versao }) });
});

// Desligar exige a senha e um código atual (quem roubou só a senha não consegue).
admin.post('/me/2fa/desativar', (req, res) => {
  const { senha, codigo } = validar(z.object({ senha: z.string(), codigo: z.string().trim() }), req.body);
  limitar(`2fa:${req.admin!.id}`, 10, 15 * 60_000);
  conferirSenha(req.admin!.id, senha);
  const a = um<{ totpSegredo: string; totpAtivo: number; totpUltimoPasso: number }>(
    'SELECT totp_segredo, totp_ativo, totp_ultimo_passo FROM admins WHERE id = ?', req.admin!.id,
  )!;
  if (!a.totpAtivo) throw new ErroHttp(400, 'A verificação em duas etapas não está ativa.');
  if (env.doisFatoresObrigatorio) throw new ErroHttp(403, 'A verificação em duas etapas é obrigatória neste sistema.');
  if (conferirCodigoTotp(decifrar(a.totpSegredo), codigo.replace(/\D/g, ''), a.totpUltimoPasso) === null) {
    throw new ErroHttp(400, 'Código incorreto.');
  }
  executar("UPDATE admins SET totp_ativo = 0, totp_segredo = '', totp_ultimo_passo = -1 WHERE id = ?", req.admin!.id);
  auditar(req, 'desativar_2fa', 'sessao', req.admin!.id, 'Verificação em duas etapas desativada');
  res.json({ ok: true });
});

// ---------- Upload de imagens ----------

// Recebe a foto na memória (até 15 MB, o tamanho de uma foto de celular) e grava uma versão otimizada.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in TIPOS_IMAGEM),
});

/** Maior lado da imagem gravada: nítida em qualquer celular e bem mais leve que o original. */
const LADO_MAXIMO = 1600;

/**
 * Reduz e converte para WEBP: endireita pela orientação da câmera, limita a 1600 px,
 * qualidade 80 e REMOVE os metadados (EXIF com local do GPS, modelo do aparelho...).
 * GIF animado continua animado.
 */
async function otimizarImagem(original: Buffer) {
  const animado = ((await sharp(original).metadata()).pages ?? 1) > 1;
  return sharp(original, { animated: animado })
    .rotate()
    .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toBuffer();
}

admin.post('/upload', upload.single('arquivo'), async (req, res) => {
  if (!req.file) throw new ErroHttp(400, 'Envie uma imagem PNG, JPG, WEBP ou GIF de até 15 MB.');
  // Confere o conteúdo de verdade: o tipo informado pelo navegador pode ser falso.
  if (!ehImagemValida(req.file.buffer.subarray(0, 12))) throw new ErroHttp(400, 'O arquivo enviado não é uma imagem válida.');
  let otimizada: Buffer;
  try {
    otimizada = await otimizarImagem(req.file.buffer);
  } catch {
    throw new ErroHttp(400, 'Não foi possível ler esta imagem. Tente outra foto.');
  }
  // Nome sempre novo e aleatório: o arquivo nunca muda, por isso pode ficar em cache por 1 ano.
  const nome = `${novoId()}.webp`;
  await writeFile(join(PASTA_UPLOADS, nome), otimizada);
  auditar(req, 'criar', 'upload', null, `${nome} (${Math.round(req.file.size / 1024)} KB → ${Math.round(otimizada.length / 1024)} KB)`);
  res.status(201).json({ url: `/uploads/${nome}` });
});

// ---------- CRUD genérico ----------

type ConfigCrud<S extends ZodRawShape> = {
  tabela: string;
  schema: ZodObject<S>;
  ordem: string;
  booleanos?: string[];
  ocultar?: string[];
  antesDeSalvar?: (dados: Record<string, unknown>, req: Request, id?: string) => Record<string, unknown>;
  filtros?: (req: Request) => { where: string; params: (string | number)[] };
  /** Texto curto para o registro de auditoria (ex.: nome da igreja). */
  rotulo: (l: Record<string, unknown>) => string;
  /** Campos que só administradores podem definir ou alterar (ex.: chave PIX). */
  camposSoAdmin?: string[];
  /** Dados pessoais guardados cifrados no banco (ex.: CPF, WhatsApp). */
  cifrados?: string[];
  /** Colunas guardadas como JSON (ex.: galeria de fotos, anexos). */
  json?: string[];
};

function crud<S extends ZodRawShape>(caminho: string, cfg: ConfigCrud<S>, ...middlewares: ((...a: never[]) => void)[]) {
  const cifrados = cfg.cifrados ?? [];
  /** No registro de auditoria, dado pessoal aparece só como "***" (nunca o valor). */
  // Final do valor (ex.: ***1234): dá para conferir uma troca de chave PIX sem expor o dado inteiro.
  const parcial = (v: unknown) => {
    const s = decifrar(v);
    return s ? `***${s.slice(-4)}` : '(vazio)';
  };
  const mascarar = (detalhes: Record<string, unknown>) => {
    for (const c of cifrados) {
      if (!(c in detalhes)) continue;
      const v = detalhes[c];
      detalhes[c] = v && typeof v === 'object' && 'de' in v
        ? { de: parcial((v as unknown as { de: unknown }).de), para: parcial((v as unknown as { para: unknown }).para) }
        : parcial(v);
    }
    return detalhes;
  };
  const saida = (bruta: Record<string, unknown>) => {
    const l = decifrarCampos(bruta, cifrados);
    for (const b of cfg.booleanos ?? []) if (b in l) l[b] = !!l[b];
    for (const j of cfg.json ?? []) if (typeof l[j] === 'string') l[j] = JSON.parse((l[j] as string) || '[]');
    for (const o of cfg.ocultar ?? []) delete l[o];
    return l;
  };
  const r = Router();
  if (middlewares.length) r.use(...(middlewares as never[]));

  r.get('/', (req, res) => {
    const f = cfg.filtros?.(req) ?? { where: '', params: [] };
    res.json(todos<Record<string, unknown>>(`SELECT * FROM ${cfg.tabela} ${f.where} ORDER BY ${cfg.ordem}`, ...f.params).map(saida));
  });
  r.get('/:id', (req, res) => {
    const l = um<Record<string, unknown>>(`SELECT * FROM ${cfg.tabela} WHERE id = ?`, param(req, 'id'));
    if (!l) throw naoEncontrado();
    res.json(saida(l));
  });
  /** Editor não pode definir nem alterar campos sensíveis (ex.: trocar a chave PIX pela dele). */
  const conferirCamposSoAdmin = (req: Request, d: Record<string, unknown>, antes?: Record<string, unknown>) => {
    if (req.admin?.papel === 'admin') return;
    for (const c of cfg.camposSoAdmin ?? []) {
      if (!(c in d)) continue;
      const mudou = antes ? (antes[c] ?? '') !== (d[c] ?? '') : !!d[c];
      if (mudou) throw new ErroHttp(403, 'Só administradores podem definir ou alterar a chave PIX.');
    }
  };

  r.post('/', (req, res) => {
    let d = validar(cfg.schema, req.body) as Record<string, unknown>;
    conferirCamposSoAdmin(req, d);
    if (cfg.antesDeSalvar) d = cfg.antesDeSalvar(d, req);
    const id = novoId();
    inserir(cfg.tabela, { id, ...cifrarCampos(d, cifrados) });
    const novo = um<Record<string, unknown>>(`SELECT * FROM ${cfg.tabela} WHERE id = ?`, id)!;
    auditar(req, 'criar', caminho.slice(1), id, cfg.rotulo(novo), mascarar(diferenca(undefined, d)));
    res.status(201).json(saida(novo));
  });
  r.put('/:id', (req, res) => {
    const id = param(req, 'id');
    const bruto = um<Record<string, unknown>>(`SELECT * FROM ${cfg.tabela} WHERE id = ?`, id);
    if (!bruto) throw naoEncontrado();
    const antes = decifrarCampos(bruto, cifrados);
    let d = soEnviados(validar(cfg.schema.partial(), req.body) as Record<string, unknown>, req.body);
    conferirCamposSoAdmin(req, d, antes);
    if (cfg.antesDeSalvar) d = cfg.antesDeSalvar(d, req, id);
    atualizar(cfg.tabela, id, cifrarCampos(d, cifrados));
    const depois = um<Record<string, unknown>>(`SELECT * FROM ${cfg.tabela} WHERE id = ?`, id)!;
    const mudou = mascarar(diferenca(antes, d));
    if (Object.keys(mudou).length) auditar(req, 'editar', caminho.slice(1), id, cfg.rotulo(depois), mudou);
    res.json(saida(depois));
  });
  r.delete('/:id', (req, res) => {
    const id = param(req, 'id');
    const antes = um<Record<string, unknown>>(`SELECT * FROM ${cfg.tabela} WHERE id = ?`, id);
    if (!antes) throw naoEncontrado();
    executar(`DELETE FROM ${cfg.tabela} WHERE id = ?`, id);
    for (const o of ['senhaHash', ...(cfg.ocultar ?? [])]) delete antes[o];
    auditar(req, 'excluir', caminho.slice(1), id, cfg.rotulo(antes), mascarar(antes));
    res.status(204).end();
  });
  admin.use(caminho, r);
}

const texto = (min = 1) => z.string().trim().min(min);
const opcional = z.string().trim().optional().default('');
const filtroStatus = (req: Request) => {
  const s = query(req, 'status');
  return s ? { where: 'WHERE status = ?', params: [s] } : { where: '', params: [] };
};

// Campanhas: precisa de rota própria por causa da divisão (JSON) e da ativação.
const schemaCampanha = z.object({
  edicao: texto(2),
  titulo: texto(2),
  subtitulo: opcional,
  descricao: opcional,
  valorCupom: z.number().positive(),
  divisao: z
    .array(z.object({ rotulo: texto(), percentual: z.number().min(0).max(100) }))
    .min(1)
    .refine((d) => Math.abs(d.reduce((s, x) => s + x.percentual, 0) - 100) < 0.01, 'a divisão precisa somar 100%'),
  inicio: z.string().nullable().optional(),
  // Arte do cupom (como no site): só imagens enviadas pelo próprio admin.
  imagemCupom: z.string().regex(/^(\/uploads\/[\w-]+\.(png|jpg|webp))?$/, 'envie a arte pelo botão de imagem').optional().default(''),
  fim: z.string().nullable().optional(),
});

function lerCampanha(id: string) {
  const c = um<Parameters<typeof formatarCampanha>[0]>('SELECT * FROM campanhas WHERE id = ?', id);
  if (!c) throw naoEncontrado('Campanha');
  return formatarCampanha(c);
}

admin.get('/campanhas', (_req, res) => {
  res.json(
    todos<Parameters<typeof formatarCampanha>[0]>('SELECT * FROM campanhas ORDER BY criado_em DESC').map(formatarCampanha),
  );
});
admin.get('/campanhas/:id', (req, res) => res.json(lerCampanha(param(req, 'id'))));
admin.post('/campanhas', somenteAdmin, (req, res) => {
  const { divisao, ...d } = validar(schemaCampanha, req.body);
  const id = novoId();
  inserir('campanhas', { id, ...d, divisaoJson: JSON.stringify(divisao) });
  auditar(req, 'criar', 'campanhas', id, d.edicao, { ...d, divisao });
  res.status(201).json(lerCampanha(id));
});
admin.put('/campanhas/:id', somenteAdmin, (req, res) => {
  const id = param(req, 'id');
  const antes = lerCampanha(id);
  const { divisao, ...d } = soEnviados(validar(schemaCampanha.partial(), req.body), req.body) as z.infer<typeof schemaCampanha>;
  atualizar('campanhas', id, divisao ? { ...d, divisaoJson: JSON.stringify(divisao) } : d);
  const mudou = diferenca(antes as unknown as Record<string, unknown>, d);
  if (divisao && JSON.stringify(divisao) !== JSON.stringify(antes.divisao)) mudou.divisao = { de: antes.divisao, para: divisao };
  if (Object.keys(mudou).length) auditar(req, 'editar', 'campanhas', id, antes.edicao, mudou);
  res.json(lerCampanha(id));
});
admin.post('/campanhas/:id/ativar', somenteAdmin, (req, res) => {
  const id = param(req, 'id');
  lerCampanha(id);
  transacao(() => {
    executar('UPDATE campanhas SET ativa = 0');
    executar('UPDATE campanhas SET ativa = 1 WHERE id = ?', id);
  });
  const c = lerCampanha(id);
  auditar(req, 'ativar', 'campanhas', id, c.edicao);
  res.json(c);
});
admin.delete('/campanhas/:id', somenteAdmin, (req, res) => {
  const id = param(req, 'id');
  if (um('SELECT 1 FROM ofertas WHERE campanha_id = ? LIMIT 1', id)) {
    throw new ErroHttp(409, 'Esta campanha já tem ofertas e não pode ser excluída.');
  }
  const antes = lerCampanha(id);
  executar('DELETE FROM campanhas WHERE id = ?', id);
  auditar(req, 'excluir', 'campanhas', id, antes.edicao, antes);
  res.status(204).end();
});

crud('/premios', {
  tabela: 'premios',
  rotulo: (l) => String(l.nome),
  ordem: 'data_sorteio',
  booleanos: ['principal'],
  schema: z.object({
    campanhaId: texto(),
    nome: texto(2),
    descricao: opcional,
    imagemUrl: opcional,
    valorEstimado: z.number().min(0).default(0),
    principal: z.boolean().default(false),
    dataSorteio: texto(8),
    ordem: z.number().int().default(0),
  }),
  filtros: (req) => {
    const c = query(req, 'campanhaId');
    return c ? { where: 'WHERE campanha_id = ?', params: [c] } : { where: '', params: [] };
  },
});

admin.post('/premios/:id/sortear', somenteAdmin, (req, res) => {
  const { numero } = validar(z.object({ numero: z.string().regex(/^\d{1,6}$/).optional() }), req.body ?? {});
  const r = sortearPremio(param(req, 'id'), numero) as Record<string, unknown>;
  auditar(req, 'sortear', 'premios', param(req, 'id'), String(r.nome), {
    modo: numero ? 'numero informado' : 'aleatorio', numero: r.ganhadorNumero, ganhador: r.ganhadorNome,
  });
  // Avisos no celular: o resultado para todos e uma mensagem especial para quem ganhou (sem esperar o envio).
  const ganhador = um<{ usuarioId: string }>('SELECT usuario_id FROM cupons WHERE id = ?', String(r.ganhadorCupomId));
  void (async () => {
    if (ganhador?.usuarioId) {
      await enviarAviso({ titulo: 'Parabéns! Você foi sorteado!', mensagem: `Seu número da sorte ${r.ganhadorNumero} ganhou: ${r.nome}. Nossa equipe vai falar com você pelo WhatsApp.`, rota: '/cupons' }, [ganhador.usuarioId]);
    }
    await enviarAviso({ titulo: `Resultado do sorteio: ${r.nome}`, mensagem: `Número sorteado: ${r.ganhadorNumero} (${r.ganhadorNome}, ${r.ganhadorCidade}). Boa sorte nos próximos!`, rota: '/premios' });
  })().catch(() => {});
  res.json(r);
});
admin.post('/premios/:id/desfazer-sorteio', somenteAdmin, (req, res) => {
  const antes = um<Record<string, unknown>>('SELECT * FROM premios WHERE id = ?', param(req, 'id'));
  if (!antes) throw naoEncontrado('Prêmio');
  auditar(req, 'desfazer_sorteio', 'premios', param(req, 'id'), String(antes.nome), {
    numero: antes.ganhadorNumero, ganhador: antes.ganhadorNome,
  });
  executar(
    `UPDATE premios SET ganhador_cupom_id = NULL, ganhador_numero = NULL, ganhador_nome = NULL,
            ganhador_cidade = NULL, sorteado_em = NULL WHERE id = ?`,
    param(req, 'id'),
  );
  res.json(um('SELECT * FROM premios WHERE id = ?', param(req, 'id')));
});

crud('/igrejas', {
  tabela: 'igrejas',
  rotulo: (l) => String(l.nomeFantasia),
  camposSoAdmin: ['chavePix', 'tipoChavePix'],
  cifrados: ['pastorWhatsapp', 'chavePix'],
  ordem: "CASE status WHEN 'pendente' THEN 0 ELSE 1 END, nome_fantasia",
  filtros: filtroStatus,
  schema: z.object({
    cnpj: opcional,
    razaoSocial: texto(2),
    nomeFantasia: texto(2),
    cep: opcional,
    endereco: opcional,
    cidade: texto(2),
    uf: z.string().trim().length(2).transform((s) => s.toUpperCase()),
    tipoChavePix: z.enum(['cnpj', 'cpf', 'email', 'telefone', 'aleatoria']).default('cnpj'),
    chavePix: opcional,
    pastorNome: opcional,
    pastorWhatsapp: opcional,
    semeadorId: z.string().nullable().optional(),
    status: z.enum(['pendente', 'ativa', 'rejeitada', 'inativa']).default('ativa'),
    observacao: opcional,
    slug: z.string().trim().optional(),
    logoUrl: opcional,
    descricao: opcional,
  }),
  antesDeSalvar: (d, _req, id) => {
    const out: Record<string, unknown> = id ? { ...d } : { ...d, protocolo: `IG${Date.now().toString(36).toUpperCase()}` };
    // Endereço da página da igreja: gerado do nome se vier vazio; sempre único.
    if (!id || d.slug !== undefined) {
      const base = String(d.slug || d.nomeFantasia || '');
      if (base) out.slug = slugUnico((x) => !!um('SELECT 1 FROM igrejas WHERE slug = ? AND id <> ?', x, id ?? ''), base);
    }
    if (d.pastorWhatsapp !== undefined) {
      const fone = soDigitos(String(d.pastorWhatsapp));
      out.pastorWhatsappIndice = fone ? indice(fone) : null;
    }
    return out;
  },
});

crud('/semeadores', {
  tabela: 'semeadores',
  rotulo: (l) => `${l.nome} ${l.sobrenome}`.trim(),
  camposSoAdmin: ['chavePix'],
  cifrados: ['whatsapp', 'cpf', 'chavePix'],
  ordem: "CASE status WHEN 'pendente' THEN 0 ELSE 1 END, nome",
  filtros: filtroStatus,
  schema: z.object({
    nome: texto(2),
    sobrenome: opcional,
    whatsapp: texto(10),
    cpf: opcional,
    chavePix: opcional,
    codigo: texto(3).transform((s) => s.toUpperCase()),
    status: z.enum(['pendente', 'ativo', 'rejeitado', 'inativo']).default('ativo'),
  }),
  antesDeSalvar: (d) => {
    if (d.whatsapp === undefined) return d;
    const fone = soDigitos(String(d.whatsapp));
    return { ...d, whatsappIndice: fone ? indice(fone) : null };
  },
});

crud('/noticias', {
  tabela: 'noticias',
  rotulo: (l) => String(l.titulo),
  ordem: 'COALESCE(publicada_em, criado_em) DESC',
  booleanos: ['publicada'],
  schema: z.object({
    titulo: texto(3),
    slug: z.string().trim().optional(),
    resumo: opcional,
    conteudo: opcional,
    imagemUrl: opcional,
    publicada: z.boolean().default(false),
    publicadaEm: z.string().nullable().optional(),
  }),
  antesDeSalvar: (d, _req, id) => {
    const out = { ...d };
    if (!id || d.titulo || d.slug) out.slug = slugify(String(d.slug || d.titulo || ''));
    if (d.publicada && !d.publicadaEm) {
      const atual = id ? um<{ publicadaEm: string | null }>('SELECT publicada_em FROM noticias WHERE id = ?', id) : undefined;
      out.publicadaEm = atual?.publicadaEm ?? new Date().toISOString();
    }
    return out;
  },
});

crud('/depoimentos', {
  tabela: 'depoimentos',
  rotulo: (l) => String(l.titulo),
  ordem: 'ordem, titulo',
  booleanos: ['publicado'],
  schema: z.object({
    titulo: texto(2),
    texto: texto(5),
    autor: texto(2),
    local: opcional,
    publicado: z.boolean().default(true),
    ordem: z.number().int().default(0),
  }),
});

crud('/faqs', {
  tabela: 'faqs',
  rotulo: (l) => String(l.pergunta),
  ordem: 'ordem, pergunta',
  booleanos: ['publicada'],
  schema: z.object({
    pergunta: texto(3),
    resposta: texto(3),
    publicada: z.boolean().default(true),
    ordem: z.number().int().default(0),
  }),
});

crud('/artistas', {
  tabela: 'artistas',
  rotulo: (l) => String(l.nome),
  ordem: 'ordem, nome',
  booleanos: ['ativo'],
  json: ['galeria'],
  schema: z.object({
    nome: texto(2),
    fotoUrl: opcional,
    bio: opcional,
    galeria: z.array(z.string().max(500)).max(20).default([]),
    slug: z.string().trim().optional(),
    ativo: z.boolean().default(true),
    ordem: z.number().int().default(0),
  }),
  antesDeSalvar: (d, _req, id) => {
    if (id && d.slug === undefined) return d;
    const base = String(d.slug || d.nome || '');
    return base ? { ...d, slug: slugUnico((x) => !!um('SELECT 1 FROM artistas WHERE slug = ? AND id <> ?', x, id ?? ''), base) } : d;
  },
});

crud('/banners', {
  tabela: 'banners',
  rotulo: (l) => String(l.titulo),
  ordem: 'ordem, titulo',
  booleanos: ['ativo'],
  schema: z.object({
    titulo: texto(2),
    subtitulo: opcional,
    imagemUrl: opcional,
    // Rota do app (ex.: /shows, /ofertar) ou endereço completo (https://...)
    link: z.string().trim().refine((v) => v === '' || v.startsWith('/') || /^https:\/\//.test(v), 'use /rota-do-app ou https://...').default(''),
    ordem: z.number().int().default(0),
    ativo: z.boolean().default(true),
  }),
});

crud('/parceiros', {
  tabela: 'parceiros',
  rotulo: (l) => String(l.nome),
  ordem: 'ordem, nome',
  booleanos: ['ativo'],
  schema: z.object({
    nome: texto(2),
    logoUrl: opcional,
    site: z.string().trim().refine((v) => v === '' || /^https:\/\//.test(v), 'o site precisa começar com https://').default(''),
    ordem: z.number().int().default(0),
    ativo: z.boolean().default(true),
  }),
});

crud('/galeria', {
  tabela: 'galeria',
  rotulo: (l) => String(l.titulo || 'Imagem'),
  ordem: 'grupo, ordem',
  booleanos: ['ativo'],
  schema: z.object({
    grupo: z.enum(['palmas']).default('palmas'),
    titulo: opcional,
    imagemUrl: texto(5),
    ordem: z.number().int().default(0),
    ativo: z.boolean().default(true),
  }),
});

crud('/paginas', {
  tabela: 'paginas',
  rotulo: (l) => String(l.titulo),
  ordem: 'titulo',
  schema: z.object({
    slug: z.enum(['privacidade', 'termos']),
    titulo: texto(3),
    conteudo: texto(10),
  }),
  antesDeSalvar: (d) => ({ ...d, atualizadoEm: new Date().toISOString() }),
}, somenteAdmin);

crud('/mensagens', {
  tabela: 'mensagens',
  rotulo: (l) => `${l.nome} ${l.sobrenome}`.trim(),
  ordem: "CASE status WHEN 'nova' THEN 0 ELSE 1 END, criado_em DESC",
  filtros: filtroStatus,
  cifrados: ['whatsapp'],
  json: ['anexos'],
  schema: z.object({
    status: z.enum(['nova', 'em_contato', 'respondida', 'arquivada']),
  }),
});

// Anexos do "Fale conosco": só o admin baixa (a pasta não é pública).
admin.get('/anexos/:arquivo', (req, res) => {
  const arquivo = param(req, 'arquivo');
  if (!/^[\w-]+\.(png|jpg|webp|pdf)$/.test(arquivo)) throw naoEncontrado('Anexo');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.download(arquivo, arquivo, { root: PASTA_ANEXOS }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ erro: 'Anexo não encontrado.' });
  });
});

crud('/solicitacoes-show', {
  tabela: 'solicitacoes_show',
  rotulo: (l) => `${l.nome} · ${l.cidade}/${l.uf}`,
  cifrados: ['whatsapp', 'email'],
  ordem: 'criado_em DESC',
  filtros: filtroStatus,
  schema: z.object({
    nome: texto(2),
    whatsapp: texto(10),
    email: opcional,
    igreja: opcional,
    cidade: texto(2),
    uf: texto(2),
    dataEvento: texto(8),
    tipo: opcional,
    publico: opcional,
    artistas: opcional,
    mensagem: opcional,
    status: z.enum(['nova', 'em_contato', 'fechada', 'descartada']).default('nova'),
  }),
});

crud(
  '/admins',
  {
    tabela: 'admins',
    rotulo: (l) => String(l.email),
    ordem: 'nome',
    booleanos: ['ativo', 'totpAtivo'],
    ocultar: ['senhaHash', 'totpSegredo', 'totpUltimoPasso'],
    schema: z.object({
      nome: texto(2),
      email: z.string().trim().toLowerCase().email(),
      senha: z.string().min(8, 'mínimo de 8 caracteres').optional(),
      papel: z.enum(['admin', 'editor']).default('editor'),
      ativo: z.boolean().default(true),
      // Só dá para DESLIGAR por aqui (ex.: a pessoa perdeu o celular). Ligar, só ela mesma em Minha conta.
      totpAtivo: z.boolean().optional(),
    }),
    antesDeSalvar: (d, req, id) => {
      const { senha, totpAtivo: pedido, ...resto } = d as { senha?: string; totpAtivo?: boolean };
      // Marcar não liga nada (quem liga é a própria pessoa); desmarcar desliga e apaga o segredo.
      const ligado = id ? !!um<{ totpAtivo: number }>('SELECT totp_ativo FROM admins WHERE id = ?', id)?.totpAtivo : false;
      const totpAtivo = pedido === false && ligado ? false : undefined;
      if (totpAtivo === false) Object.assign(resto, { totpAtivo: false, totpSegredo: '', totpUltimoPasso: -1 });
      if (!id && !senha) throw new ErroHttp(400, 'Informe uma senha para o novo usuário.');
      if (id === req.admin!.id && (resto as { ativo?: boolean }).ativo === false) {
        throw new ErroHttp(400, 'Você não pode desativar o próprio usuário.');
      }
      const saida: Record<string, unknown> = senha ? { ...resto, senhaHash: bcrypt.hashSync(senha, 10) } : { ...resto };
      if (id) {
        const atual = um<{ papel: string; ativo: number; sessaoVersao: number }>('SELECT papel, ativo, sessao_versao FROM admins WHERE id = ?', id);
        const r = resto as { papel?: string; ativo?: boolean };
        const mudouAcesso = !!senha || r.ativo === false || totpAtivo === false || (r.papel !== undefined && r.papel !== atual?.papel);
        if (atual && mudouAcesso) saida.sessaoVersao = atual.sessaoVersao + 1;
      }
      return saida;
    },
  },
  somenteAdmin,
);

// ---------- Avisos no celular ----------

admin.get('/avisos', somenteAdmin, (_req, res) => {
  res.json({
    dispositivos: um<{ n: number }>('SELECT COUNT(*) AS n FROM dispositivos')!.n,
    comLogin: um<{ n: number }>('SELECT COUNT(*) AS n FROM dispositivos WHERE usuario_id IS NOT NULL')!.n,
    enviados: todos("SELECT admin_nome, resumo, detalhes, criado_em FROM auditoria WHERE acao = 'enviar_aviso' ORDER BY criado_em DESC LIMIT 20")
      .map((l) => ({ ...l, detalhes: JSON.parse(String((l as { detalhes: string }).detalhes || '{}')) })),
  });
});

const ROTAS_AVISO = ['/', '/premios', '/cupons', '/igrejas', '/noticias', '/shows', '/palmas-para-jesus'] as const;
admin.post('/avisos', somenteAdmin, async (req, res) => {
  const d = validar(z.object({
    titulo: z.string().trim().min(3).max(65),
    mensagem: z.string().trim().min(5).max(240),
    rota: z.enum(ROTAS_AVISO).optional(),
  }), req.body);
  // Aviso chega no celular de todo mundo: no máximo 5 por hora.
  limitar(`avisos:${req.admin!.id}`, 5, 60 * 60_000, 'Limite de avisos atingido (5 por hora). Tente mais tarde.');
  const r = await enviarAviso(d);
  auditar(req, 'enviar_aviso', 'avisos', null, d.titulo, { ...d, ...r });
  res.json(r);
});

// ---------- Relatórios ----------

type FiltroOfertas = { campanhaId?: string; igrejaId?: string; status?: string; de?: string; ate?: string };

function whereOfertas(f: FiltroOfertas) {
  const cond: string[] = [];
  const params: string[] = [];
  if (f.campanhaId) (cond.push('o.campanha_id = ?'), params.push(f.campanhaId));
  if (f.igrejaId) (cond.push('o.igreja_id = ?'), params.push(f.igrejaId));
  if (f.status) (cond.push('o.status = ?'), params.push(f.status));
  // Datas ISO comparam como texto: comparar a coluna direto deixa o SQLite usar o índice.
  if (f.de) (cond.push('o.criada_em >= ?'), params.push(f.de.slice(0, 10)));
  if (f.ate) (cond.push('o.criada_em <= ?'), params.push(`${f.ate.slice(0, 10)}T23:59:59.999Z`));
  return { where: cond.length ? `WHERE ${cond.join(' AND ')}` : '', params };
}

function lerFiltro(req: Request): FiltroOfertas {
  return {
    campanhaId: query(req, 'campanhaId'),
    igrejaId: query(req, 'igrejaId'),
    status: query(req, 'status'),
    de: query(req, 'de'),
    ate: query(req, 'ate'),
  };
}

/** Soma quanto cada destinatário recebe, usando a divisão gravada em cada oferta paga. */
function repasses(f: FiltroOfertas) {
  const { where, params } = whereOfertas({ ...f, status: 'paga' });
  // Todas as ofertas de uma campanha têm a mesma divisão: soma no banco por divisão
  // e só depois aplica os percentuais (poucas linhas em vez de uma por oferta).
  const linhas = todos<{ valor: number; divisaoJson: string }>(
    `SELECT SUM(o.valor) AS valor, o.divisao_json FROM ofertas o ${where} GROUP BY o.divisao_json`,
    ...params,
  );
  const mapa = new Map<string, number>();
  for (const l of linhas) {
    for (const d of JSON.parse(l.divisaoJson) as Divisao) {
      mapa.set(d.rotulo, (mapa.get(d.rotulo) ?? 0) + (l.valor * d.percentual) / 100);
    }
  }
  return [...mapa].map(([rotulo, valor]) => ({ rotulo, valor: Math.round(valor * 100) / 100 }));
}

function resumo(f: FiltroOfertas) {
  // Uma passada só: pagas e geradas na mesma consulta.
  const { where, params } = whereOfertas({ ...f, status: undefined });
  const pagaFiltro = "o.status = 'paga'";
  const { geradas, ...r } = um<{ arrecadado: number; ofertas: number; cupons: number; ofertantes: number; geradas: number }>(
    `SELECT COALESCE(SUM(CASE WHEN ${pagaFiltro} THEN o.valor END), 0) AS arrecadado,
            COUNT(CASE WHEN ${pagaFiltro} THEN 1 END) AS ofertas,
            COALESCE(SUM(CASE WHEN ${pagaFiltro} AND o.anonima = 0 THEN o.quantidade END), 0) AS cupons,
            COUNT(DISTINCT CASE WHEN ${pagaFiltro} THEN o.usuario_id END) AS ofertantes,
            COUNT(*) AS geradas
       FROM ofertas o ${where}`,
    ...params,
  )!;
  return {
    ...r,
    ticketMedio: r.ofertas ? Math.round((r.arrecadado / r.ofertas) * 100) / 100 : 0,
    conversao: geradas ? Math.round((r.ofertas / geradas) * 1000) / 10 : 0,
  };
}

function porDia(f: FiltroOfertas) {
  const { where, params } = whereOfertas({ ...f, status: 'paga' });
  return todos(
    `SELECT substr(o.criada_em, 1, 10) AS dia, SUM(o.valor) AS valor, COUNT(*) AS ofertas
       FROM ofertas o ${where} GROUP BY dia ORDER BY dia`,
    ...params,
  );
}

function porIgreja(f: FiltroOfertas, limite = 10) {
  const { where, params } = whereOfertas({ ...f, status: 'paga' });
  return todos(
    `SELECT i.id, i.nome_fantasia AS igreja, i.cidade, i.uf, SUM(o.valor) AS valor, COUNT(*) AS ofertas
       FROM ofertas o JOIN igrejas i ON i.id = o.igreja_id ${where}
      GROUP BY i.id ORDER BY valor DESC LIMIT ${limite}`,
    ...params,
  );
}

function porStatus(f: FiltroOfertas) {
  const { where, params } = whereOfertas({ ...f, status: undefined });
  return todos(`SELECT o.status, COUNT(*) AS total FROM ofertas o ${where} GROUP BY o.status`, ...params);
}

admin.get('/dashboard', (req, res) => {
  const campanha = um<{ id: string }>('SELECT id FROM campanhas WHERE ativa = 1');
  const f: FiltroOfertas = { campanhaId: query(req, 'campanhaId') ?? campanha?.id };
  const desde = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  // Pendências e igrejas ativas numa consulta só.
  const contagens = um<{ igrejas: number; semeadores: number; shows: number; mensagens: number; igrejasAtivas: number }>(
    `SELECT (SELECT COUNT(*) FROM igrejas WHERE status = 'pendente') AS igrejas,
            (SELECT COUNT(*) FROM semeadores WHERE status = 'pendente') AS semeadores,
            (SELECT COUNT(*) FROM solicitacoes_show WHERE status = 'nova') AS shows,
            (SELECT COUNT(*) FROM mensagens WHERE status = 'nova') AS mensagens,
            (SELECT COUNT(*) FROM igrejas WHERE status = 'ativa') AS igrejasAtivas`,
  )!;
  const { igrejasAtivas, ...pendencias } = contagens;
  res.json({
    resumo: resumo(f),
    porDia: porDia({ ...f, de: desde }),
    topIgrejas: porIgreja(f, 8),
    porStatus: porStatus(f),
    repasses: repasses(f),
    pendencias,
    igrejasAtivas,
    proximosSorteios: todos(
      `SELECT id, nome, data_sorteio, ganhador_numero FROM premios
        WHERE campanha_id = ? ORDER BY data_sorteio`,
      f.campanhaId ?? '',
    ),
  });
});

const SQL_LISTA_OFERTAS = `
  SELECT o.id, o.criada_em, o.paga_em, o.status, o.quantidade, o.valor, o.anonima,
         i.nome_fantasia AS igreja, i.cidade || '/' || i.uf AS cidade,
         CASE WHEN o.anonima = 1 THEN 'Anônimo' ELSE trim(u.nome || ' ' || u.sobrenome) END AS ofertante,
         CASE WHEN o.anonima = 1 OR u.excluido_em IS NOT NULL THEN '' ELSE u.whatsapp END AS whatsapp,
         c.edicao AS campanha
    FROM ofertas o
    JOIN igrejas i ON i.id = o.igreja_id
    JOIN campanhas c ON c.id = o.campanha_id
    LEFT JOIN usuarios u ON u.id = o.usuario_id`;

admin.get('/relatorios/ofertas', (req, res) => {
  const f = lerFiltro(req);
  const { where, params } = whereOfertas(f);
  const pagina = Math.max(1, Number(query(req, 'pagina') ?? 1));
  const total = um<{ n: number }>(`SELECT COUNT(*) AS n FROM ofertas o ${where}`, ...params)!.n;
  res.json({
    resumo: resumo(f),
    porDia: porDia(f),
    porIgreja: porIgreja(f, 15),
    porStatus: porStatus(f),
    repasses: repasses(f),
    total,
    pagina,
    porPagina: 50,
    ofertas: todos<Record<string, unknown>>(`${SQL_LISTA_OFERTAS} ${where} ORDER BY o.criada_em DESC LIMIT 50 OFFSET ?`, ...params, (pagina - 1) * 50)
      .map((l) => ({ ...l, whatsapp: decifrar(l.whatsapp) })),
  });
});

admin.get('/relatorios/ofertas.csv', (req, res) => {
  const { where, params } = whereOfertas(lerFiltro(req));
  const linhas = todos<Record<string, unknown>>(`${SQL_LISTA_OFERTAS} ${where} ORDER BY o.criada_em DESC`, ...params)
    .map((l): Record<string, unknown> => ({ ...l, whatsapp: decifrar(l.whatsapp) }));
  const colunas = ['criadaEm', 'pagaEm', 'status', 'campanha', 'igreja', 'cidade', 'ofertante', 'whatsapp', 'quantidade', 'valor'];
  // celulaCsv neutraliza fórmulas (=, +, -, @) que o Excel executaria ao abrir a planilha.
  const csv = [colunas.join(';'), ...linhas.map((l) => colunas.map((c) => celulaCsv(l[c])).join(';'))].join('\n');
  // Exportar entrega o WhatsApp de todos: fica registrado quem exportou, quando e com quais filtros.
  auditar(req, 'exportar', 'relatorios', null, `Planilha de ofertas (${linhas.length} linhas)`, lerFiltro(req));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ofertas.csv"');
  res.send(`﻿${csv}`);
});

/** Quanto cada igreja tem a receber (para conferência dos repasses). */
admin.get('/relatorios/igrejas', (req, res) => {
  const f = lerFiltro(req);
  const { where, params } = whereOfertas({ ...f, status: 'paga' });
  // Agrupa no banco por igreja e divisão; o JSON da divisão é lido uma vez por combinação.
  const linhas = todos<{ id: string; igreja: string; cidade: string; chavePix: string; valor: number; ofertas: number; divisaoJson: string }>(
    `SELECT i.id, i.nome_fantasia AS igreja, i.cidade || '/' || i.uf AS cidade, i.chave_pix,
            SUM(o.valor) AS valor, COUNT(*) AS ofertas, o.divisao_json
       FROM ofertas o JOIN igrejas i ON i.id = o.igreja_id ${where}
      GROUP BY i.id, o.divisao_json`,
    ...params,
  );
  const pctIgreja = new Map<string, number>();
  const mapa = new Map<string, { igreja: string; cidade: string; chavePix: string; arrecadado: number; repasse: number; ofertas: number }>();
  for (const l of linhas) {
    let pct = pctIgreja.get(l.divisaoJson);
    if (pct === undefined) {
      pct = (JSON.parse(l.divisaoJson) as Divisao).find((d) => d.rotulo.toLowerCase() === 'igreja')?.percentual ?? 0;
      pctIgreja.set(l.divisaoJson, pct);
    }
    const atual = mapa.get(l.id) ?? { igreja: l.igreja, cidade: l.cidade, chavePix: decifrar(l.chavePix), arrecadado: 0, repasse: 0, ofertas: 0 };
    atual.arrecadado += l.valor;
    atual.repasse += (l.valor * pct) / 100;
    atual.ofertas += l.ofertas;
    mapa.set(l.id, atual);
  }
  res.json([...mapa.values()].sort((a, b) => b.arrecadado - a.arrecadado));
});

admin.get('/usuarios', (req, res) => {
  const busca = query(req, 'busca') ?? '';
  const fone = soDigitos(busca);
  // O WhatsApp é cifrado: busca por nome, ou pelo número COMPLETO (comparando o índice).
  const filtro = fone.length >= 10
    ? { where: 'u.whatsapp_indice = ?', valor: indice(fone) }
    : { where: "lower(u.nome || ' ' || u.sobrenome) LIKE ?", valor: `%${busca.toLowerCase()}%` };
  res.json(
    todos<Record<string, unknown>>(
      `SELECT u.id, u.nome, u.sobrenome, u.whatsapp, u.criado_em,
              (SELECT COUNT(*) FROM cupons c WHERE c.usuario_id = u.id) AS cupons,
              (SELECT COALESCE(SUM(valor), 0) FROM ofertas o WHERE o.usuario_id = u.id AND o.status = 'paga') AS total
         FROM usuarios u
        WHERE u.excluido_em IS NULL AND ${filtro.where}
        ORDER BY total DESC LIMIT 200`,
      filtro.valor,
    ).map((u) => ({ ...u, whatsapp: decifrar(u.whatsapp) })),
  );
});

// ---------- Registro de auditoria ----------

admin.get('/auditoria', somenteAdmin, (req, res) => {
  const cond: string[] = [];
  const params: string[] = [];
  const recurso = query(req, 'recurso');
  const acao = query(req, 'acao');
  if (recurso) (cond.push('recurso = ?'), params.push(recurso));
  if (acao) (cond.push('acao = ?'), params.push(acao));
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const pagina = Math.max(1, Number(query(req, 'pagina') ?? 1));
  const total = um<{ n: number }>(`SELECT COUNT(*) AS n FROM auditoria ${where}`, ...params)!.n;
  const linhas = todos<Record<string, unknown>>(
    `SELECT * FROM auditoria ${where} ORDER BY criado_em DESC LIMIT 50 OFFSET ?`,
    ...params,
    (pagina - 1) * 50,
  ).map((l) => ({ ...l, detalhes: JSON.parse(String(l.detalhes || '{}')) }));
  res.json({ total, pagina, porPagina: 50, linhas });
});
