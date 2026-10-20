// Teste da redução das fotos enviadas pelo admin.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const [envAdminPath, raiz] = process.argv.slice(2);
const sharp = createRequire(`${raiz}/admin/servidor/package.json`)('sharp');
const env = Object.fromEntries(readFileSync(envAdminPath, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.trim().split(/=(.*)/s)));
const ADM = 'http://localhost:4000/api';
let ok = 0, falhas = 0;
const conferir = (n, c, x = '') => { c ? ok++ : falhas++; console.log(`${c ? 'OK  ' : 'FALHOU'} ${n}${x ? ` (${x})` : ''}`); };
const tok = (await (await fetch(`${ADM}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: env.ADMIN_EMAIL, senha: env.ADMIN_SENHA }) })).json()).token;
const enviar = async (buf, tipo, nome) => {
  const fd = new FormData(); fd.append('arquivo', new Blob([buf], { type: tipo }), nome);
  const r = await fetch(`${ADM}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${tok}` }, body: fd });
  return { status: r.status, dados: await r.json() };
};
// Foto "de celular": 4000x3000 com ruído, JPEG com EXIF (GPS) e girada pela orientação.
const ruido = Buffer.alloc(4000 * 3000 * 3); for (let i = 0; i < ruido.length; i++) ruido[i] = (i * 7919) % 251;
const foto = await sharp(ruido, { raw: { width: 4000, height: 3000, channels: 3 } })
  .jpeg({ quality: 92 }).withMetadata({ orientation: 6 }).withExifMerge({ IFD0: { Make: 'Celular Teste' }, GPS: { GPSLatitude: '10/1 10/1 0/1', GPSLatitudeRef: 'S' } }).toBuffer();
const r = await enviar(foto, 'image/jpeg', 'foto.jpg');
conferir('foto grande aceita', r.status === 201 && r.dados.url.endsWith('.webp'), r.dados.url ?? JSON.stringify(r.dados));
const salvo = Buffer.from(await (await fetch(`http://localhost:4000${r.dados.url}`)).arrayBuffer());
const m = await sharp(salvo).metadata();
conferir('reduzida para no máximo 1600 px e endireitada (em pé)', m.width === 1200 && m.height === 1600, `${m.width}x${m.height}`);
conferir('arquivo bem menor', salvo.length < foto.length / 4, `${Math.round(foto.length / 1024)} KB → ${Math.round(salvo.length / 1024)} KB`);
conferir('sem metadados (EXIF/GPS removidos)', !m.exif && !salvo.includes('Celular Teste'));
const pequena = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#6E1A5D' } }).png().toBuffer();
const p = await enviar(pequena, 'image/png', 'logo.png');
const mp = await sharp(Buffer.from(await (await fetch(`http://localhost:4000${p.dados.url}`)).arrayBuffer())).metadata();
conferir('imagem pequena não é ampliada', mp.width === 300 && mp.height === 200, `${mp.width}x${mp.height}`);
const gif = await sharp({ create: { width: 40, height: 40, channels: 4, background: '#fff' } }).gif().toBuffer();
conferir('GIF aceito', (await enviar(gif, 'image/gif', 'a.gif')).status === 201);
conferir('arquivo falso recusado', (await enviar(Buffer.from('<script>alert(1)</script>'), 'image/png', 'x.png')).status === 400);
const quebrada = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(50)]);
conferir('imagem corrompida recusada com mensagem', (await enviar(quebrada, 'image/png', 'q.png')).status === 400);
console.log(`\n${ok} ok, ${falhas} falha(s)`);
