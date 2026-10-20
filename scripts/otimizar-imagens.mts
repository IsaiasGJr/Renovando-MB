// Otimiza as imagens que já estão em dados/uploads, no mesmo padrão dos envios novos:
// WEBP, no máximo 1600 px (logos: 512 px), sem metadados (EXIF/GPS) e endireitadas.
// Uso: npm run otimizar-imagens
//
// Seguro: antes de trocar qualquer arquivo, guarda o original em dados/uploads-originais/<data>/.
// Atualiza no banco todos os lugares que usam a imagem. Arquivos que nada usa vão para a mesma pasta
// (subpasta "sem-uso"), em vez de serem apagados. Pode rodar de novo: o que já está otimizado é pulado.
import { copyFile, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const { db, PASTA_DADOS, PASTA_UPLOADS, todos, transacao } = await import('../compartilhado/src/db.ts');
const { novoId } = await import('../compartilhado/src/util.ts');

/** Onde cada imagem é usada: [tabela, coluna, é lista JSON?, é logo?] */
const USOS: [string, string, boolean, boolean][] = [
  ['premios', 'imagem_url', false, false],
  ['noticias', 'imagem_url', false, false],
  ['artistas', 'foto_url', false, false],
  ['artistas', 'galeria', true, false],
  ['banners', 'imagem_url', false, false],
  ['galeria', 'imagem_url', false, false],
  ['campanhas', 'imagem_cupom', false, false],
  ['igrejas', 'logo_url', false, true],
  ['parceiros', 'logo_url', false, true],
];
const LADO = 1600;
const LADO_LOGO = 512;

const colunaExiste = (tabela: string, coluna: string) =>
  (db.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[]).some((c) => c.name === coluna);
const usos = USOS.filter(([t, c]) => colunaExiste(t, c));

// Quais arquivos o banco usa, e se são logos.
const usados = new Map<string, { logo: boolean }>();
for (const [tabela, coluna, json, logo] of usos) {
  for (const { v } of todos<{ v: string }>(`SELECT ${coluna} AS v FROM ${tabela} WHERE ${coluna} LIKE '%/uploads/%'`)) {
    const urls = json ? (JSON.parse(v || '[]') as string[]) : [v];
    for (const u of urls) {
      const nome = u.split('/uploads/')[1];
      if (nome) usados.set(nome, { logo: (usados.get(nome)?.logo ?? false) || logo });
    }
  }
}

const backup = join(PASTA_DADOS, 'uploads-originais', new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'));
let criouBackup = false;
const garantirBackup = async (sub = '') => {
  await mkdir(join(backup, sub), { recursive: true });
  if (criouBackup) return;
  criouBackup = true;
  // Cópia do banco antes de trocar os endereços das imagens (para voltar atrás, se precisar).
  db.exec(`VACUUM INTO '${join(backup, 'renovando.db').replace(/'/g, "''")}'`);
  console.log(`Cópia dos originais e do banco em: ${backup}`);
};

/** Troca o arquivo antigo pelo novo em todo o banco. */
function trocarReferencias(antigo: string, novo: string) {
  transacao(() => {
    for (const [tabela, coluna, json] of usos) {
      if (json) {
        executarSql(`UPDATE ${tabela} SET ${coluna} = replace(${coluna}, ?, ?) WHERE ${coluna} LIKE ?`,
          `"/uploads/${antigo}"`, `"/uploads/${novo}"`, `%/uploads/${antigo}%`);
      } else {
        executarSql(`UPDATE ${tabela} SET ${coluna} = ? WHERE ${coluna} = ?`, `/uploads/${novo}`, `/uploads/${antigo}`);
      }
    }
  });
}
const executarSql = (sql: string, ...p: string[]) => db.prepare(sql).run(...p);

let otimizadas = 0, puladas = 0, semUso = 0, antes = 0, depois = 0, erros = 0;
const arquivos = (await readdir(PASTA_UPLOADS)).filter((f) => /^[\w-]+\.(png|jpe?g|webp|gif)$/i.test(f));

for (const arquivo of arquivos) {
  const caminho = join(PASTA_UPLOADS, arquivo);
  const uso = usados.get(arquivo);
  if (!uso) {
    // Nada no sistema usa este arquivo (sobras de testes ou de cadastros apagados).
    await garantirBackup('sem-uso');
    await rename(caminho, join(backup, 'sem-uso', arquivo));
    semUso++;
    continue;
  }
  try {
    const original = await readFile(caminho);
    const meta = await sharp(original).metadata();
    const lado = uso.logo ? LADO_LOGO : LADO;
    const animado = (meta.pages ?? 1) > 1;
    const grande = Math.max(meta.width ?? 0, meta.height ?? 0) > lado;
    const comMetadados = !!(meta.exif || meta.icc || meta.xmp) && !animado;
    if (arquivo.endsWith('.webp') && !grande && !comMetadados) {
      puladas++;
      continue;
    }
    const otimizada = await sharp(original, { animated: animado })
      .rotate()
      .resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: uso.logo ? 85 : 80, effort: 4 })
      .toBuffer();
    // Já era WEBP pequeno e não ficou menor: mantém o original.
    if (arquivo.endsWith('.webp') && !grande && otimizada.length >= original.length) {
      puladas++;
      continue;
    }
    await garantirBackup();
    await copyFile(caminho, join(backup, arquivo));
    const novo = `${novoId()}.webp`;
    await writeFile(join(PASTA_UPLOADS, novo), otimizada);
    trocarReferencias(arquivo, novo);
    await unlink(caminho);
    antes += original.length;
    depois += otimizada.length;
    otimizadas++;
  } catch (e) {
    erros++;
    console.log(`  ✗ ${arquivo}: ${(e as Error).message}`);
  }
}

const mb = (b: number) => (b / 1024 / 1024).toFixed(1);
const total = async () => {
  let s = 0;
  for (const f of await readdir(PASTA_UPLOADS)) s += (await stat(join(PASTA_UPLOADS, f))).size;
  return s;
};
console.log(`\n${otimizadas} imagem(ns) otimizada(s): ${mb(antes)} MB → ${mb(depois)} MB.`);
console.log(`${puladas} já estava(m) otimizada(s)${semUso ? `; ${semUso} sem uso guardada(s) em "sem-uso"` : ''}${erros ? `; ${erros} com erro (mantidas como estavam)` : ''}.`);
console.log(`Pasta uploads agora: ${mb(await total())} MB.`);
