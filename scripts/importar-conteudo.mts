// Importa do site o conteúdo oficial que o app mostra: prêmios (valores e fotos), perguntas frequentes,
// Política de Privacidade, depoimentos, notícias, parcerias, banners e a galeria do Palmas para Jesus.
// Uso: npm run importar-conteudo
//
// Só LÊ as páginas públicas do site; não envia nada. Os Termos de Uso NÃO são trocados: no site eles
// estão incompletos (só a seção 1). Antes de mexer, guarda uma cópia do banco em dados/.
// Pode rodar de novo: substitui o conteúdo importado pela versão atual do site.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const { db, executar, inserir, PASTA_DADOS, PASTA_UPLOADS, todos, transacao } = await import('../compartilhado/src/db.ts');
const { novoId, slugify } = await import('../compartilhado/src/util.ts');

const SITE = 'https://www.renovandoavinhadosenhor.com';

// ---------- leitura do site ----------

async function texto(url: string) {
  const r = await fetch(url, { headers: { 'User-Agent': 'renovando-importador' } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
}
const json = async <T,>(url: string) => JSON.parse(await texto(url)) as T;

/** Junta os dados que o site manda dentro da página (formato do Next.js). */
function dadosDaPagina(html: string) {
  let rsc = '';
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try {
      rsc += JSON.parse(`"${m[1]}"`);
    } catch {
      // pedaço que não é texto
    }
  }
  return rsc;
}

/** Lê a lista JSON que começa em `"chave":[` dentro dos dados da página. */
function lista<T>(rsc: string, chave: string): T[] {
  const i = rsc.indexOf(`"${chave}":[`);
  if (i < 0) return [];
  let j = rsc.indexOf('[', i);
  const inicio = j;
  let nivel = 0, emTexto = false;
  for (; j < rsc.length; j++) {
    const c = rsc[j];
    if (emTexto) {
      if (c === '\\') j++;
      else if (c === '"') emTexto = false;
    } else if (c === '"') emTexto = true;
    else if (c === '[' || c === '{') nivel++;
    else if (c === ']' || c === '}') {
      nivel--;
      if (nivel === 0) break;
    }
  }
  return JSON.parse(rsc.slice(inicio, j + 1)) as T[];
}

/** Textos longos vêm como referência ("$41"): busca o bloco "41:T<tamanho>,<texto>". */
function resolver(rsc: string, valor: string) {
  const ref = valor.match(/^\$([0-9a-f]+)$/i)?.[1];
  if (!ref) return valor;
  // Os blocos vêm colados um no outro (sem quebra de linha entre eles).
  const m = new RegExp(`${ref}:T([0-9a-f]+),`).exec(rsc);
  if (!m) return '';
  const resto = Buffer.from(rsc.slice(m.index + m[0].length), 'utf8');
  return resto.subarray(0, parseInt(m[1], 16)).toString('utf8');
}

const ENTIDADES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', apos: "'", ndash: '–', mdash: '—', rdquo: '”', ldquo: '“', rsquo: '’', lsquo: '‘', hellip: '…',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  atilde: 'ã', otilde: 'õ', Atilde: 'Ã', Otilde: 'Õ', acirc: 'â', ecirc: 'ê', ocirc: 'ô', Acirc: 'Â', Ecirc: 'Ê', Ocirc: 'Ô',
  ccedil: 'ç', Ccedil: 'Ç', agrave: 'à', Agrave: 'À', uuml: 'ü', ordm: 'º', ordf: 'ª',
};
const decodificar = (s: string) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (t, n: string) => ENTIDADES[n] ?? t);

/**
 * HTML → texto do app ("## Título", "- item" e parágrafos separados por linha em branco),
 * o formato que o app e o admin já usam.
 */
function htmlParaTexto(html: string) {
  return decodificar(
    html
      .replace(/\r/g, '')
      .replace(/<h[1-6][^>]*>/gi, '\n\n## ').replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '\n- ').replace(/<\/li>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|blockquote|ul|ol|div)>/gi, '\n\n')
      .replace(/<[^>]+>/g, ''),
  )
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
const limpar = (s: string | null | undefined) => decodificar(s ?? '').replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').trim();

/** Baixa uma imagem e grava otimizada (WEBP, sem metadados). */
async function imagem(url: string | null | undefined, lado = 1600) {
  if (!url) return '';
  try {
    const r = await fetch(url.startsWith('/') ? `${SITE}${url}` : url);
    if (!r.ok) return '';
    const pronta = await sharp(Buffer.from(await r.arrayBuffer())).rotate()
      .resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer();
    const nome = `${novoId()}.webp`;
    await writeFile(join(PASTA_UPLOADS, nome), pronta);
    return `/uploads/${nome}`;
  } catch {
    return '';
  }
}

// ---------- coleta (tudo antes de gravar: se o site falhar, nada muda) ----------

console.log('Lendo o site...');
const home = dadosDaPagina(await texto(SITE));
const campanhaSite = (await json<{ data: { id: number; beginning: string; closure: string }[] }>(`${SITE}/api/campaigns`)).data[0];
const premiosSite = (await json<{ prizes: { name: string; price: string; image_url: string; draw_date: string }[] }>(`${SITE}/api/campaign-prizes?campaignId=${campanhaSite.id}`)).prizes;
const faqsSite = (await json<{ data: { question: string; answer: string }[] }>(`${SITE}/api/faq`)).data;
const depoimentosSite = lista<{ title: string; body: string; author: string }>(home, 'testimonials');
const noticiasSite = lista<{ id: string; title: string; content: string; image: string | null; status: string; publish_date: string }>(home, 'initialPosts');
const bannersSite = lista<{ imageUrl: string; linkUrl: string | null; title: string | null }>(home, 'banners');

const privacidadeHtml = await texto(`${SITE}/politica-de-privacidade`);
const corpoPrivacidade = privacidadeHtml.slice(privacidadeHtml.indexOf('<h2'), privacidadeHtml.lastIndexOf('</section>') > 0 ? privacidadeHtml.lastIndexOf('</section>') : undefined);
// Telefone e endereço do site são de exemplo ("(11) 9999-9999", "São Paulo"): ficam de fora até a equipe informar os reais.
const privacidade = htmlParaTexto(corpoPrivacidade.replace(/<footer[\s\S]*$/i, ''))
  .split('\n').filter((l) => !/^(- )?Telefone: \(11\) 9999|^(- )?Endereço: São Paulo/.test(l.trim())).join('\n').replace(/\n{3,}/g, '\n\n');

const projeto = await texto(`${SITE}/projeto`);
const parceirosSite = [...new Map(
  [...projeto.matchAll(/alt="Logo ([^"]+)"[^>]*src="\/_next\/image\?url=([^&"]+)/g)].map((m) => [m[1], decodeURIComponent(m[2])]),
)].map(([nome, url]) => ({ nome: decodificar(nome), url }));

const palmas = await texto(`${SITE}/palmas-para-jesus`);
// Legendas das imagens do projeto, como no site.
const LEGENDAS: Record<string, string> = {
  'masterplan-aerial.jpg': 'Visão conceitual aérea do Centro de Convivência Cristã Palmas para Jesus',
  'lakefront-hotel.jpg': 'Visão conceitual da orla, hotel e restaurantes do Palmas para Jesus',
  'convention-arena.jpg': 'Visão conceitual do centro de convenção e arena gospel do Palmas para Jesus',
  'education-village.jpg': 'Visão conceitual da vila de educação do Palmas para Jesus',
  'sports-camping.jpg': 'Visão conceitual da área de esportes e camping do Palmas para Jesus',
};
const fotosPalmas = [...new Set([...palmas.matchAll(/palmas-para-jesus%2F([\w-]+\.(?:jpg|png|webp))/g)].map((m) => m[1]))]
  .map((arquivo) => ({ url: `/palmas-para-jesus/${arquivo}`, titulo: LEGENDAS[arquivo] ?? 'Palmas para Jesus' }));

console.log(`  ${premiosSite.length} prêmios, ${faqsSite.length} perguntas, ${depoimentosSite.length} depoimentos, ${noticiasSite.length} notícias, ${parceirosSite.length} parcerias, ${bannersSite.length} banners, ${fotosPalmas.length} fotos do Palmas.`);
if (!premiosSite.length || !faqsSite.length || privacidade.length < 500) throw new Error('O site respondeu sem o conteúdo esperado. Nada foi alterado.');

console.log('Baixando imagens...');
const fotosPremios = await Promise.all(premiosSite.map((p) => imagem(p.image_url, 1000)));
const fotosNoticias = await Promise.all(noticiasSite.map((n) => imagem(n.image)));
const logosParceiros = await Promise.all(parceirosSite.map((p) => imagem(p.url, 512)));
const fotosGaleria = await Promise.all(fotosPalmas.map((f) => imagem(f.url)));
const artesBanners = await Promise.all(bannersSite.map((b) => imagem(b.imageUrl, 2000)));

// ---------- gravação ----------

db.exec(`VACUUM INTO '${join(PASTA_DADOS, `backup-antes-importar-conteudo-${Date.now()}.db`).replace(/'/g, "''")}'`);

const diaBrasilia = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
const tipoPremio = (nome: string) => (/pix/i.test(nome) ? 'pix' : /iphone/i.test(nome) ? 'iphone' : /tera|carro|0 ?km/i.test(nome) ? 'carro' : nome.toLowerCase());

const resumo = transacao(() => {
  const r: Record<string, number> = {};
  const campanha = todos<{ id: string }>('SELECT id FROM campanhas WHERE ativa = 1')[0];

  // Campanha: mesmo período do site.
  if (campanha) {
    executar('UPDATE campanhas SET inicio = ?, fim = ? WHERE id = ?', diaBrasilia(campanhaSite.beginning), diaBrasilia(campanhaSite.closure), campanha.id);
  }

  // Prêmios: casa pelo tipo e pela data do sorteio; atualiza valor e foto (não mexe em sorteios já feitos).
  r.premios = 0;
  if (campanha) {
    const nossos = todos<{ id: string; nome: string; dataSorteio: string }>('SELECT id, nome, data_sorteio FROM premios WHERE campanha_id = ?', campanha.id);
    premiosSite.forEach((p, i) => {
      const alvo = nossos.find((n) => tipoPremio(n.nome) === tipoPremio(p.name) && n.dataSorteio.slice(0, 10) === diaBrasilia(p.draw_date));
      const dados = { valorEstimado: Number(p.price), ...(fotosPremios[i] ? { imagemUrl: fotosPremios[i] } : {}) };
      if (alvo) {
        executar(`UPDATE premios SET valor_estimado = ?${dados.imagemUrl ? ', imagem_url = ?' : ''} WHERE id = ?`,
          ...[dados.valorEstimado, ...(dados.imagemUrl ? [dados.imagemUrl] : []), alvo.id]);
      } else {
        inserir('premios', {
          id: novoId(), campanhaId: campanha.id, nome: limpar(p.name), valorEstimado: dados.valorEstimado, imagemUrl: dados.imagemUrl ?? '',
          dataSorteio: `${diaBrasilia(p.draw_date)}T20:00:00-03:00`, principal: tipoPremio(p.name) === 'carro', ordem: i,
        });
      }
      r.premios++;
    });
  }

  executar('DELETE FROM faqs');
  // O aviso de "plataforma em desenvolvimento" do site vem desativado (o admin publica se quiser).
  faqsSite.forEach((f, i) => inserir('faqs', {
    id: novoId(), pergunta: limpar(f.question), resposta: htmlParaTexto(f.answer), publicada: !/em desenvolvimento/i.test(f.question), ordem: i,
  }));
  r.perguntas = faqsSite.length;

  executar("UPDATE paginas SET conteudo = ?, atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug = 'privacidade'", privacidade);

  executar('DELETE FROM depoimentos');
  depoimentosSite.forEach((d, i) => {
    const [autor, ...local] = limpar(d.author).split(/\s+[–-]\s+/);
    inserir('depoimentos', { id: novoId(), titulo: limpar(d.title), texto: limpar(d.body), autor: autor || 'Participante', local: local.join(' – '), publicado: true, ordem: i });
  });
  r.depoimentos = depoimentosSite.length;

  executar('DELETE FROM noticias');
  noticiasSite.filter((n) => n.status === 'published').forEach((n, i) => {
    const conteudo = htmlParaTexto(resolver(home, n.content));
    const slug = slugify(n.id || n.title);
    inserir('noticias', {
      id: novoId(), titulo: limpar(n.title), slug: todos('SELECT 1 FROM noticias WHERE slug = ?', slug).length ? `${slug}-${i}` : slug,
      resumo: conteudo.replace(/^## .*$/gm, '').replace(/\s+/g, ' ').trim().slice(0, 180),
      conteudo, imagemUrl: fotosNoticias[noticiasSite.indexOf(n)], publicada: true, publicadaEm: n.publish_date,
    });
  });
  r.noticias = todos('SELECT 1 FROM noticias').length;

  if (parceirosSite.length) {
    executar('DELETE FROM parceiros');
    parceirosSite.forEach((p, i) => inserir('parceiros', { id: novoId(), nome: p.nome, logoUrl: logosParceiros[i], ordem: i, ativo: true }));
  }
  r.parcerias = parceirosSite.length;

  if (fotosPalmas.length) {
    executar("DELETE FROM galeria WHERE grupo = 'palmas'");
    fotosPalmas.forEach((f, i) => fotosGaleria[i] && inserir('galeria', { id: novoId(), grupo: 'palmas', titulo: f.titulo, imagemUrl: fotosGaleria[i], ordem: i, ativo: true }));
  }
  r.fotosPalmas = fotosGaleria.filter(Boolean).length;

  // Banners: a arte do site vai para o banner com o mesmo link (o da campanha continua sem arte).
  const caminhoApp = (link: string | null) => {
    if (!link) return '';
    const l = link.replace(/\/$/, '');
    if (/renovandoavinhadosenhor\.com\/shows-gospel$/.test(l)) return '/shows';
    return l;
  };
  r.banners = 0;
  bannersSite.forEach((b, i) => {
    const link = caminhoApp(b.linkUrl);
    if (!artesBanners[i] || !link) return;
    // Mesmo link com ou sem a barra no final.
    const existe = todos<{ id: string }>("SELECT id FROM banners WHERE rtrim(link, '/') = ? ORDER BY ordem", link)[0];
    if (existe) executar('UPDATE banners SET imagem_url = ?, ordem = ? WHERE id = ?', artesBanners[i], i + 1, existe.id);
    else inserir('banners', { id: novoId(), titulo: limpar(b.title) || (/modelina/i.test(link) ? 'DiscoveryDet × Modelina' : 'Parceria'), link, imagemUrl: artesBanners[i], ordem: i + 1, ativo: true });
    r.banners++;
  });
  return r;
});

console.log('\nConcluído:', Object.entries(resumo).map(([k, v]) => `${v} ${k}`).join(', '));
console.log('Imagens antigas que deixaram de ser usadas: rode "npm run otimizar-imagens" para guardá-las em dados/uploads-originais.');
