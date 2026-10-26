/**
 * Guias da Central de ajuda. CÓPIA de admin/painel/src/guias.ts: ao mudar um guia lá, mude aqui também.
 */
export type Guia = { grupo: string; titulo: string; passos: string[] };

export const GUIAS: Guia[] = [
  {
    grupo: 'Começando', titulo: 'Primeiro acesso e segurança da conta',
    passos: [
      'Entre com o e-mail e a senha que o administrador criou para você.',
      'Abra Minha conta (clique no seu nome, no menu) e ative a verificação em duas etapas com o Google Authenticator ou similar.',
      'A partir daí, o login pede também o código de 6 dígitos do aplicativo.',
      'Perdeu o celular? Peça a um administrador para desligar a sua verificação em Usuários do painel e ative de novo.',
    ],
  },
  {
    grupo: 'Cadastros', titulo: 'Aprovar igrejas e semeadores',
    passos: [
      'Abra Aprovações: aparecem os cadastros feitos pelo app esperando análise.',
      'Confira os dados (CNPJ, pastor, WhatsApp, quem indicou).',
      'Clique em Aprovar, ou em Recusar e escreva o motivo (opcional).',
      'Quem se cadastrou recebe um aviso no celular, se tiver ativado os avisos no app.',
    ],
  },
  {
    grupo: 'Cadastros', titulo: 'Rede de semeadores (N1 e N2)',
    passos: [
      'Semeador N1 é quem se cadastra sem código de indicação. Ele pode convidar semeadores N2 pelo link de convite que aparece no app (Meu painel).',
      'Quem se cadastra com o código de um N1 entra como N2 da rede dele. Um N2 não pode convidar outros semeadores.',
      'Em Semeadores dá para ver o nível, quem indicou e corrigir a ligação (campo "Semeador N1 da rede").',
      'Igreja indicada por um N2 usa a regra de divisão "com N2" da campanha: a parte de semeador é dividida entre o N2 e o N1.',
    ],
  },
  {
    grupo: 'Cadastros', titulo: 'Mudar dados de uma igreja',
    passos: [
      'Abra Igrejas, procure a igreja e clique em Editar.',
      'O WhatsApp do pastor é o que dá acesso ao Meu painel da igreja no app.',
      'Só administradores podem mudar a chave PIX (fica registrado no Registro de atividades).',
    ],
  },
  {
    grupo: 'Campanha', titulo: 'Criar ou ajustar a campanha',
    passos: [
      'Abra Campanhas e clique em Nova campanha (ou Editar).',
      'Preencha edição, título, valor do cupom, datas e a meta de ofertas.',
      'Ajuste a divisão "sem N2" e a "com N2" (cada uma soma 100%). Os valores que vieram preenchidos são exemplos: confira com a diretoria.',
      'Escolha o parceiro da campanha (cadastrado em Parcerias, com WhatsApp e chave PIX).',
      'Envie as artes: cupom (640 × 930) e panfleto (1200 × 470). O sistema recusa artes em outro formato.',
      'Clique em Ativar: só uma campanha aparece no app por vez.',
    ],
  },
  {
    grupo: 'Campanha', titulo: 'Panfleto de cada igreja',
    passos: [
      'Em Igrejas, nas igrejas ativas, use Panfleto 1/folha (cartaz) ou Panfleto 6/folha (para recortar).',
      'O PDF sai com o QR Code da página da igreja no quadro branco da arte.',
      'O pastor também baixa os dois formatos no app, em Meu painel.',
    ],
  },
  {
    grupo: 'Campanha', titulo: 'Fazer um sorteio e divulgar o ganhador',
    passos: [
      'Abra Prêmios e sorteios. O resumo mostra quantos sorteios faltam.',
      'No prêmio, clique em Sortear: pelo sistema (aleatório) ou informando o número da Loteria Federal.',
      'O ganhador recebe um aviso no celular, e todos recebem o resultado. O prêmio passa a mostrar o número sorteado no app.',
      'Se precisar, use Desfazer sorteio (fica no Registro de atividades).',
    ],
  },
  {
    grupo: 'Ofertas', titulo: 'Ver uma oferta e os cupons dela',
    passos: [
      'Abra Relatórios e clique numa oferta da lista.',
      'Aparecem os cupons gerados e para onde foi cada parte do dinheiro.',
      'Use Baixar planilha para exportar os cupons daquela oferta.',
    ],
  },
  {
    grupo: 'Ofertas', titulo: 'Registrar uma oferta recebida fora do app',
    passos: [
      'Em Relatórios, clique em Registrar oferta (só administradores).',
      'Escolha a igreja, a quantidade de cupons e o WhatsApp de quem ofertou (ou marque anônima).',
      'Diga como a oferta foi recebida (ex.: dinheiro no culto, recibo nº 123).',
      'A oferta entra como paga, gera os números da sorte e os repasses. A pessoa vê os números no app entrando com aquele WhatsApp.',
    ],
  },
  {
    grupo: 'Financeiro', titulo: 'Repasses: pagar igrejas, semeadores e parceiro',
    passos: [
      'Abra Repasses: cada linha mostra quanto falta pagar e a chave PIX.',
      'Faça a transferência pelo banco ou pelo gateway. O SISTEMA NÃO TRANSFERE DINHEIRO.',
      'Volte em Repasses, abra o beneficiário, informe a referência do comprovante e clique em Registrar pagamento.',
      'O saldo vira "recebido" e o beneficiário vê isso no app (Meu painel).',
    ],
  },
  {
    grupo: 'Conteúdo', titulo: 'Avisos no celular',
    passos: [
      'O lembrete na véspera e o resultado de cada sorteio são enviados sozinhos.',
      'Para um aviso especial, abra Avisos no celular, escreva título e mensagem e escolha a tela que abre.',
      'Máximo de 5 avisos por hora.',
    ],
  },
  {
    grupo: 'Conteúdo', titulo: 'Notícias, depoimentos, banners e páginas',
    passos: [
      'Cada item do menu Conteúdo do app tem Novo e Editar.',
      'Itens desmarcados em "Publicado"/"Ativo" não aparecem no app.',
      'Política de Privacidade e Termos ficam em Páginas legais (só administradores).',
    ],
  },
];
