import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Códigos de 6 dígitos que mudam a cada 30 segundos (TOTP, RFC 6238), os mesmos do
 * Google Authenticator, Microsoft Authenticator, Authy etc.
 */

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PASSO = 30;

export function base32(buf: Buffer) {
  let bits = 0, valor = 0, saida = '';
  for (const byte of buf) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      saida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) saida += ALFABETO[(valor << (5 - bits)) & 31];
  return saida;
}

export function deBase32(texto: string) {
  const limpo = texto.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, valor = 0;
  const bytes: number[] = [];
  for (const c of limpo) {
    valor = (valor << 5) | ALFABETO.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Segredo novo (160 bits), em base32, para guardar e mostrar no QR Code. */
export const novoSegredo = () => base32(randomBytes(20));

export function codigoNoPasso(segredo: string, passo: number) {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(passo));
  const hmac = createHmac('sha1', deBase32(segredo)).update(contador).digest();
  const deslocamento = hmac[hmac.length - 1] & 15;
  const numero = (hmac.readUInt32BE(deslocamento) & 0x7fffffff) % 1_000_000;
  return String(numero).padStart(6, '0');
}

export const passoAtual = (agora = Date.now()) => Math.floor(agora / 1000 / PASSO);

/**
 * Confere o código aceitando 30 s de diferença no relógio do celular.
 * Retorna o passo usado (para não aceitar o mesmo código duas vezes) ou null.
 */
export function conferirCodigoTotp(segredo: string, codigo: string, ultimoPassoUsado = -1, agora = Date.now()): number | null {
  if (!/^\d{6}$/.test(codigo)) return null;
  const atual = passoAtual(agora);
  for (const passo of [atual - 1, atual, atual + 1]) {
    if (passo <= ultimoPassoUsado) continue;
    const esperado = Buffer.from(codigoNoPasso(segredo, passo));
    if (timingSafeEqual(esperado, Buffer.from(codigo))) return passo;
  }
  return null;
}

/** Endereço que o aplicativo autenticador lê pelo QR Code. */
export function enderecoOtpauth(segredo: string, email: string) {
  const emissor = 'Renovando Admin';
  return `otpauth://totp/${encodeURIComponent(`${emissor}:${email}`)}?secret=${segredo}&issuer=${encodeURIComponent(emissor)}&algorithm=SHA1&digits=6&period=${PASSO}`;
}
