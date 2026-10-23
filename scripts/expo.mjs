// Abre um dos apps no Expo já com o endereço certo para o celular.
// Uso: node scripts/expo.mjs renovando-app [--limpar]     (é o que "npm run app" e "npm run admin:app" fazem)
//
// Por quê: este computador tem placas de rede virtuais (VirtualBox, WSL/Hyper-V...). Sem isto o Expo pode
// colocar no QR Code um IP que o celular não alcança, e o app fica carregando para sempre.
// Aqui escolhemos o IP da rede Wi-Fi/cabo de verdade (192.168.x, 10.x ou 172.16–31.x de uma placa física).
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const [pasta, ...resto] = process.argv.slice(2);
if (!pasta) {
  console.error('Uso: node scripts/expo.mjs <pasta-do-app> [--limpar]');
  process.exit(1);
}

const VIRTUAIS = /virtual|vbox|vmware|hyper-v|vethernet|wsl|docker|loopback|bluetooth|tailscale|zerotier|hamachi/i;
const privado = (ip) => /^192\.168\./.test(ip) || /^10\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);

function ipDaRede() {
  if (process.env.REACT_NATIVE_PACKAGER_HOSTNAME) return process.env.REACT_NATIVE_PACKAGER_HOSTNAME;
  const candidatos = [];
  for (const [nome, enderecos] of Object.entries(networkInterfaces())) {
    for (const e of enderecos ?? []) {
      if (e.family !== 'IPv4' || e.internal || !privado(e.address)) continue;
      // Wi-Fi primeiro, depois cabo; placas virtuais por último.
      const nota = VIRTUAIS.test(nome) ? 0 : /wi-?fi|wlan|sem fio/i.test(nome) ? 3 : /ethernet|eth|en\d/i.test(nome) ? 2 : 1;
      candidatos.push({ nome, ip: e.address, nota });
    }
  }
  candidatos.sort((a, b) => b.nota - a.nota);
  return candidatos[0]?.ip;
}

const ip = ipDaRede();
if (ip) console.log(`\n📱 O celular vai se conectar em ${ip} (precisa estar no mesmo Wi-Fi deste computador).\n`);
else console.log('\n⚠ Não achei o IP da rede local. Confira se o computador está no Wi-Fi.\n');

const args = ['expo', 'start', ...(resto.includes('--limpar') ? ['--clear'] : []), ...resto.filter((a) => a !== '--limpar')];
// Um comando só (os argumentos são fixos deste script, sem nada digitado pelo usuário).
const filho = spawn(['npx', ...args].join(' '), {
  cwd: fileURLToPath(new URL(`../${pasta}/`, import.meta.url)),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ...(ip ? { REACT_NATIVE_PACKAGER_HOSTNAME: ip } : {}) },
});
filho.on('exit', (codigo) => process.exit(codigo ?? 0));
