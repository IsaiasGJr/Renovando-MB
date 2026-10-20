// Importa o catálogo de shows gospel do site (nome, biografia, capa e galeria de cada artista).
// Uso: npm run importar-artistas   (pode rodar de novo: atualiza nome/bio/ordem e só baixa fotos que faltam)
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const SITE = 'https://www.renovandoavinhadosenhor.com';
const PASTA_DADOS = resolve(process.env.DADOS_DIR ?? fileURLToPath(new URL('../dados/', import.meta.url)));
const PASTA_UPLOADS = join(PASTA_DADOS, 'uploads');
mkdirSync(PASTA_UPLOADS, { recursive: true });

const db = new DatabaseSync(join(PASTA_DADOS, 'renovando.db'), { timeout: 5000 });
db.exec('PRAGMA busy_timeout = 5000;');

const html = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

async function texto(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'renovando-importador' } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
}

/** Baixa uma imagem WEBP, confere o conteúdo e grava com nome aleatório. Retorna a URL /uploads/... */
async function baixarImagem(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  const ehWebp = buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';
  if (!ehWebp || buf.length > 2_000_000) return null;
  const nome = `${randomUUID()}.webp`;
  writeFileSync(join(PASTA_UPLOADS, nome), buf);
  return `/uploads/${nome}`;
}

async function importar(slug, ordem) {
  const pagina = await texto(`${SITE}/shows-gospel/${slug}`);
  const nome = html(pagina.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1] ?? slug);
  const bio = html(pagina.match(/<p class="mb-8[^"]*">([^<]+)<\/p>/)?.[1] ?? '');
  const existente = db.prepare('SELECT id, foto_url, galeria FROM artistas WHERE slug = ?').get(slug);

  let foto = existente?.foto_url || '';
  let galeria = existente ? JSON.parse(existente.galeria || '[]') : [];
  const base = `${SITE}/shows-gospel/artistas/${slug}`;
  if (!foto && pagina.includes(`artistas/${slug}/cover.webp`)) foto = (await baixarImagem(`${base}/cover.webp`)) ?? '';
  if (!galeria.length) {
    for (let i = 1; i <= 6; i++) {
      if (!pagina.includes(`artistas/${slug}/gallery-${i}.webp`)) continue;
      const url = await baixarImagem(`${base}/gallery-${i}.webp`);
      if (url) galeria.push(url);
    }
  }

  if (existente) {
    db.prepare('UPDATE artistas SET nome = ?, bio = ?, foto_url = ?, galeria = ?, ordem = ?, ativo = 1 WHERE id = ?')
      .run(nome, bio, foto, JSON.stringify(galeria), ordem, existente.id);
  } else {
    db.prepare('INSERT INTO artistas (id, nome, slug, bio, foto_url, galeria, ordem, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)')
      .run(randomUUID(), nome, slug, bio, foto, JSON.stringify(galeria), ordem);
  }
  return { nome, fotos: (foto ? 1 : 0) + galeria.length };
}

const catalogo = await texto(`${SITE}/shows-gospel`);
const slugs = [...new Set([...catalogo.matchAll(/href="\/shows-gospel\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
if (!slugs.length) throw new Error('Nenhum artista encontrado na página do catálogo.');
console.log(`${slugs.length} artistas encontrados.`);

// Baixa 4 artistas por vez.
let proximo = 0;
let falhas = 0;
async function trabalhador() {
  while (proximo < slugs.length) {
    const i = proximo++;
    try {
      const r = await importar(slugs[i], i);
      console.log(`  ✓ ${r.nome} (${r.fotos} foto(s))`);
    } catch (e) {
      falhas++;
      console.log(`  ✗ ${slugs[i]}: ${e.message}`);
    }
  }
}
await Promise.all([1, 2, 3, 4].map(trabalhador));

// Remove os artistas de exemplo criados na instalação.
db.prepare("DELETE FROM artistas WHERE nome IN ('Artista de exemplo 1', 'Artista de exemplo 2', 'Banda de exemplo')").run();
console.log(`\nConcluído: ${slugs.length - falhas} importado(s)${falhas ? `, ${falhas} com erro` : ''}.`);
