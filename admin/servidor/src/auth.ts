import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { inserir, um } from '../../../compartilhado/src/db.ts';
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
