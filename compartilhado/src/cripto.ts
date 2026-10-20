import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

/**
 * Criptografia de dados pessoais no banco (CPF e WhatsApp).
 *
 * - cifrar/decifrar: AES-256-GCM com IV aleatório. Mesmo com uma cópia do banco,
 *   ninguém lê os dados sem a CHAVE_CRIPTOGRAFIA.
 * - indice: "impressão digital" (HMAC-SHA256) do número, para achar a conta pelo
 *   WhatsApp no login sem guardar o número aberto. Não dá para voltar ao número.
 *
 * As chaves ficam no .env dos DOIS servidores (API do app e admin) e precisam ser iguais.
 * Perder a CHAVE_CRIPTOGRAFIA = perder esses dados. Guarde uma cópia em local seguro.
 */

const PREFIXO = 'v1:';
let chaves: { cifra: Buffer; indice: Buffer } | null = null;

function obterChaves() {
  if (chaves) return chaves;
  const ler = (nome: string) => {
    const b = Buffer.from(process.env[nome] ?? '', 'base64');
    if (b.length !== 32) {
      throw new Error(`${nome} ausente ou inválida no .env (precisa de 32 bytes em base64). Gere com: npm run gerar-chaves`);
    }
    return b;
  };
  chaves = { cifra: ler('CHAVE_CRIPTOGRAFIA'), indice: ler('CHAVE_INDICE') };
  return chaves;
}

/** Confere as chaves na inicialização, para o servidor nem subir sem elas. */
export function conferirChaves() {
  obterChaves();
}

/** Já está cifrado? */
export const estaCifrado = (v: unknown) => typeof v === 'string' && v.startsWith(PREFIXO);

export function cifrar(texto: string | null | undefined): string {
  if (texto == null || texto === '' || estaCifrado(texto)) return texto ?? '';
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', obterChaves().cifra, iv);
  const dados = Buffer.concat([c.update(String(texto), 'utf8'), c.final()]);
  return PREFIXO + Buffer.concat([iv, c.getAuthTag(), dados]).toString('base64');
}

export function decifrar(valor: unknown): string {
  if (typeof valor !== 'string' || !estaCifrado(valor)) return (valor as string) ?? '';
  const bruto = Buffer.from(valor.slice(PREFIXO.length), 'base64');
  const d = createDecipheriv('aes-256-gcm', obterChaves().cifra, bruto.subarray(0, 12));
  d.setAuthTag(bruto.subarray(12, 28));
  return Buffer.concat([d.update(bruto.subarray(28)), d.final()]).toString('utf8');
}

/** Índice de busca do WhatsApp (só dígitos). Mesmo número → mesmo índice. */
export function indice(fone: string): string {
  return createHmac('sha256', obterChaves().indice).update(fone.replace(/\D/g, '')).digest('hex');
}

/** Cifra os campos listados de um objeto (os que vierem preenchidos). */
export function cifrarCampos<T extends Record<string, unknown>>(obj: T, campos: string[]): T {
  const out: Record<string, unknown> = { ...obj };
  for (const c of campos) if (typeof out[c] === 'string') out[c] = cifrar(out[c] as string);
  return out as T;
}

/** Decifra os campos listados de um objeto. */
export function decifrarCampos<T extends Record<string, unknown>>(obj: T, campos: string[]): T {
  const out: Record<string, unknown> = { ...obj };
  for (const c of campos) if (c in out) out[c] = decifrar(out[c]);
  return out as T;
}
