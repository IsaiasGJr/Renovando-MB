import express, { type NextFunction, type Request, type Response } from 'express';
import { createHash } from 'node:crypto';
import { executar, PASTA_UPLOADS, um } from './db.ts';
import { ErroHttp } from './util.ts';

// ---------- Limite de tentativas (no banco) ----------

/** A chave pode conter telefone ou e-mail: guarda só um resumo (hash), nunca o valor. */
const chaveSegura = (chave: string) => createHash('sha256').update(`renovando-limite:${chave}`).digest('hex');

/**
 * Lança 429 se `chave` passou de `max` usos dentro de `janelaMs`.
 * Fica no banco: não zera quando o servidor reinicia e vale para a API e o admin juntos.
 */
export function limitar(chave: string, max: number, janelaMs: number, mensagem = 'Muitas tentativas. Aguarde alguns minutos e tente de novo.') {
  const k = chaveSegura(chave);
  const agora = Date.now();
  const c = um<{ n: number; desde: number }>('SELECT n, desde FROM limites WHERE chave = ?', k);
  if (!c || agora - c.desde > janelaMs) {
    executar('INSERT INTO limites (chave, n, desde) VALUES (?, 1, ?) ON CONFLICT(chave) DO UPDATE SET n = 1, desde = excluded.desde', k, agora);
    return;
  }
  executar('UPDATE limites SET n = n + 1 WHERE chave = ?', k);
  if (c.n + 1 > max) throw new ErroHttp(429, mensagem);
}

export function zerarLimite(chave: string) {
  executar('DELETE FROM limites WHERE chave = ?', chaveSegura(chave));
}

// Limpa registros com mais de 2 horas a cada 10 minutos.
setInterval(() => {
  try {
    executar('DELETE FROM limites WHERE desde < ?', Date.now() - 2 * 60 * 60_000);
  } catch {
    // banco ocupado: tenta de novo na próxima rodada
  }
}, 10 * 60_000).unref();

/** Middleware: limite por IP para uma rota. */
export function limitePorIp(nome: string, max: number, janelaMs: number) {
  return (req: Request, _res: Response, next: NextFunction) => {
    limitar(`${nome}:${req.ip}`, max, janelaMs);
    next();
  };
}

// ---------- Cabeçalhos de segurança ----------

/** Cabeçalhos básicos para qualquer resposta. `csp` só para quem entrega páginas (o admin). */
export function cabecalhosSeguranca({ csp, producao }: { csp?: string; producao: boolean }) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (csp) res.setHeader('Content-Security-Policy', csp);
    if (producao) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
}

// ---------- Imagens enviadas ----------

/** Tipos de imagem aceitos no envio e a extensão gravada para cada um. */
export const TIPOS_IMAGEM: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/** Confere os primeiros bytes do arquivo: só aceita se for mesmo PNG, JPEG, WEBP ou GIF. */
export function ehImagemValida(cabeca: Buffer) {
  const hex = cabeca.subarray(0, 12).toString('hex');
  return (
    hex.startsWith('89504e470d0a1a0a') || // PNG
    hex.startsWith('ffd8ff') || // JPEG
    hex.startsWith('47494638') || // GIF
    (hex.startsWith('52494646') && cabeca.subarray(8, 12).toString('latin1') === 'WEBP') // WEBP
  );
}

/**
 * Serve /uploads só como imagem: extensões de imagem, sem "adivinhar" o tipo,
 * e com uma política que impede qualquer script de rodar mesmo que algo escape.
 */
export function servirUploads() {
  // Cada envio ganha um nome aleatório novo: o arquivo nunca muda, então pode ficar no cache por 1 ano.
  const estatico = express.static(PASTA_UPLOADS, {
    maxAge: '365d',
    immutable: true,
    dotfiles: 'deny',
    index: false,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });
  return (req: Request, res: Response, next: NextFunction) => {
    if (!/^\/[\w-]+\.(png|jpg|webp|gif)$/i.test(req.path)) {
      res.status(404).end();
      return;
    }
    estatico(req, res, next);
  };
}

// ---------- Cache de respostas ----------

/** Respostas da API não ficam guardadas por padrão (dados pessoais, PIX, painéis). */
export function semCache(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

/**
 * Conteúdo público (campanha, prêmios, notícias...): pode ser guardado por `segundos`
 * e reaproveitado enquanto se busca a versão nova. Com o ETag, o que não mudou volta como 304 (sem corpo).
 */
export function cachePublico(segundos: number) {
  const valor = `public, max-age=${segundos}, stale-while-revalidate=${segundos * 5}`;
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', valor);
    next();
  };
}

// ---------- CSV ----------

/** Escapa uma célula de CSV e neutraliza fórmulas (=, +, -, @) que o Excel executaria. */
export function celulaCsv(v: unknown) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
