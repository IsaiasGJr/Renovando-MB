import { join } from 'node:path';
import sharp from 'sharp';
import { PASTA_UPLOADS } from './db.ts';

/** Dados escritos no bilhete. */
export type DadosCupom = { numero: string; igreja: string; campanha: string; emissao: string; titular: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
const cortar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Data como no site: "20 de out. de 2026, 15:03" (horário de Brasília). */
export function dataEmissao(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  });
}

/** Caminho local da arte (/uploads/arquivo.webp), só se for um arquivo de upload válido. */
function arteLocal(url: string | null | undefined) {
  const nome = url?.match(/^\/uploads\/([\w-]+\.(?:png|jpg|webp))$/i)?.[1];
  return nome ? join(PASTA_UPLOADS, nome) : null;
}

/**
 * Gera o bilhete do cupom no formato do site: a arte da campanha (topo com a marca e os prêmios,
 * picote e "CUPOM DE PARTICIPAÇÃO") com o número e os dados escritos no espaço em branco de baixo.
 * Sem arte cadastrada, desenha um bilhete com as cores da marca.
 */
export async function gerarImagemCupom(d: DadosCupom, arte?: string | null): Promise<Buffer> {
  const caminho = arteLocal(arte);
  if (caminho) {
    try {
      const meta = await sharp(caminho).metadata();
      const width = 960;
      const height = Math.round(((meta.height ?? 1395) * width) / (meta.width ?? width));
      const fundo = sharp(caminho).resize({ width });
      const y = (f: number) => Math.round(height * f);
      const fs = (f: number) => Math.round(width * f);
      const texto = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <style>text{font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif}</style>
        <text x="50%" y="${y(0.88)}" text-anchor="middle" font-size="${fs(0.075)}" font-weight="800" fill="#5C0047" letter-spacing="${fs(0.006)}">Nº ${esc(d.numero)}</text>
        <text x="50%" y="${y(0.912)}" text-anchor="middle" font-size="${fs(0.027)}" font-weight="700" fill="#1F1A1D">${esc(cortar(d.igreja, 48))}</text>
        <text x="50%" y="${y(0.936)}" text-anchor="middle" font-size="${fs(0.023)}" fill="#475569">${esc(cortar(`${d.titular} · ${d.campanha} · ${d.emissao}`, 64))}</text>
      </svg>`;
      return await fundo.composite([{ input: Buffer.from(texto) }]).jpeg({ quality: 90 }).toBuffer();
    } catch {
      // arte ilegível: cai no bilhete padrão
    }
  }

  const W = 960, H = 1395;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7E276A"/><stop offset="1" stop-color="#5C0047"/></linearGradient></defs>
    <style>text{font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif}</style>
    <rect width="${W}" height="${H}" rx="48" fill="#F4F5F9"/>
    <rect width="${W}" height="${H * 0.66}" rx="48" fill="url(#g)"/>
    <rect y="${H * 0.6}" width="${W}" height="${H * 0.06}" fill="url(#g)"/>
    <text x="50%" y="${H * 0.2}" text-anchor="middle" font-size="44" font-weight="800" fill="#E9A23B" letter-spacing="6">RENOVANDO A VINHA DO</text>
    <text x="50%" y="${H * 0.29}" text-anchor="middle" font-size="120" font-weight="900" fill="#fff">SENHOR</text>
    <text x="50%" y="${H * 0.38}" text-anchor="middle" font-size="40" fill="#F5E8F1">${esc(d.campanha)}</text>
    <circle cx="0" cy="${H * 0.69}" r="44" fill="#fff"/><circle cx="${W}" cy="${H * 0.69}" r="44" fill="#fff"/>
    ${Array.from({ length: 9 }, (_, i) => `<circle cx="${120 + i * 90}" cy="${H * 0.69}" r="14" fill="#fff"/>`).join('')}
    <text x="50%" y="${H * 0.8}" text-anchor="middle" font-size="48" font-weight="800" fill="#0F172A">CUPOM DE PARTICIPAÇÃO</text>
    <text x="50%" y="${H * 0.872}" text-anchor="middle" font-size="72" font-weight="800" fill="#5C0047" letter-spacing="6">Nº ${esc(d.numero)}</text>
    <text x="50%" y="${H * 0.905}" text-anchor="middle" font-size="26" font-weight="700" fill="#1F1A1D">${esc(cortar(d.igreja, 48))}</text>
    <text x="50%" y="${H * 0.93}" text-anchor="middle" font-size="22" fill="#475569">${esc(cortar(`${d.titular} · ${d.emissao}`, 64))}</text>
    <text x="50%" y="${H * 0.972}" text-anchor="middle" font-size="22" font-weight="600" fill="#0F172A">emitido por renovandoavinhadosenhor.com</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}
