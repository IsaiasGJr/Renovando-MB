import compression from 'compression';
import cors from 'cors';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { um } from '../../compartilhado/src/db.ts';
import { semear } from '../../compartilhado/src/seed.ts';
import { cabecalhosSeguranca, semCache, servirUploads } from '../../compartilhado/src/seguranca.ts';
import { tratarErros } from '../../compartilhado/src/util.ts';
import { env } from './env.ts';
import { publico } from './rotas/publico.ts';

// API pública, consumida pelo app. O painel administrativo roda em outro servidor (admin/servidor).
semear({ demo: env.dev });

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.trustProxy);
app.use(cabecalhosSeguranca({ producao: !env.dev }));
// API pública consumida pelo app (sem cookies; o login vai no cabeçalho Authorization).
app.use(cors());
// Respostas em JSON e HTML vão compactadas (gzip/brotli): bem menos dados no 4G.
app.use(compression());
app.use(express.json({ limit: '100kb' }));
// Imagens enviadas pelo admin (notícias, prêmios, artistas): só arquivos de imagem.
app.use('/uploads', servirUploads());

app.get('/api/saude', (_req, res) => res.json({ ok: true, modoTeste: env.dev }));

// Página pública de exclusão de conta (link exigido pelo Google Play). Funciona sem o app.
const paginas = fileURLToPath(new URL('./paginas/', import.meta.url));
const cspPagina = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
// Links compartilháveis: abrem o app (renovando://...) e explicam como baixar, se não tiver.
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
function paginaLink(titulo: string, texto: string, linkApp: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)} · Renovando a Vinha do Senhor</title><meta property="og:title" content="${esc(titulo)}"><meta property="og:description" content="${esc(texto)}">
<style>body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#F7F3F5;color:#1F1A1D}header{background:linear-gradient(135deg,#7E276A,#5C0047);color:#fff;padding:28px 20px}
main{max-width:520px;margin:0 auto;padding:24px 20px;display:flex;flex-direction:column;gap:16px}h1{margin:0;font-size:26px}p{margin:0;color:#5F5662}
a.btn{display:block;text-align:center;background:#6E1A5D;color:#fff;text-decoration:none;font-weight:700;padding:16px;border-radius:14px}</style></head>
<body><header><main style="padding:0"><h1>${esc(titulo)}</h1></main></header><main><p>${esc(texto)}</p>
<a class="btn" href="${esc(linkApp)}">Abrir no app Renovando</a><p>Ainda não tem o app? Procure por <strong>Renovando a Vinha do Senhor</strong> na Play Store ou na App Store e abra este link de novo.</p></main></body></html>`;
}
const cspLink = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'";
app.get('/igreja/:slug', (req, res) => {
  const i = um<{ nomeFantasia: string; cidade: string; uf: string }>(
    "SELECT nome_fantasia, cidade, uf FROM igrejas WHERE slug = ? AND status = 'ativa'", String(req.params.slug),
  );
  res.setHeader('Content-Security-Policy', cspLink);
  if (!i) return void res.status(404).send(paginaLink('Igreja não encontrada', 'Este link não está ativo. Confira com a sua igreja.', 'renovando://'));
  res.send(paginaLink(`Apoie a ${i.nomeFantasia}`, `Oferte para a ${i.nomeFantasia} (${i.cidade}/${i.uf}) na campanha Renovando e concorra a prêmios.`, `renovando://igreja/${encodeURIComponent(String(req.params.slug))}`));
});
app.get('/indicacao/:codigo', (req, res) => {
  const codigo = String(req.params.codigo).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
  res.setHeader('Content-Security-Policy', cspLink);
  res.send(paginaLink('Cadastre sua igreja no Renovando', `Você foi convidado para cadastrar sua igreja na campanha. Código de indicação: ${codigo}.`, `renovando://cadastro-igreja?ref=${codigo}`));
});

app.get('/excluir-conta', (_req, res) => {
  res.setHeader('Content-Security-Policy', cspPagina);
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile('excluir-conta.html', { root: paginas });
});
app.get('/excluir-conta.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile('excluir-conta.js', { root: paginas });
});
app.use('/api', semCache, publico);
app.use(tratarErros);

app.listen(env.porta, '0.0.0.0', () => {
  console.log(`API do app em http://localhost:${env.porta}/api (${env.dev ? 'desenvolvimento' : 'produção'})`);
});
