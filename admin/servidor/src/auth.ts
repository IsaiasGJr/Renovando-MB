import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { inserir, um } from '../../../compartilhado/src/db.ts';
import { perfisDoWhatsapp, type TipoPerfil } from '../../../compartilhado/src/perfis.ts';
import { ErroHttp, novoId } from '../../../compartilhado/src/util.ts';
import { env } from './env.ts';

export type Papel = 'admin' | 'editor';
type Token = { sub: string; papel: Papel; v?: number };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: { id: string; nome: string; papel: Papel };
    }
  }
}

export function assinar(t: Token) {
  return jwt.sign(t, env.jwtSegredo, { expiresIn: '12h', audience: 'renovando-admin' });
}

export function exigirAdmin(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  let t: Token | null = null;
  if (h?.startsWith('Bearer ')) {
    try {
      t = jwt.verify(h.slice(7), env.jwtSegredo, { audience: 'renovando-admin' }) as Token;
    } catch {
      t = null;
    }
  }
  if (!t) throw new ErroHttp(401, 'Sessão expirada. Entre novamente.');
  // Usuário desativado perde o acesso na hora, mesmo com token válido.
  const atual = um<{ ativo: number; papel: Papel; nome: string; sessaoVersao: number; totpAtivo: number }>(
    'SELECT ativo, papel, nome, sessao_versao, totp_ativo FROM admins WHERE id = ?',
    t.sub,
  );
  if (!atual?.ativo) throw new ErroHttp(401, 'Acesso desativado.');
  // Troca de senha, desativação ou mudança de papel aumentam a versão: logins antigos caem na hora.
  if (atual.sessaoVersao !== (t.v ?? 0)) throw new ErroHttp(401, 'Sua sessão foi encerrada. Entre novamente.');
  // O papel vem do banco (não do token): rebaixar alguém vale na hora.
  req.admin = { id: t.sub, nome: atual.nome, papel: atual.papel };
  // Com a verificação em duas etapas obrigatória, quem ainda não ativou só acessa a própria conta (/me...).
  if (env.doisFatoresObrigatorio && !atual.totpAtivo && !req.path.startsWith('/me')) {
    throw new ErroHttp(403, 'Ative a verificação em duas etapas (Minha conta) para continuar.');
  }
  next();
}

/** Só administradores (não editores). */
export function somenteAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.admin?.papel !== 'admin') throw new ErroHttp(403, 'Apenas administradores podem fazer isso.');
  next();
}

/** Cria o primeiro administrador a partir do .env, se ainda não houver nenhum. */
export function semearAdmin() {
  if (um('SELECT 1 FROM admins LIMIT 1')) return;
  inserir('admins', {
    id: novoId(),
    nome: 'Administrador',
    email: env.adminEmail.toLowerCase(),
    senhaHash: bcrypt.hashSync(env.adminSenha, 10),
    papel: 'admin',
  });
  console.log(`[admin] Primeiro administrador criado: ${env.adminEmail} (senha em ADMIN_SENHA no .env)`);
}

// ---------- Perfis que entram pelo WhatsApp (pastor, semeador, parceiro) ----------
// Têm "audience" própria: um token de perfil NUNCA abre as rotas da equipe (exigirAdmin recusa).

type TokenPerfil = { sub: string; perfil: Exclude<TipoPerfil, 'equipe'>; id: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      perfil?: { tipo: Exclude<TipoPerfil, 'equipe'>; indice: string; id: string; rotulo: string; nome: string };
    }
  }
}

export const assinarPerfil = (t: TokenPerfil) => jwt.sign(t, env.jwtSegredo, { expiresIn: '12h', audience: 'renovando-perfil' });

/** Passo intermediário (depois do código do WhatsApp, antes de escolher o perfil). Vale 10 minutos. */
export const assinarEscolha = (indice: string) => jwt.sign({ sub: indice }, env.jwtSegredo, { expiresIn: '10m', audience: 'renovando-escolha' });
export function lerEscolha(token: string) {
  try {
    return (jwt.verify(token, env.jwtSegredo, { audience: 'renovando-escolha' }) as { sub: string }).sub;
  } catch {
    throw new ErroHttp(401, 'O tempo para escolher o perfil acabou. Peça um novo código.');
  }
}

export function exigirPerfil(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  let t: TokenPerfil | null = null;
  if (h?.startsWith('Bearer ')) {
    try {
      t = jwt.verify(h.slice(7), env.jwtSegredo, { audience: 'renovando-perfil' }) as TokenPerfil;
    } catch {
      t = null;
    }
  }
  if (!t) throw new ErroHttp(401, 'Sessão expirada. Entre novamente.');
  // O perfil é conferido de novo a cada acesso: igreja desativada ou semeador inativo perde o acesso na hora.
  const atual = perfisDoWhatsapp(t.sub).perfis.find((p) => p.tipo === t!.perfil);
  if (!atual) throw new ErroHttp(401, 'Este acesso não está mais ativo. Entre novamente.');
  req.perfil = { tipo: t.perfil, indice: t.sub, id: atual.id, rotulo: atual.rotulo, nome: atual.detalhe };
  next();
}
