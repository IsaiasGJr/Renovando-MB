import compression from 'compression';
import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { semear } from '../../../compartilhado/src/seed.ts';
import { cabecalhosSeguranca, semCache, servirUploads } from '../../../compartilhado/src/seguranca.ts';
import { tratarErros } from '../../../compartilhado/src/util.ts';
import { semearAdmin } from './auth.ts';
import { env } from './env.ts';
import { admin } from './rotas/admin.ts';
import { entrada, perfil } from './rotas/perfil.ts';

// Sistema administrativo: servidor, login e segredo próprios, separado da API do app.
semear({ demo: env.dev });
semearAdmin();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.trustProxy);
// O painel só carrega scripts, estilos e dados do próprio endereço; não pode ser aberto dentro de outro site.
app.use(cabecalhosSeguranca({
  producao: !env.dev,
  csp: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
}));
// O app admin no celular não precisa de CORS; isto só libera testar a versão web dele em desenvolvimento.
if (env.dev) app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', servirUploads());
// Para o monitoramento saber se o servidor está de pé (sem dados).
app.get('/api/saude', (_req, res) => res.json({ ok: true }));
// Entrada pelo WhatsApp e painel dos perfis (pastor, semeador, parceiro) vêm antes das rotas da equipe.
app.use('/api', semCache, entrada);
app.use('/api/perfil', semCache, perfil);
app.use('/api', semCache, admin);
app.use('/api', tratarErros);

// Em produção, o mesmo servidor entrega as telas do painel (admin/painel/dist).
if (existsSync(env.pastaPainel)) {
  // Os arquivos de /assets têm o resumo do conteúdo no nome (gerado pelo Vite): cache de 1 ano.
  // O index.html é conferido sempre, para pegar a versão nova logo depois de publicar.
  app.use(express.static(env.pastaPainel, {
    index: false,
    setHeaders: (res, caminho) =>
      res.setHeader('Cache-Control', /[\\/]assets[\\/]/.test(caminho) ? 'public, max-age=31536000, immutable' : 'no-cache'),
  }));
  app.get(/^(?!\/api\/|\/uploads\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(join(env.pastaPainel, 'index.html'));
  });
} else if (!env.dev) {
  console.warn('[admin] Build do painel não encontrado. Rode "npm run build -w renovando-admin-painel".');
}
app.use(tratarErros);

app.listen(env.porta, () => {
  console.log(`Admin em http://localhost:${env.porta} (API em /api, ${env.dev ? 'desenvolvimento' : 'produção'})`);
});
