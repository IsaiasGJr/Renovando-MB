import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

/**
 * Banco único usado pelos dois sistemas: a API do app e o servidor do admin.
 * Por padrão fica em `<raiz do projeto>/dados`; em produção use DADOS_DIR.
 */
export const PASTA_DADOS = resolve(process.env.DADOS_DIR ?? fileURLToPath(new URL('../../dados/', import.meta.url)));
export const PASTA_UPLOADS = join(PASTA_DADOS, 'uploads');
mkdirSync(PASTA_UPLOADS, { recursive: true });

export const db = new DatabaseSync(join(PASTA_DADOS, 'renovando.db'), { timeout: 5000 });
// WAL + busy_timeout: os dois servidores acessam o mesmo arquivo ao mesmo tempo.
db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
// Ao apagar/alterar, sobrescreve o conteúdo antigo com zeros (não sobram dados pessoais em páginas livres).
db.exec('PRAGMA secure_delete = ON;');
// Desempenho: com WAL, synchronous NORMAL continua seguro contra corrupção e grava bem mais rápido.
// Cache de páginas maior (≈16 MB), temporários em memória e leitura por mapeamento de memória.
db.exec('PRAGMA synchronous = NORMAL; PRAGMA cache_size = -16000; PRAGMA temp_store = MEMORY; PRAGMA mmap_size = 134217728;');

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'editor' CHECK (papel IN ('admin','editor')),
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  sobrenome TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL UNIQUE,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS otps (
  whatsapp TEXT PRIMARY KEY,
  codigo TEXT NOT NULL,
  tentativas INTEGER NOT NULL DEFAULT 0,
  expira_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campanhas (
  id TEXT PRIMARY KEY,
  edicao TEXT NOT NULL,
  titulo TEXT NOT NULL,
  subtitulo TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  valor_cupom REAL NOT NULL,
  divisao_json TEXT NOT NULL,
  inicio TEXT,
  fim TEXT,
  ativa INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS premios (
  id TEXT PRIMARY KEY,
  campanha_id TEXT NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  imagem_url TEXT NOT NULL DEFAULT '',
  valor_estimado REAL NOT NULL DEFAULT 0,
  principal INTEGER NOT NULL DEFAULT 0,
  data_sorteio TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ganhador_cupom_id TEXT,
  ganhador_numero TEXT,
  ganhador_nome TEXT,
  ganhador_cidade TEXT,
  sorteado_em TEXT
);

CREATE TABLE IF NOT EXISTS semeadores (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  sobrenome TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL,
  cpf TEXT NOT NULL DEFAULT '',
  chave_pix TEXT NOT NULL DEFAULT '',
  codigo TEXT NOT NULL UNIQUE,
  pai_id TEXT REFERENCES semeadores(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','ativo','rejeitado','inativo')),
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS igrejas (
  id TEXT PRIMARY KEY,
  protocolo TEXT NOT NULL UNIQUE,
  cnpj TEXT NOT NULL DEFAULT '',
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  cep TEXT NOT NULL DEFAULT '',
  endereco TEXT NOT NULL DEFAULT '',
  cidade TEXT NOT NULL,
  uf TEXT NOT NULL,
  tipo_chave_pix TEXT NOT NULL DEFAULT 'cnpj',
  chave_pix TEXT NOT NULL DEFAULT '',
  pastor_nome TEXT NOT NULL DEFAULT '',
  pastor_whatsapp TEXT NOT NULL DEFAULT '',
  semeador_id TEXT REFERENCES semeadores(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','ativa','rejeitada','inativa')),
  observacao TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS ofertas (
  id TEXT PRIMARY KEY,
  campanha_id TEXT NOT NULL REFERENCES campanhas(id),
  usuario_id TEXT REFERENCES usuarios(id),
  igreja_id TEXT NOT NULL REFERENCES igrejas(id),
  quantidade INTEGER NOT NULL,
  valor REAL NOT NULL,
  anonima INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aguardando_pagamento'
    CHECK (status IN ('aguardando_pagamento','paga','expirada','cancelada')),
  txid TEXT NOT NULL UNIQUE,
  copia_e_cola TEXT NOT NULL,
  divisao_json TEXT NOT NULL,
  expira_em TEXT NOT NULL,
  criada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paga_em TEXT
);
CREATE INDEX IF NOT EXISTS ofertas_status ON ofertas(status, criada_em);

CREATE TABLE IF NOT EXISTS cupons (
  id TEXT PRIMARY KEY,
  oferta_id TEXT NOT NULL REFERENCES ofertas(id),
  campanha_id TEXT NOT NULL REFERENCES campanhas(id),
  usuario_id TEXT REFERENCES usuarios(id),
  numero TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (campanha_id, numero)
);

CREATE TABLE IF NOT EXISTS noticias (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  resumo TEXT NOT NULL DEFAULT '',
  conteudo TEXT NOT NULL DEFAULT '',
  imagem_url TEXT NOT NULL DEFAULT '',
  publicada INTEGER NOT NULL DEFAULT 0,
  publicada_em TEXT,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS depoimentos (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  autor TEXT NOT NULL,
  local TEXT NOT NULL DEFAULT '',
  publicado INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS faqs (
  id TEXT PRIMARY KEY,
  pergunta TEXT NOT NULL,
  resposta TEXT NOT NULL,
  publicada INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS artistas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  foto_url TEXT NOT NULL DEFAULT '',
  ativo INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS auditoria (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  admin_nome TEXT NOT NULL,
  acao TEXT NOT NULL,
  recurso TEXT NOT NULL,
  registro_id TEXT,
  resumo TEXT NOT NULL DEFAULT '',
  detalhes TEXT NOT NULL DEFAULT '{}',
  ip TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS auditoria_data ON auditoria(criado_em);

CREATE TABLE IF NOT EXISTS solicitacoes_show (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  igreja TEXT NOT NULL DEFAULT '',
  cidade TEXT NOT NULL,
  uf TEXT NOT NULL,
  data_evento TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT '',
  publico TEXT NOT NULL DEFAULT '',
  artistas TEXT NOT NULL DEFAULT '',
  mensagem TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'nova' CHECK (status IN ('nova','em_contato','fechada','descartada')),
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`);

// Migrações simples: adiciona colunas novas em bancos criados antes delas.
function garantirColuna(tabela: string, coluna: string, definicao: string) {
  const existe = (db.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[]).some((c) => c.name === coluna);
  if (!existe) db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
}
garantirColuna('usuarios', 'excluido_em', 'TEXT');
// Índice de busca do WhatsApp (HMAC): o número em si fica cifrado na coluna whatsapp.
garantirColuna('usuarios', 'whatsapp_indice', 'TEXT');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS usuarios_whatsapp_indice ON usuarios(whatsapp_indice)');
// Versão da sessão: quando muda, todos os logins anteriores daquela pessoa deixam de valer.
garantirColuna('usuarios', 'sessao_versao', 'INTEGER NOT NULL DEFAULT 0');
garantirColuna('admins', 'sessao_versao', 'INTEGER NOT NULL DEFAULT 0');
// Limites de tentativas no banco: sobrevivem a reinício e valem para os dois servidores.
// Página pública da igreja, logo e índice do WhatsApp do pastor (para o painel da igreja).
garantirColuna('igrejas', 'slug', 'TEXT');
garantirColuna('igrejas', 'logo_url', "TEXT NOT NULL DEFAULT ''");
garantirColuna('igrejas', 'descricao', "TEXT NOT NULL DEFAULT ''");
garantirColuna('igrejas', 'pastor_whatsapp_indice', 'TEXT');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS igrejas_slug ON igrejas(slug)');
// Índice do WhatsApp do semeador (para o painel do semeador).
garantirColuna('semeadores', 'whatsapp_indice', 'TEXT');
// Página de cada artista: endereço curto, biografia e galeria de fotos (JSON).
garantirColuna('artistas', 'slug', 'TEXT');
garantirColuna('artistas', 'bio', "TEXT NOT NULL DEFAULT ''");
garantirColuna('artistas', 'galeria', "TEXT NOT NULL DEFAULT '[]'");
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS artistas_slug ON artistas(slug)');
// Arte do cupom da campanha (o mesmo bilhete do site): o número e os dados são escritos por cima.
garantirColuna('campanhas', 'imagem_cupom', "TEXT NOT NULL DEFAULT ''");
// Arte do panfleto (1200 × 470, como no site): cada igreja baixa com o QR Code dela no quadro branco.
garantirColuna('campanhas', 'imagem_panfleto', "TEXT NOT NULL DEFAULT ''");
// Rede de semeadores (N1 traz N2), parceiro da campanha e meta.
garantirColuna('campanhas', 'divisao_n2_json', "TEXT NOT NULL DEFAULT ''");
garantirColuna('campanhas', 'parceiro_id', 'TEXT');
garantirColuna('campanhas', 'meta_ofertas', 'REAL NOT NULL DEFAULT 0');
// Parceiro da campanha com acesso ao painel (pelo WhatsApp) e dados para o repasse (cifrados).
garantirColuna('parceiros', 'whatsapp', "TEXT NOT NULL DEFAULT ''");
garantirColuna('parceiros', 'whatsapp_indice', 'TEXT');
garantirColuna('parceiros', 'tipo_chave_pix', "TEXT NOT NULL DEFAULT 'cnpj'");
garantirColuna('parceiros', 'chave_pix', "TEXT NOT NULL DEFAULT ''");
// Motivo de recusa no cadastro de semeador; origem das ofertas registradas à mão pela equipe.
garantirColuna('semeadores', 'observacao', "TEXT NOT NULL DEFAULT ''");
garantirColuna('ofertas', 'origem', "TEXT NOT NULL DEFAULT 'app'");
garantirColuna('ofertas', 'observacao', "TEXT NOT NULL DEFAULT ''");
garantirColuna('ofertas', 'registrada_por', "TEXT NOT NULL DEFAULT ''");
// Repasses: quanto cada um tem a receber de cada oferta (o sistema NÃO transfere dinheiro; só registra).
db.exec(`CREATE TABLE IF NOT EXISTS lancamentos (
  id TEXT PRIMARY KEY,
  oferta_id TEXT NOT NULL REFERENCES ofertas(id),
  campanha_id TEXT NOT NULL,
  beneficiario_tipo TEXT NOT NULL CHECK (beneficiario_tipo IN ('igreja','semeador','parceiro','plataforma')),
  beneficiario_id TEXT,
  papel TEXT NOT NULL,
  percentual REAL NOT NULL,
  valor REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'a_pagar' CHECK (status IN ('a_pagar','pago')),
  pagamento_id TEXT,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  pago_em TEXT
)`);
db.exec('CREATE INDEX IF NOT EXISTS lancamentos_beneficiario ON lancamentos(beneficiario_tipo, beneficiario_id, status)');
db.exec('CREATE INDEX IF NOT EXISTS lancamentos_oferta ON lancamentos(oferta_id)');
db.exec(`CREATE TABLE IF NOT EXISTS pagamentos_repasse (
  id TEXT PRIMARY KEY,
  beneficiario_tipo TEXT NOT NULL,
  beneficiario_id TEXT,
  valor REAL NOT NULL,
  referencia TEXT NOT NULL DEFAULT '',
  observacao TEXT NOT NULL DEFAULT '',
  admin_nome TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`);
// Cobrança no gateway de pagamento: id lá dentro e imagem do QR Code (quando o gateway manda).
garantirColuna('ofertas', 'id_gateway', 'TEXT');
garantirColuna('ofertas', 'qr_code', "TEXT NOT NULL DEFAULT ''");
db.exec('CREATE INDEX IF NOT EXISTS ofertas_id_gateway ON ofertas(id_gateway)');
// Lembrete automático do sorteio (enviado uma vez, na véspera).
garantirColuna('premios', 'lembrete_enviado_em', 'TEXT');
// Verificação em duas etapas do admin (código do aplicativo autenticador). O segredo fica cifrado.
garantirColuna('admins', 'totp_segredo', "TEXT NOT NULL DEFAULT ''");
garantirColuna('admins', 'totp_ativo', 'INTEGER NOT NULL DEFAULT 0');
garantirColuna('admins', 'totp_ultimo_passo', 'INTEGER NOT NULL DEFAULT -1');
// WhatsApp de acesso da equipe (entrada pelo código no WhatsApp, como no site). Cifrado + índice de busca.
garantirColuna('admins', 'whatsapp', "TEXT NOT NULL DEFAULT ''");
garantirColuna('admins', 'whatsapp_indice', 'TEXT');
// Celulares que aceitaram receber avisos (token do serviço de notificações da Expo).
db.exec(`CREATE TABLE IF NOT EXISTS dispositivos (
  token TEXT PRIMARY KEY,
  usuario_id TEXT,
  plataforma TEXT NOT NULL DEFAULT '',
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`);
db.exec('CREATE INDEX IF NOT EXISTS dispositivos_usuario ON dispositivos(usuario_id)');

db.exec(`
CREATE TABLE IF NOT EXISTS banners (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  subtitulo TEXT NOT NULL DEFAULT '',
  imagem_url TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS parceiros (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  logo_url TEXT NOT NULL DEFAULT '',
  site TEXT NOT NULL DEFAULT '',
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS galeria (
  id TEXT PRIMARY KEY,
  grupo TEXT NOT NULL DEFAULT 'palmas',
  titulo TEXT NOT NULL DEFAULT '',
  imagem_url TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS paginas (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL DEFAULT '',
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS mensagens (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  sobrenome TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  anexos TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'nova' CHECK (status IN ('nova','em_contato','respondida','arquivada')),
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`);

/** Anexos do "Fale conosco": pasta separada, NÃO servida publicamente (só o admin baixa). */
export const PASTA_ANEXOS = join(PASTA_DADOS, 'anexos');
mkdirSync(PASTA_ANEXOS, { recursive: true });

db.exec(`CREATE TABLE IF NOT EXISTS limites (
  chave TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  desde INTEGER NOT NULL
)`);

// Índices das consultas mais usadas (cupons do ofertante, relatórios, painéis, listas do admin).
db.exec(`
CREATE INDEX IF NOT EXISTS ofertas_usuario ON ofertas(usuario_id);
CREATE INDEX IF NOT EXISTS ofertas_igreja_status ON ofertas(igreja_id, status);
CREATE INDEX IF NOT EXISTS ofertas_campanha_status ON ofertas(campanha_id, status, criada_em);
CREATE INDEX IF NOT EXISTS cupons_usuario ON cupons(usuario_id, criado_em);
CREATE INDEX IF NOT EXISTS cupons_oferta ON cupons(oferta_id);
CREATE INDEX IF NOT EXISTS premios_campanha ON premios(campanha_id, ordem);
CREATE INDEX IF NOT EXISTS igrejas_status ON igrejas(status, nome_fantasia);
CREATE INDEX IF NOT EXISTS igrejas_pastor ON igrejas(pastor_whatsapp_indice);
CREATE INDEX IF NOT EXISTS igrejas_semeador ON igrejas(semeador_id);
CREATE INDEX IF NOT EXISTS semeadores_indice ON semeadores(whatsapp_indice);
CREATE INDEX IF NOT EXISTS semeadores_pai ON semeadores(pai_id);
CREATE INDEX IF NOT EXISTS semeadores_status ON semeadores(status);
CREATE INDEX IF NOT EXISTS noticias_publicadas ON noticias(publicada, publicada_em);
CREATE INDEX IF NOT EXISTS mensagens_status ON mensagens(status, criado_em);
CREATE INDEX IF NOT EXISTS shows_status ON solicitacoes_show(status, criado_em);
CREATE INDEX IF NOT EXISTS auditoria_recurso ON auditoria(recurso, criado_em);
CREATE INDEX IF NOT EXISTS limites_desde ON limites(desde);
`);
// Atualiza as estatísticas que o SQLite usa para escolher o melhor índice.
db.exec('PRAGMA optimize = 0x10002;');

type Linha = Record<string, unknown>;

// Os nomes de coluna se repetem em toda consulta: converte cada um só uma vez.
const nomesCamel = new Map<string, string>();
const paraCamel = (k: string) => {
  let c = nomesCamel.get(k);
  if (c === undefined) {
    c = k.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase());
    nomesCamel.set(k, c);
  }
  return c;
};
export const paraSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** Converte uma linha do banco (snake_case) para o formato da API (camelCase). */
export function camel<T = Linha>(linha: unknown): T {
  const out: Linha = {};
  for (const k in linha as Linha) out[paraCamel(k)] = (linha as Linha)[k];
  return out as T;
}

// Consultas preparadas ficam guardadas: o SQL é compilado uma vez e reaproveitado.
// O limite evita crescer sem fim com SQL montado dinamicamente (filtros, colunas variáveis).
const preparadas = new Map<string, StatementSync>();
function preparar(sql: string) {
  let st = preparadas.get(sql);
  if (st) return st;
  st = db.prepare(sql);
  if (preparadas.size >= 500) preparadas.delete(preparadas.keys().next().value!);
  preparadas.set(sql, st);
  return st;
}

export function todos<T = Linha>(sql: string, ...params: SQLInputValue[]): T[] {
  const linhas = preparar(sql).all(...params);
  const out = new Array<T>(linhas.length);
  for (let i = 0; i < linhas.length; i++) out[i] = camel<T>(linhas[i]);
  return out;
}

export function um<T = Linha>(sql: string, ...params: SQLInputValue[]): T | undefined {
  const l = preparar(sql).get(...params);
  return l ? camel<T>(l) : undefined;
}

export function executar(sql: string, ...params: SQLInputValue[]) {
  return preparar(sql).run(...params);
}

let profundidade = 0;

/** Executa `fn` dentro de uma transação. Se já houver uma aberta, participa dela. */
export function transacao<T>(fn: () => T): T {
  if (profundidade > 0) {
    profundidade++;
    try {
      return fn();
    } finally {
      profundidade--;
    }
  }
  db.exec('BEGIN IMMEDIATE');
  profundidade = 1;
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    profundidade = 0;
  }
}

/** Converte valores JS para tipos aceitos pelo SQLite (boolean → 0/1, undefined → null). */
export function valorSql(v: unknown): SQLInputValue {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === undefined) return null;
  if (typeof v === 'object' && v !== null) return JSON.stringify(v);
  return v as SQLInputValue;
}

export function inserir(tabela: string, dados: Linha) {
  const cols = Object.keys(dados);
  executar(
    `INSERT INTO ${tabela} (${cols.map(paraSnake).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    ...cols.map((c) => valorSql(dados[c])),
  );
}

export function atualizar(tabela: string, id: string, dados: Linha) {
  const cols = Object.keys(dados);
  if (!cols.length) return;
  executar(
    `UPDATE ${tabela} SET ${cols.map((c) => `${paraSnake(c)} = ?`).join(', ')} WHERE id = ?`,
    ...cols.map((c) => valorSql(dados[c])),
    id,
  );
}
