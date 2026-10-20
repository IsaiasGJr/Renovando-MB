// Backup do sistema: cópia do banco (compactada) + imagens e anexos.
// Uso: npm run backup              (uma vez)
//      node scripts/backup.mjs --repetir   (agora e depois todo dia; é o que o docker-compose usa)
//
// - Banco: cópia consistente mesmo com o sistema no ar (VACUUM INTO), compactada (.db.gz), uma por dia.
//   Guarda BACKUP_DIAS dias (padrão 30) e apaga as mais antigas.
// - Imagens e anexos: espelho em backups/uploads e backups/anexos (só copia o que é novo; os nomes nunca se repetem).
//
// IMPORTANTE: o banco tem CPF, WhatsApp e PIX criptografados. Para restaurar, são necessárias as MESMAS
// CHAVE_CRIPTOGRAFIA e CHAVE_INDICE (guarde-as no cofre de senhas, NUNCA junto com o backup).
// Copie a pasta de backups para fora do servidor (ex.: rclone para Google Drive/S3, todo dia).
import { copyFileSync, createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const DADOS = resolve(process.env.DADOS_DIR ?? join(raiz, 'dados'));
const DESTINO = resolve(process.env.BACKUP_DIR ?? join(raiz, 'backups'));
const DIAS = Number(process.env.BACKUP_DIAS ?? 30);

function espelhar(pasta) {
  const origem = join(DADOS, pasta);
  const destino = join(DESTINO, pasta);
  if (!existsSync(origem)) return 0;
  mkdirSync(destino, { recursive: true });
  let novos = 0;
  for (const nome of readdirSync(origem)) {
    const de = join(origem, nome);
    if (!statSync(de).isFile() || existsSync(join(destino, nome))) continue;
    copyFileSync(de, join(destino, nome));
    novos++;
  }
  return novos;
}

async function backup() {
  const banco = join(DADOS, 'renovando.db');
  if (!existsSync(banco)) throw new Error(`Banco não encontrado em ${banco}`);
  const pastaBanco = join(DESTINO, 'banco');
  mkdirSync(pastaBanco, { recursive: true });

  const carimbo = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const temporario = join(pastaBanco, `renovando-${carimbo}.db`);
  rmSync(temporario, { force: true });
  const db = new DatabaseSync(banco, { timeout: 15_000 });
  db.exec(`VACUUM INTO '${temporario.replace(/'/g, "''")}'`);
  db.close();
  await pipeline(createReadStream(temporario), createGzip({ level: 9 }), createWriteStream(`${temporario}.gz`));
  rmSync(temporario);

  // Apaga cópias do banco mais velhas que DIAS dias.
  const limite = Date.now() - DIAS * 86_400_000;
  let apagadas = 0;
  for (const nome of readdirSync(pastaBanco)) {
    const arquivo = join(pastaBanco, nome);
    if (nome.endsWith('.db.gz') && statSync(arquivo).mtimeMs < limite) {
      rmSync(arquivo);
      apagadas++;
    }
  }

  const imagens = espelhar('uploads');
  const anexos = espelhar('anexos');
  const tamanho = (statSync(`${temporario}.gz`).size / 1024 / 1024).toFixed(1);
  console.log(`[backup] ${new Date().toISOString()} banco ${tamanho} MB; ${imagens} imagem(ns) e ${anexos} anexo(s) novos; ${apagadas} cópia(s) antiga(s) removida(s).`);
}

const executar = () => backup().catch((e) => console.error(`[backup] FALHOU: ${e.message}`));
await executar();
if (process.argv.includes('--repetir')) setInterval(executar, 24 * 3_600_000);
