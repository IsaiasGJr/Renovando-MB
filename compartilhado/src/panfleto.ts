import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { PASTA_UPLOADS, um } from './db.ts';
import { ErroHttp, naoEncontrado } from './util.ts';

/**
 * Panfleto de cada igreja para imprimir: a arte da campanha (1200 × 470, igual à do site) com o
 * QR Code da página da igreja no quadro branco do canto direito ("Acesse o site apontando a câmera").
 *
 * PDF em A4 deitado, em dois formatos:
 *   1 por página  → panfleto grande (27,7 × 10,9 cm), para cartaz/mural;
 *   6 por página  → 2 colunas × 3 linhas (13,7 × 5,4 cm cada), com linhas de corte, para distribuir.
 */

export const PANFLETO = { largura: 1200, altura: 470 } as const;
/** Quadro branco da arte do site, onde vai o QR Code (medido na arte oficial). */
const QUADRO = { x: 851, y: 32, largura: 349, altura: 328 };
const ESCALA = 2; // desenha em 2400 × 940 para a impressão sair nítida

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
const cortar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function arteLocal(url: string | null | undefined) {
  const nome = url?.match(/^\/uploads\/([\w-]+\.(?:png|jpg|webp))$/i)?.[1];
  return nome ? join(PASTA_UPLOADS, nome) : null;
}

/** Arte padrão (cores da marca) quando a campanha ainda não tem panfleto cadastrado. */
function artePadrao(campanha: string) {
  const { largura: W, altura: H } = PANFLETO;
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7E276A"/><stop offset="1" stop-color="#5C0047"/></linearGradient></defs>
    <style>text{font-family:'Segoe UI',Roboto,'DejaVu Sans',Arial,sans-serif}</style>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <rect x="${QUADRO.x}" y="${QUADRO.y}" width="${QUADRO.largura}" height="${H - QUADRO.y}" fill="#fff"/>
    <text x="60" y="150" font-size="38" font-weight="800" fill="#E9A23B" letter-spacing="4">RENOVANDO A VINHA DO</text>
    <text x="56" y="250" font-size="110" font-weight="900" fill="#fff">SENHOR</text>
    <text x="60" y="320" font-size="34" fill="#F5E8F1">${esc(campanha)}</text>
    <text x="60" y="390" font-size="30" font-weight="700" fill="#fff">A cada R$ 20 ofertados, você concorre a prêmios</text>
    <text x="${QUADRO.x + QUADRO.largura / 2}" y="420" text-anchor="middle" font-size="22" font-weight="700" fill="#36002A">Aponte a câmera do celular</text>
  </svg>`);
}

/** Imagem do panfleto (JPEG 2400 × 940, ~220 dpi impresso) com o QR Code e o nome da igreja. */
export async function imagemPanfleto(p: { arte?: string | null; link: string; igreja: string; campanha: string }) {
  const W = PANFLETO.largura * ESCALA;
  const H = PANFLETO.altura * ESCALA;
  const caminho = arteLocal(p.arte);
  let fundo: Buffer;
  try {
    fundo = await sharp(caminho ?? artePadrao(p.campanha)).resize(W, H, { fit: 'fill' }).png().toBuffer();
  } catch {
    fundo = await sharp(artePadrao(p.campanha)).resize(W, H).png().toBuffer();
  }

  const lado = 250 * ESCALA;
  const qr = await QRCode.toBuffer(p.link, { margin: 1, width: lado, errorCorrectionLevel: 'M', color: { dark: '#1F1A1D', light: '#FFFFFF' } });
  const centroX = (QUADRO.x + QUADRO.largura / 2) * ESCALA;
  const topoQr = (QUADRO.y + 14) * ESCALA;
  const nome = Buffer.from(`<svg width="${QUADRO.largura * ESCALA}" height="${40 * ESCALA}" xmlns="http://www.w3.org/2000/svg">
    <style>text{font-family:'Segoe UI',Roboto,'DejaVu Sans',Arial,sans-serif}</style>
    <text x="50%" y="${28 * ESCALA}" text-anchor="middle" font-size="${17 * ESCALA}" font-weight="700" fill="#5C0047">${esc(cortar(p.igreja, 34))}</text>
  </svg>`);

  return sharp(fundo)
    .composite([
      { input: qr, left: Math.round(centroX - lado / 2), top: topoQr },
      { input: nome, left: QUADRO.x * ESCALA, top: topoQr + lado + 2 * ESCALA },
    ])
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' }) // 4:4:4 mantém o QR Code bem definido
    .toBuffer();
}

/** PDF pronto para imprimir (A4 deitado) com 1 ou 6 panfletos por página. */
export function pdfPanfleto(imagem: Buffer, porPagina: 1 | 6, titulo: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, info: { Title: titulo, Author: 'Renovando a Vinha do Senhor' } });
    const partes: Buffer[] = [];
    doc.on('data', (b: Buffer) => partes.push(b));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    const larguraPagina = doc.page.width; // 841,89 pt
    const alturaPagina = doc.page.height; // 595,28 pt
    const margem = 28; // 1 cm
    const proporcao = PANFLETO.altura / PANFLETO.largura;
    // A imagem entra no arquivo uma vez só e é repetida nas 6 posições (PDF leve).
    // (openImage existe no pdfkit, mas falta nos tipos dele.)
    const img = (doc as unknown as { openImage(b: Buffer): Buffer }).openImage(imagem);

    if (porPagina === 1) {
      const w = larguraPagina - margem * 2;
      const h = w * proporcao;
      doc.image(img, margem, (alturaPagina - h) / 2, { width: w, height: h });
    } else {
      const espaco = 14;
      const w = (larguraPagina - margem * 2 - espaco) / 2;
      const h = w * proporcao;
      const altura3 = h * 3 + espaco * 2;
      const topo = (alturaPagina - altura3) / 2;
      for (let linha = 0; linha < 3; linha++) {
        for (let coluna = 0; coluna < 2; coluna++) {
          const x = margem + coluna * (w + espaco);
          const y = topo + linha * (h + espaco);
          doc.image(img, x, y, { width: w, height: h });
          // Linha tracejada para recortar.
          doc.save().lineWidth(0.4).dash(3, { space: 3 }).strokeColor('#9A909C')
            .rect(x - espaco / 2, y - espaco / 2, w + espaco, h + espaco).stroke().restore();
        }
      }
    }
    doc.end();
  });
}

/** Endereço que o QR Code abre: a página da igreja (abre o app direto nela, ou explica como baixar). */
export const linkDaIgreja = (base: string, slug: string) => `${base.replace(/\/$/, '')}/igreja/${encodeURIComponent(slug)}`;

/** Gera o PDF do panfleto de uma igreja ativa com a arte da campanha ativa. */
export async function pdfPanfletoDaIgreja(igrejaId: string, porPagina: 1 | 6, base: string) {
  const igreja = um<{ slug: string; nomeFantasia: string; status: string }>('SELECT slug, nome_fantasia, status FROM igrejas WHERE id = ?', igrejaId);
  if (!igreja) throw naoEncontrado('Igreja');
  if (igreja.status !== 'ativa') throw new ErroHttp(400, 'O panfleto fica disponível depois que a igreja for aprovada.');
  const campanha = um<{ edicao: string; imagemPanfleto: string }>('SELECT edicao, imagem_panfleto FROM campanhas WHERE ativa = 1');
  const imagem = await imagemPanfleto({
    arte: campanha?.imagemPanfleto, link: linkDaIgreja(base, igreja.slug), igreja: igreja.nomeFantasia, campanha: campanha?.edicao ?? '',
  });
  const pdf = await pdfPanfleto(imagem, porPagina, `Panfleto - ${igreja.nomeFantasia}`);
  return { pdf, nomeArquivo: `panfleto-${igreja.slug}-${porPagina}-por-pagina.pdf` };
}
