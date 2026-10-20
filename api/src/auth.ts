import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { um } from '../../compartilhado/src/db.ts';
import { ErroHttp } from '../../compartilhado/src/util.ts';
import { env } from './env.ts';

// Tokens dos ofertantes do app. O admin tem servidor e segredo próprios.
type Token = { sub: string; tipo: 'usuario'; v?: number };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuarioId?: string;
    }
  }
}

export function assinar(t: Token, validade: jwt.SignOptions['expiresIn']) {
  return jwt.sign(t, env.jwtSegredo, { expiresIn: validade });
}

function lerToken(req: Request): Token | null {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(h.slice(7), env.jwtSegredo) as Token;
  } catch {
    return null;
  }
}

/** Token válido E conta ainda existente (conta excluída perde o acesso na hora). */
function usuarioDoToken(req: Request) {
  const t = lerToken(req);
  if (t?.tipo !== 'usuario') return null;
  // A versão da sessão precisa bater: "sair de todos os aparelhos" aumenta a versão e derruba os logins antigos.
  const u = um<{ sessaoVersao: number }>('SELECT sessao_versao FROM usuarios WHERE id = ? AND excluido_em IS NULL', t.sub);
  return u && u.sessaoVersao === (t.v ?? 0) ? t.sub : null;
}

/** Preenche req.usuarioId se houver token de usuário válido; não bloqueia. */
export function usuarioOpcional(req: Request, _res: Response, next: NextFunction) {
  req.usuarioId = usuarioDoToken(req) ?? undefined;
  next();
}

export function exigirUsuario(req: Request, _res: Response, next: NextFunction) {
  const id = usuarioDoToken(req);
  if (!id) throw new ErroHttp(401, 'Entre na sua conta para continuar.');
  req.usuarioId = id;
  next();
}
