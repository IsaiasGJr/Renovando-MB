// Homologação no SEU computador (sem nuvem e sem cartão): testadores de fora usam o app pelo endereço fixo
// do ngrok (plano grátis), que chega até este computador.
//
// Uso (na pasta principal):
//   node scripts/homologacao-local.mjs <seu-dominio.ngrok-free.app> <celular-testador> [outro-celular ...]
//
// O que faz:
//   - cria a pasta homologacao/ (fora do GitHub) com a configuração de PRODUÇÃO + contas de demonstração e
//     pagamento simulado, segredos novos e dados separados dos de desenvolvimento;
//   - aponta o build "teste" do app (renovando-app/eas.json) para https://<seu-dominio>.
// Depois:
//   docker compose -f homologacao/docker-compose.yml up -d --build
//   ngrok http 3334 --url=<seu-dominio>
import { randomBytes, randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const [dominioBruto, ...celulares] = process.argv.slice(2);
const dominio = (dominioBruto ?? '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
const falhar = (m) => (console.error(m), process.exit(1));

if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(dominio) || !celulares.length) {
  falhar('Uso: node scripts/homologacao-local.mjs <seu-dominio.ngrok-free.app> <celular-testador> [outro ...]');
}
const numeros = celulares.map((c) => c.replace(/\D/g, '').replace(/^55(?=\d{11}$)/, ''));
if (numeros.some((n) => n.length !== 11)) falhar('Cada celular precisa ter DDD + número (11 dígitos).');
if (numeros.length > 10) falhar('No máximo 10 testadores.');

const pasta = `${raiz}homologacao/`;
if (existsSync(`${pasta}api.env`)) falhar('A pasta homologacao/ já está configurada. Para gerar de novo, apague a pasta (os dados de teste vão junto).');
mkdirSync(`${pasta}dados`, { recursive: true });
mkdirSync(`${pasta}backups`, { recursive: true });

const segredo = (n) => randomBytes(n).toString('base64url').slice(0, n);
const chave = () => randomBytes(32).toString('base64');
const FRACOS = /^(\d)\1{5}$|^(012345|123456|234567|345678|456789|987654|654321|121212|112233)$/;
let codigo;
do codigo = String(randomInt(0, 1_000_000)).padStart(6, '0'); while (FRACOS.test(codigo));
const senhaPainel = segredo(20);
const cripto = `CHAVE_CRIPTOGRAFIA=${chave()}\nCHAVE_INDICE=${chave()}\n`;
const demonstracao = `CONTAS_DEMONSTRACAO=${numeros.join(',')}\nCODIGO_DEMONSTRACAO=${codigo}\n`;

writeFileSync(`${pasta}api.env`, `# HOMOLOGAÇÃO no computador (testes): não use com ofertantes reais.
NODE_ENV=production
PORTA=3333
TRUST_PROXY=1
JWT_SEGREDO=${segredo(48)}
WEBHOOK_SEGREDO=${segredo(32)}
${cripto}URL_PUBLICA=https://${dominio}
PAGAMENTO_SIMULADO=1
${demonstracao}`);
writeFileSync(`${pasta}admin.env`, `# HOMOLOGAÇÃO no computador (testes).
NODE_ENV=production
PORTA=4000
TRUST_PROXY=1
JWT_SEGREDO=${segredo(48)}
ADMIN_EMAIL=admin@renovando.teste
ADMIN_SENHA=${senhaPainel}
${cripto}ADMIN_2FA_OBRIGATORIO=0
URL_PUBLICA_API=https://${dominio}
${demonstracao}`);
// Portas só neste computador (127.0.0.1): de fora, só pelo ngrok. 3334/4001 para não brigar com o desenvolvimento.
writeFileSync(`${pasta}docker-compose.yml`, `# Homologação no computador. Gerado por scripts/homologacao-local.mjs.
name: renovando-homologacao
services:
  api:
    build: ..
    command: ["npm", "start", "-w", "renovando-api"]
    env_file: api.env
    environment: { DADOS_DIR: /app/dados }
    volumes: [./dados:/app/dados]
    ports: ["127.0.0.1:3334:3333"]
    restart: unless-stopped
  admin:
    build: ..
    command: ["npm", "start", "-w", "renovando-admin-servidor"]
    env_file: admin.env
    environment: { DADOS_DIR: /app/dados, PAINEL_DIST: /app/admin/painel/dist }
    volumes: [./dados:/app/dados]
    ports: ["127.0.0.1:4001:4000"]
    depends_on: [api]
    restart: unless-stopped
  backup:
    build: ..
    command: ["node", "scripts/backup.mjs", "--repetir"]
    environment: { DADOS_DIR: /app/dados, BACKUP_DIR: /app/backups, BACKUP_DIAS: "7" }
    volumes: [./dados:/app/dados, ./backups:/app/backups]
    restart: unless-stopped
`);

// Build "teste" do app aponta para o endereço do ngrok.
const eas = `${raiz}renovando-app/eas.json`;
const j = JSON.parse(readFileSync(eas, 'utf8'));
j.build.teste.env.EXPO_PUBLIC_API_URL = `https://${dominio}`;
writeFileSync(eas, `${JSON.stringify(j, null, 2)}\n`);

console.log(`
Homologação configurada em homologacao/ (fora do GitHub).

  Endereço do app:   https://${dominio}
  Painel (só aqui):  http://localhost:4001   login admin@renovando.teste
  Senha do painel:   ${senhaPainel}
  Testadores:        ${numeros.join(', ')}
  Código deles:      ${codigo}   (entram no app com esse código, sem WhatsApp)

Anote a senha e o código (ficam também em homologacao/api.env e admin.env).

Próximos passos:
  1. docker compose -f homologacao/docker-compose.yml up -d --build
  2. docker compose -f homologacao/docker-compose.yml exec api npm run importar-igrejas
     docker compose -f homologacao/docker-compose.yml exec api npm run importar-artistas
     docker compose -f homologacao/docker-compose.yml exec api npm run importar-conteudo
  3. ngrok http 3334 --url=${dominio}
  4. cd renovando-app && npx eas-cli@latest build --profile teste --platform android
`);
