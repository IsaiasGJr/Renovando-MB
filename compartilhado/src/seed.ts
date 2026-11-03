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
    semearConteudoNovo(demo);
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

  // Em produção a instalação começa limpa: igrejas, perguntas, depoimentos, notícias e artistas reais
  // vêm dos importadores (VIRADA.md, passo 5) e do painel. Os exemplos abaixo são só para desenvolvimento.
  if (!demo) {
    console.log('[seed] Campanha e prêmios criados (produção: sem conteúdo de exemplo).');
    return;
  }
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

  semearOfertasDemo(campanhaId, igrejaIds);
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
function semearConteudoNovo(demo: boolean) {
  if (!um('SELECT 1 FROM banners LIMIT 1')) {
    const banners = [
      ['Edição 2026', 'Oferte, concorra e fortaleça sua igreja.', '/ofertar'],
      ['Voz & Propósito', 'Concurso gospel: sua voz pode inspirar o Brasil.', 'https://the-voice-renovando-gospel-49nj.vercel.app/'],
      ['Shows gospel', 'Contrate artistas para o seu evento.', '/shows'],
      ['Seja um doador', 'Apoie a obra de Deus com a sua oferta.', 'https://renovando-seja-um-doador.vercel.app/'],
    ];
    banners.forEach(([titulo, subtitulo, link], i) => inserir('banners', { id: novoId(), titulo, subtitulo, link, ordem: i }));
  }
  if (demo && !um('SELECT 1 FROM parceiros LIMIT 1')) {
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
const TEXTO_PRIVACIDADE = `## 1. Introdução

O projeto Renovando a Vinha do Senhor está comprometido com a proteção da privacidade e dos dados pessoais de todos os participantes, igrejas parceiras, doadores e visitantes de nossos serviços digitais. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais.

## 2. Informações que Coletamos

## 2.1 Dados Pessoais

- Nome completo e dados de identificação
- Endereço de e-mail e telefone
- Endereço postal
- Informações da igreja ou organização
- Dados bancários para processamento de ofertas

## 2.2 Dados de Navegação

- Endereço IP e localização geográfica
- Tipo de dispositivo e navegador
- Páginas visitadas e tempo de permanência
- Cookies e tecnologias similares

## 3. Como Usamos suas Informações

- Processar ofertas e participações na campanha
- Comunicar sobre sorteios, prêmios e resultados
- Enviar atualizações sobre o projeto e suas ações sociais
- Fornecer suporte técnico e atendimento ao participante
- Cumprir obrigações legais e regulamentares
- Melhorar nossos serviços e experiência do usuário
- Prevenir fraudes e garantir a segurança da plataforma

## 4. Compartilhamento de Dados

Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins comerciais. Podemos compartilhar informações apenas nas seguintes situações:

- Com igrejas parceiras, apenas dados necessários para a participação
- Com processadores de pagamento para transações financeiras
- Com autoridades competentes quando exigido por lei
- Com prestadores de serviços que auxiliam em nossas operações

## 5. Segurança dos Dados

Implementamos medidas técnicas e organizacionais adequadas para proteger seus dados pessoais contra acesso não autorizado, alteração, divulgação ou destruição. Utilizamos criptografia, controles de acesso e monitoramento contínuo de segurança.

## 6. Seus Direitos

De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem os seguintes direitos:

- Acesso aos seus dados pessoais
- Correção de dados incompletos ou inexatos
- Exclusão de dados desnecessários ou tratados irregularmente
- Portabilidade dos dados para outro fornecedor
- Revogação do consentimento
- Informações sobre o uso compartilhado de dados

## 7. Retenção de Dados

Mantemos seus dados pessoais apenas pelo tempo necessário para cumprir as finalidades descritas nesta política, respeitando os prazos legais de retenção e as necessidades do projeto para prestação de contas e transparência.

## 8. Cookies

Utilizamos cookies para melhorar sua experiência de navegação, personalizar conteúdo e analisar o tráfego do site. Você pode gerenciar suas preferências de cookies através das configurações do seu navegador.

## 9. Alterações na Política

Esta Política de Privacidade pode ser atualizada periodicamente. Notificaremos sobre mudanças significativas através de nossos canais de comunicação oficiais.

## 10. Contato

Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato:

E-mail: privacidade@renovandoavinhadosenhor.com

`;

const TEXTO_TERMOS = `Última atualização: Janeiro de 2025

## 1. Aceitação dos Termos

Ao acessar e utilizar os serviços do projeto Renovando a Vinha do Senhor, você concorda em cumprir e ficar vinculado a estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não deve utilizar nossos serviços.

## 2. Sobre o Projeto

O Renovando a Vinha do Senhor é um projeto social cristão que promove campanhas de arrecadação de ofertas para apoiar igrejas e comunidades carentes. Nosso objetivo é fortalecer a fé, promover a solidariedade e gerar impacto social positivo.

## 3. Elegibilidade e Participação

## 3.1 Requisitos Gerais

- Ser maior de 18 anos ou ter autorização dos responsáveis
- Fornecer informações verdadeiras e atualizadas
- Estar vinculado a uma igreja ou organização cristã participante
- Concordar com os valores e princípios cristãos do projeto

## 3.2 Igrejas Participantes

- Devem ser organizações religiosas cristãs legalmente constituídas
- Comprometer-se com transparência na gestão dos recursos
- Fornecer relatórios periódicos sobre o uso das ofertas
- Manter alinhamento com os valores do projeto

## 4. Ofertas e Contribuições

## 4.1 Natureza das Ofertas

As contribuições são ofertas voluntárias de caráter religioso, destinadas ao apoio de igrejas e projetos sociais. Não constituem compra de produtos ou serviços, nem garantem direitos comerciais.

## 4.2 Processamento

- Todas as transações são processadas através de meios seguros
- Confirmação de recebimento será enviada por e-mail
- Não há obrigatoriedade de valor mínimo ou máximo
- Ofertas são finais e não reembolsáveis, exceto em casos específicos

## 5. Sorteios e Prêmios

## 5.1 Participação

- Participação automática mediante oferta qualificada
- Sorteios realizados de forma transparente e auditável
- Resultados divulgados em nossos canais oficiais
- Ganhadores serão contatados diretamente

## 5.2 Prêmios

- Prêmios não podem ser trocados por dinheiro
- Entrega sujeita a confirmação de dados do ganhador
- Impostos e taxas são de responsabilidade do ganhador
- Prazo para reclamação: 30 dias após divulgação

## 6. Uso da Plataforma

## 6.1 Condutas Permitidas

- Usar os serviços conforme sua finalidade
- Fornecer informações verdadeiras
- Respeitar outros usuários e participantes
- Manter confidencialidade de dados de acesso

## 6.2 Condutas Proibidas

- Usar a plataforma para fins ilícitos ou fraudulentos
- Tentar acessar sistemas ou dados não autorizados
- Divulgar conteúdo ofensivo ou inadequado
- Interferir no funcionamento dos serviços
- Criar múltiplas contas para obter vantagens indevidas

## 7. Transparência e Prestação de Contas

Comprometemo-nos com a transparência total na gestão dos recursos arrecadados. Relatórios financeiros e de impacto são publicados regularmente em nossos canais oficiais, detalhando como as ofertas são utilizadas para apoiar igrejas e comunidades beneficiadas.

## 8. Propriedade Intelectual

Todo o conteúdo do projeto, incluindo textos, imagens, logos, vídeos e materiais promocionais, é protegido por direitos autorais. O uso não autorizado deste conteúdo é proibido e pode resultar em medidas legais.

## 9. Limitação de Responsabilidade

O projeto não se responsabiliza por danos indiretos, lucros cessantes ou consequências decorrentes do uso dos serviços. Nossa responsabilidade limita-se ao valor das ofertas processadas inadequadamente, quando comprovada nossa culpa.

## 10. Suspensão e Encerramento

Reservamo-nos o direito de suspender ou encerrar o acesso de usuários que violem estes termos, sem aviso prévio. Em caso de encerramento do projeto, todos os recursos arrecadados serão destinados às finalidades estabelecidas.

## 11. Alterações nos Termos

Estes termos podem ser alterados a qualquer momento. Alterações significativas serão comunicadas através de nossos canais oficiais. O uso continuado dos serviços após as alterações constitui aceitação dos novos termos.

## 12. Lei Aplicável

Estes termos são regidos pelas leis brasileiras. Eventuais disputas serão resolvidas preferencialmente por mediação cristã, ou pelos tribunais competentes do Brasil.

## 13. Contato

Para dúvidas sobre estes termos ou questões relacionadas ao projeto:

- E-mail: contato@renovandoavinhadosenhor.com

## 14. Exclusão de conta

Você pode excluir sua conta a qualquer momento pelo app (Mais → Excluir minha conta) ou pela página de exclusão de conta. Os dados pessoais são apagados; as ofertas já pagas continuam registradas sem identificação, como registro financeiro das igrejas, e os números da sorte da conta excluída deixam de concorrer aos sorteios futuros.`;
