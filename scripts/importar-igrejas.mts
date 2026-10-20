// Importa as igrejas credenciadas do site (nome, razão social, cidade, endereço, logo e chave PIX).
// Uso: npm run importar-igrejas
// Só LÊ a lista pública do site; não envia nada para ele. Pode rodar de novo: atualiza as que já existem
// (pelo endereço/slug) sem duplicar e sem mexer em status, pastor, semeador ou ofertas.
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

process.loadEnvFile(new URL('../api/.env', import.meta.url));
const { db, inserir, PASTA_UPLOADS, um } = await import('../compartilhado/src/db.ts');
const { cifrar } = await import('../compartilhado/src/cripto.ts');
const { novoId, slugify, slugUnico } = await import('../compartilhado/src/util.ts');

const SITE = 'https://www.renovandoavinhadosenhor.com';

type IgrejaSite = {
  slug: string; trading_name: string; legal_name: string; city: string; state: string;
  address: string | null; logo_url: string | null; pix_key: string | null; status: boolean;
};

const TIPOS: Record<string, string> = { cnpj: 'cnpj', cpf: 'cpf', email: 'email', phone: 'telefone', random: 'aleatoria', evp: 'aleatoria' };
const limpar = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Baixa a logo, confere que é imagem e grava reduzida (512 px, WEBP, sem metadados). */
async function baixarLogo(url: string) {
  try {
    const r = await fetch(url);
    if (!r.ok) return '';
    const original = Buffer.from(await r.arrayBuffer());
    const pronta = await sharp(original).rotate()
      .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 }).toBuffer();
    const nome = `${novoId()}.webp`;
    await writeFile(join(PASTA_UPLOADS, nome), pronta);
    return `/uploads/${nome}`;
  } catch {
    return '';
  }
}

const resposta = await fetch(`${SITE}/api/churches?campaignId=16`);
if (!resposta.ok) throw new Error(`Não foi possível ler a lista do site (HTTP ${resposta.status}).`);
const lista = ((await resposta.json()) as { data: IgrejaSite[] }).data;
console.log(`${lista.length} igrejas no site.`);

let novas = 0, atualizadas = 0;
for (const c of lista) {
  const nome = limpar(c.trading_name) || limpar(c.legal_name);
  let pix = { chave: '', tipo: 'cnpj' };
  try {
    const p = JSON.parse(c.pix_key ?? 'null') as { key?: string; type?: string } | null;
    if (p?.key) pix = { chave: limpar(p.key), tipo: TIPOS[String(p.type).toLowerCase()] ?? 'aleatoria' };
  } catch {
    // chave em formato inesperado: fica em branco para o admin preencher
  }
  const slugSite = slugify(c.slug || nome);
  const existente = um<{ id: string; logoUrl: string }>('SELECT id, logo_url FROM igrejas WHERE slug = ?', slugSite);
  const dados = {
    nomeFantasia: nome,
    razaoSocial: limpar(c.legal_name) || nome,
    cidade: limpar(c.city),
    uf: limpar(c.state).toUpperCase().slice(0, 2),
    endereco: limpar(c.address),
  };

  if (existente) {
    const logo = existente.logoUrl || (c.logo_url ? await baixarLogo(c.logo_url) : '');
    db.prepare('UPDATE igrejas SET nome_fantasia = ?, razao_social = ?, cidade = ?, uf = ?, endereco = ?, logo_url = ? WHERE id = ?')
      .run(dados.nomeFantasia, dados.razaoSocial, dados.cidade, dados.uf, dados.endereco, logo, existente.id);
    atualizadas++;
    continue;
  }
  const slug = slugUnico((x) => !!um('SELECT 1 FROM igrejas WHERE slug = ?', x), slugSite);
  inserir('igrejas', {
    id: novoId(),
    protocolo: `IG${Date.now().toString(36).toUpperCase()}${novas}`,
    ...dados,
    slug,
    tipoChavePix: pix.tipo,
    chavePix: cifrar(pix.chave),
    logoUrl: c.logo_url ? await baixarLogo(c.logo_url) : '',
    status: c.status ? 'ativa' : 'inativa',
    observacao: 'Importada do site renovandoavinhadosenhor.com',
  });
  novas++;
  console.log(`  ✓ ${nome} (${dados.cidade}/${dados.uf})`);
}

// As igrejas de exemplo da instalação deixam de aparecer no app (os dados delas continuam nos relatórios).
const exemplos = db.prepare(
  `UPDATE igrejas SET status = 'inativa', observacao = 'Igreja de exemplo (dados fictícios)'
    WHERE status = 'ativa' AND nome_fantasia IN ('Igreja Batista Central', 'Assembleia de Deus Plano Diretor',
      'Comunidade Evangélica Nova Vida', 'Igreja Presbiteriana Renovada', 'Ministério Fonte de Águas Vivas',
      'Igreja do Evangelho Quadrangular') AND observacao NOT LIKE 'Importada%'`,
).run().changes;

console.log(`\nConcluído: ${novas} nova(s), ${atualizadas} atualizada(s)${exemplos ? `, ${exemplos} igreja(s) de exemplo ocultada(s) do app` : ''}.`);
