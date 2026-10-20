import { randomInt } from 'node:crypto';
import { cifrar, conferirChaves, indice } from './cripto.ts';
import { completarDadosNovos, migrarCriptografia } from './migracoes.ts';
import { executar, inserir, transacao, um } from './db.ts';
import { confirmarPagamento } from './dominio.ts';
import { novoId, slugify } from './util.ts';

/**
 * Popula o conteúdo inicial na primeira execução (campanha, prêmios, igrejas...).
 * Não faz nada se já houver campanha. Os dois servidores chamam; o lock evita duplicar.
 */
export function semear({ demo }: { demo: boolean }) {
  conferirChaves();
  migrarCriptografia();
  transacao(() => {
    if (!um('SELECT 1 FROM campanhas LIMIT 1')) semearConteudo(demo);
    semearConteudoNovo();
  });
  completarDadosNovos();
}

function semearConteudo(demo: boolean) {
  const campanhaId = novoId();
  inserir('campanhas', {
    id: campanhaId,
    edicao: 'Edição 2026',
    titulo: 'Semeando esperança,',
    subtitulo: 'Distribuindo prêmios.',
    descricao: 'Oferte, concorra a prêmios e fortaleça igrejas e projetos sociais em todo o Brasil.',
    valorCupom: 20,
    divisaoJson: JSON.stringify([
      { rotulo: 'Igreja', percentual: 80 },
      { rotulo: 'Semeador', percentual: 7 },
      { rotulo: 'Parceiro da campanha', percentual: 5 },
      { rotulo: 'Plataforma', percentual: 8 },
    ]),
    inicio: '2026-06-01',
    fim: '2027-02-05',
    ativa: true,
  });

  const premios = [
    ['iPhone 17', 7500, false, '2026-09-30T20:00:00-03:00'],
    ['iPhone 17', 7500, false, '2026-10-30T20:00:00-03:00'],
    ['iPhone 17', 7500, false, '2026-11-30T20:00:00-03:00'],
    ['PIX de R$ 20.000', 20000, false, '2026-12-31T20:00:00-03:00'],
    ['VW Tera 0 km', 92500, true, '2027-02-05T20:00:00-03:00'],
  ] as const;
  premios.forEach(([nome, valor, principal, data], i) =>
    inserir('premios', {
      id: novoId(), campanhaId, nome, valorEstimado: valor, principal, dataSorteio: data, ordem: i,
    }),
  );

  const igrejas = [
    ['Igreja Batista Central', 'Palmas', 'TO'],
    ['Assembleia de Deus Plano Diretor', 'Palmas', 'TO'],
    ['Comunidade Evangélica Nova Vida', 'Araguaína', 'TO'],
    ['Igreja Presbiteriana Renovada', 'Gurupi', 'TO'],
    ['Ministério Fonte de Águas Vivas', 'Goiânia', 'GO'],
    ['Igreja do Evangelho Quadrangular', 'Imperatriz', 'MA'],
  ];
  const igrejaIds = igrejas.map(([nome, cidade, uf], i) => {
    const id = novoId();
    inserir('igrejas', {
      id, protocolo: `EX${1000 + i}`, razaoSocial: nome, nomeFantasia: nome, cidade, uf,
      chavePix: cifrar(`exemplo${i}@igreja.org`), tipoChavePix: 'email', pastorNome: 'Pastor de exemplo',
      status: 'ativa',
    });
    return id;
  });
  inserir('igrejas', {
    id: novoId(), protocolo: 'EX2000', razaoSocial: 'Igreja Missionária Esperança', nomeFantasia: 'Igreja Esperança',
    cidade: 'Porto Nacional', uf: 'TO', chavePix: cifrar('00000000000100'), pastorNome: 'Pastor de exemplo',
    pastorWhatsapp: cifrar('63900000000'), status: 'pendente',
  });

  const faqs = [
    ['Para onde vai minha oferta?', 'A maior parte vai para a igreja que você escolheu, direto no PIX da congregação. O restante apoia semeadores, parceiros, a operação da plataforma e o fundo social, conforme a divisão da campanha.'],
    ['Como recebo os cupons?', 'Assim que o PIX é confirmado, seus números da sorte aparecem em "Meus cupons" no app. Cada R$ 20 vale 1 número.'],
    ['Posso ofertar anonimamente?', 'Sim. Na oferta anônima você contribui sem se identificar, mas não recebe números para os sorteios.'],
    ['Como acompanho os sorteios?', 'Os sorteios são transmitidos ao vivo e o resultado aparece na aba Prêmios. Se você ganhar, nossa equipe entra em contato pelo WhatsApp.'],
  ];
  faqs.forEach(([pergunta, resposta], i) => inserir('faqs', { id: novoId(), pergunta, resposta, ordem: i }));

  const depoimentos = [
    ['Uma resposta de oração', 'Com a campanha conseguimos concluir a construção do templo. Hoje temos um lugar digno para adorar e acolher.', 'Pastor de exemplo', 'Palmas/TO'],
    ['Projetos retomados', 'Revitalizamos o ministério infantil e iniciamos um discipulado para novos convertidos.', 'Liderança de exemplo', 'Araguaína/TO'],
    ['Cestas para quem precisa', 'O apoio chegou em boa hora e levamos alimento e oração a centenas de famílias.', 'Projeto social de exemplo', 'Gurupi/TO'],
  ];
  depoimentos.forEach(([titulo, texto, autor, local], i) =>
    inserir('depoimentos', { id: novoId(), titulo, texto, autor, local, ordem: i }),
  );

  const noticias = [
    ['Seja um Semeador', 'Saiba como cadastrar igrejas e participar do resultado da campanha.',
      'Semeadores são pessoas que apresentam o projeto a igrejas e acompanham sua participação.\n\nPara se tornar semeador, faça o cadastro pelo app. A equipe analisa e retorna pelo WhatsApp.'],
    ['O poder da oferta', 'A oferta é uma declaração de fé que vai muito além do valor financeiro.',
      'Ofertar é participar da obra. Cada contribuição fortalece igrejas locais, projetos sociais e a evangelização.'],
    ['Como envolver sua igreja', 'Passo a passo para cadastrar sua igreja e começar a receber ofertas.',
      'O cadastro leva poucos minutos: dados da igreja, chave PIX da congregação e contato do pastor. Depois da aprovação, a igreja aparece para os ofertantes.'],
  ];
  noticias.forEach(([titulo, resumo, conteudo], i) =>
    inserir('noticias', {
      id: novoId(), titulo, slug: slugify(titulo), resumo, conteudo, publicada: true,
      publicadaEm: new Date(Date.now() - i * 86_400_000).toISOString(),
    }),
  );

  ['Artista de exemplo 1', 'Artista de exemplo 2', 'Banda de exemplo'].forEach((nome, i) =>
    inserir('artistas', { id: novoId(), nome, ordem: i }),
  );

  if (demo) semearOfertasDemo(campanhaId, igrejaIds);
  console.log('[seed] Dados iniciais criados.');
}

/** Ofertas fictícias dos últimos 45 dias para os relatórios terem o que mostrar em desenvolvimento. */
function semearOfertasDemo(campanhaId: string, igrejaIds: string[]) {
  const usuarios = Array.from({ length: 25 }, (_, i) => {
    const id = novoId();
    const fone = `6399900${String(i).padStart(4, '0')}`;
    inserir('usuarios', { id, nome: `Ofertante`, sobrenome: `Demo ${i + 1}`, whatsapp: cifrar(fone), whatsappIndice: indice(fone) });
    return id;
  });
  for (let i = 0; i < 160; i++) {
    const id = novoId();
    const quantidade = [1, 1, 1, 2, 2, 3, 5, 10][randomInt(0, 8)];
    const anonima = randomInt(0, 10) === 0;
    const quando = new Date(Date.now() - randomInt(0, 45 * 86_400_000));
    inserir('ofertas', {
      id, campanhaId, usuarioId: anonima ? null : usuarios[randomInt(0, usuarios.length)],
      igrejaId: igrejaIds[Math.min(randomInt(0, igrejaIds.length + 2), igrejaIds.length - 1)],
      quantidade, valor: quantidade * 20, anonima, txid: `demo${i}${randomInt(0, 1e9)}`, copiaECola: 'demo',
      divisaoJson: um<{ d: string }>('SELECT divisao_json AS d FROM campanhas WHERE id = ?', campanhaId)!.d,
      expiraEm: new Date(quando.getTime() + 1_800_000).toISOString(),
      criadaEm: quando.toISOString(),
    });
    if (randomInt(0, 10) < 8) {
      confirmarPagamento({ id });
      executar('UPDATE ofertas SET paga_em = ? WHERE id = ?', quando.toISOString(), id);
    } else {
      executar("UPDATE ofertas SET status = 'expirada' WHERE id = ?", id);
    }
  }
}

/** Conteúdo das funcionalidades novas (banners, parceiros, páginas legais). Só cria o que estiver vazio. */
function semearConteudoNovo() {
  if (!um('SELECT 1 FROM banners LIMIT 1')) {
    const banners = [
      ['Edição 2026', 'Oferte, concorra e fortaleça sua igreja.', '/ofertar'],
      ['Voz & Propósito', 'Concurso gospel: sua voz pode inspirar o Brasil.', 'https://the-voice-renovando-gospel-49nj.vercel.app/'],
      ['Shows gospel', 'Contrate artistas para o seu evento.', '/shows'],
      ['Seja um doador', 'Apoie a obra de Deus com a sua oferta.', 'https://renovando-seja-um-doador.vercel.app/'],
    ];
    banners.forEach(([titulo, subtitulo, link], i) => inserir('banners', { id: novoId(), titulo, subtitulo, link, ordem: i }));
  }
  if (!um('SELECT 1 FROM parceiros LIMIT 1')) {
    ['Parceiro de exemplo 1', 'Parceiro de exemplo 2', 'Parceiro de exemplo 3'].forEach((nome, i) =>
      inserir('parceiros', { id: novoId(), nome, ordem: i }),
    );
  }
  if (!um("SELECT 1 FROM paginas WHERE slug = 'privacidade'")) {
    inserir('paginas', { id: novoId(), slug: 'privacidade', titulo: 'Política de Privacidade', conteudo: TEXTO_PRIVACIDADE });
  }
  if (!um("SELECT 1 FROM paginas WHERE slug = 'termos'")) {
    inserir('paginas', { id: novoId(), slug: 'termos', titulo: 'Termos de Uso', conteudo: TEXTO_TERMOS });
  }
}

// Textos iniciais (rascunho): revisar com o jurídico antes de publicar. Editáveis no admin → Páginas legais.
const TEXTO_PRIVACIDADE = `## 1. Quem somos
O Renovando a Vinha do Senhor é um projeto cristão de cooperação entre igrejas. Esta política explica como tratamos seus dados pessoais, conforme a Lei Geral de Proteção de Dados (LGPD).

## 2. Dados que coletamos
- Nome, sobrenome e WhatsApp, para criar sua conta e enviar o código de acesso.
- Ofertas realizadas, igreja escolhida e números da sorte.
- Para igrejas e semeadores: CNPJ ou CPF, chave PIX, endereço e contato do responsável.
- Mensagens e arquivos enviados pelo "Fale conosco" e pedidos de show.

## 3. Para que usamos
- Processar ofertas, gerar números da sorte e realizar os sorteios.
- Repassar às igrejas a parte que lhes cabe de cada oferta.
- Avisar sobre sorteios, resultados e entrar em contato com ganhadores.
- Responder mensagens e prevenir fraudes.

## 4. Segurança
CPF, WhatsApp, chave PIX e e-mail ficam criptografados no banco de dados. O acesso administrativo é restrito, registrado e protegido por senha.

## 5. Compartilhamento
Não vendemos seus dados. Compartilhamos apenas o necessário com a igreja escolhida, com o processador de pagamento e com autoridades, quando a lei exigir.

## 6. Seus direitos
Você pode consultar, corrigir ou excluir seus dados. A exclusão da conta pode ser feita no app (Mais → Excluir minha conta) ou pela página de exclusão de conta. Ofertas já pagas permanecem registradas sem identificar você, por obrigação legal e de prestação de contas.

## 7. Contato
contato@renovandoavinhadosenhor.com`;

const TEXTO_TERMOS = `## 1. Aceitação
Ao usar o app e os serviços do Renovando a Vinha do Senhor, você concorda com estes termos.

## 2. Ofertas e cupons
Cada oferta no valor do cupom da campanha gera um número da sorte. Ofertas anônimas não geram números. Os valores são repassados conforme a divisão informada na campanha.

## 3. Sorteios
Os sorteios seguem o regulamento da campanha, com datas e prêmios divulgados no app. Os ganhadores são contatados pelo WhatsApp cadastrado.

## 4. Responsabilidades do usuário
Manter seus dados corretos e não usar o serviço para fins ilícitos ou fraudulentos.

## 5. Exclusão de conta
Você pode excluir sua conta a qualquer momento. Números da sorte de contas excluídas deixam de concorrer.

## 6. Alterações
Estes termos podem ser atualizados. A versão vigente estará sempre disponível no app.

## 7. Contato
contato@renovandoavinhadosenhor.com`;
