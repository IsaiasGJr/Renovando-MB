// Roda todos os testes contra os servidores LOCAIS em modo de desenvolvimento.
// Uso: npm test   (com "npm run api" e "npm run admin" ligados)
//
// Os testes nunca mexem em igrejas reais: cada um cria a sua igreja temporária e apaga tudo no fim.
// Recusa rodar se a API não estiver em modo de teste (NODE_ENV=development), para nunca tocar em produção.
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pasta = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(pasta, '..');
const dados = process.env.DADOS_DIR ?? join(raiz, 'dados');
const banco = join(dados, 'renovando.db');
const envAdmin = join(raiz, 'admin', 'servidor', '.env');

const saude = await fetch('http://localhost:3333/api/saude').then((r) => r.json()).catch(() => null);
if (!saude) {
  console.error('A API não está respondendo em http://localhost:3333. Rode "npm run api" e "npm run admin" antes.');
  process.exit(1);
}
if (!saude.modoTeste) {
  console.error('A API NÃO está em modo de teste (NODE_ENV=development). Os testes não rodam fora do ambiente de desenvolvimento.');
  process.exit(1);
}

const zerarLimites = () => new DatabaseSync(banco).prepare('DELETE FROM limites').run();
const suites = [
  ['novos', [envAdmin, banco]],
  ['seguranca', [envAdmin, banco]],
  ['exclusao', [envAdmin, banco]],
  ['cripto', [envAdmin, banco]],
  ['seg2', [envAdmin, dados]],
  ['upload', [envAdmin, raiz]],
  ['producao', [envAdmin, banco]],
  ['rede', [envAdmin, banco]],
  ['perfis', [envAdmin, banco]],
];

const inicio = new Date().toISOString();
let falhou = 0;
for (const [nome, args] of suites) {
  zerarLimites();
  // Os testes .mts usam o código TypeScript direto (rodam com o tsx).
  const ts = existsSync(join(pasta, `${nome}.mts`));
  const arquivo = join(pasta, `${nome}.${ts ? 'mts' : 'mjs'}`);
  const r = spawnSync(process.execPath, ['--no-warnings', ...(ts ? ['--import', 'tsx'] : []), arquivo, ...args], { encoding: 'utf8', cwd: raiz });
  const saida = `${r.stdout}${r.stderr}`;
  const resumo = saida.match(/(\d+) ok, (\d+) falha/);
  const ok = r.status === 0 && resumo && resumo[2] === '0';
  if (!ok) falhou++;
  console.log(`${ok ? '✓' : '✗'} ${nome.padEnd(10)} ${resumo ? `${resumo[1]} ok, ${resumo[2]} falha(s)` : 'erro'}`);
  if (!ok) console.log(saida.split('\n').filter((l) => l.startsWith('FALHOU') || /Error/.test(l)).map((l) => `    ${l}`).join('\n'));
}
zerarLimites();
// Apaga as imagens que os testes enviaram (o envio fica registrado na auditoria).
{
  const db = new DatabaseSync(banco);
  const enviados = db.prepare("SELECT id, resumo FROM auditoria WHERE recurso = 'upload' AND criado_em >= ?").all(inicio);
  for (const e of enviados) {
    rmSync(join(dados, 'uploads', String(e.resumo).split(' ')[0]), { force: true });
    db.prepare('DELETE FROM auditoria WHERE id = ?').run(e.id);
  }
}
console.log(falhou ? `\n${falhou} conjunto(s) com falha.` : '\nTodos os testes passaram.');
process.exit(falhou ? 1 : 0);
