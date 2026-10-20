import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { z, ZodError, type ZodType } from 'zod';

z.config(z.locales.pt());

export const novoId = () => randomUUID();

export class ErroHttp extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const naoEncontrado = (o = 'Registro') => new ErroHttp(404, `${o} não encontrado.`);

export function validar<T>(schema: ZodType<T>, dados: unknown): T {
  return schema.parse(dados);
}

export function slugify(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export const soDigitos = (s: string) => s.replace(/\D/g, '');

/** Parâmetro de rota sempre como string (Express 5 tipa como string | string[]). */
export const param = (req: Request, nome: string) => String(req.params[nome]);
export const query = (req: Request, nome: string) => {
  const v = req.query[nome];
  return typeof v === 'string' && v !== '' ? v : undefined;
};

export function tratarErros(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => `${i.path.join('.') || 'campo'}: ${i.message}`).join('; ');
    res.status(400).json({ erro: `Dados inválidos. ${msg}` });
    return;
  }
  if (err instanceof ErroHttp) {
    res.status(err.status).json({ erro: err.message });
    return;
  }
  const msg = (err as Error)?.message ?? '';
  if (msg.includes('UNIQUE constraint failed')) {
    res.status(409).json({ erro: 'Já existe um registro com esses dados.' });
    return;
  }
  if (msg.includes('FOREIGN KEY constraint failed')) {
    res.status(409).json({ erro: 'Este registro está em uso por outros dados e não pode ser removido.' });
    return;
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno. Tente novamente.' });
}

/** Endereço curto único numa tabela (ex.: "igreja-comunhao", "igreja-comunhao-2"). */
export function slugUnico(
  existe: (slug: string) => boolean,
  base: string,
): string {
  const raiz = slugify(base) || 'item';
  let s = raiz;
  for (let i = 2; existe(s); i++) s = `${raiz}-${i}`;
  return s;
}
