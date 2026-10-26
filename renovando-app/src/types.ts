export type Usuario = {
  id: string;
  nome: string;
  sobrenome: string;
  whatsapp: string;
};

export type Campanha = {
  id: string;
  edicao: string;
  titulo: string;
  subtitulo: string;
  valorCupom: number;
  totalPremios: number;
  descricao?: string;
  /** Percentuais da divisão de cada oferta paga. Soma = 100. */
  divisao: { rotulo: string; percentual: number }[];
};

export type Premio = {
  id: string;
  nome: string;
  descricao?: string;
  imagemUrl?: string;
  principal: boolean;
  dataSorteio: string; // ISO
  ganhador?: { nome: string; numero: string; cidade: string };
};

export type Igreja = {
  slug?: string;
  logoUrl?: string;
  id: string;
  nome: string;
  cidade: string;
  uf: string;
};

export type StatusOferta = 'aguardando_pagamento' | 'paga' | 'expirada';

export type Oferta = {
  id: string;
  usuarioId?: string;
  igrejaId: string;
  quantidade: number;
  valor: number;
  anonima: boolean;
  status: StatusOferta;
  criadaEm: string;
  pix: { copiaECola: string; expiraEm: string };
};

export type Cupom = {
  id: string;
  ofertaId: string;
  numero: string;
  igrejaNome: string;
  criadoEm: string;
  /** Nome da campanha, como no site (ex.: "Edição 2026"). */
  campanha: string;
  /** Ativo enquanto a campanha está valendo; depois, expirado. */
  status: 'ativo' | 'expirado';
  /** Nome do prêmio, se este cupom foi sorteado. */
  premio: string | null;
};

export type NovaIgreja = {
  cnpj?: string;
  razaoSocial: string;
  nomeFantasia: string;
  cep: string;
  endereco: string;
  cidade: string;
  uf: string;
  tipoChavePix: 'cnpj' | 'cpf' | 'email' | 'telefone' | 'aleatoria';
  chavePix: string;
  pastorNome: string;
  pastorWhatsapp: string;
  codigoSemeador?: string;
};

export type NoticiaResumo = {
  id: string;
  titulo: string;
  slug: string;
  resumo: string;
  imagemUrl: string;
  publicadaEm: string;
  tamanho: number;
};

export type Noticia = NoticiaResumo & { conteudo: string };

export type Depoimento = { id: string; titulo: string; texto: string; autor: string; local: string };

export type Faq = { id: string; pergunta: string; resposta: string };

export type Artista = { id: string; nome: string; fotoUrl: string; slug?: string };

export type NovoSemeador = {
  nome: string;
  sobrenome: string;
  whatsapp: string;
  cpf: string;
  chavePix: string;
  codigoIndicacao?: string;
};

export type SolicitacaoShow = {
  nome: string;
  whatsapp: string;
  email: string;
  igreja: string;
  cidade: string;
  uf: string;
  dataEvento: string;
  tipo: string;
  publico: string;
  artistas: string[];
  mensagem: string;
};

export type IgrejaPublica = Igreja & { slug: string; logoUrl: string; descricao?: string };
export type Banner = { id: string; titulo: string; subtitulo: string; imagemUrl: string; link: string };
export type Parceiro = { id: string; nome: string; logoUrl: string; site: string };
export type ImagemGaleria = { id: string; titulo: string; imagemUrl: string };
export type PaginaLegal = { slug: string; titulo: string; conteudo: string; atualizadoEm: string };
export type ArtistaDetalhe = Artista & { slug: string; bio: string; galeria: string[] };
export type Anexo = { arquivo: string; nome: string };
export type MensagemContato = { nome: string; sobrenome: string; whatsapp: string; mensagem: string; anexos: Anexo[] };

export type PainelIgreja = {
  id: string; slug: string; nomeFantasia: string; cidade: string; uf: string; status: string; logoUrl: string; protocolo: string;
  arrecadado: number; ofertas: number; cupons: number; repasse: number; saldo: Saldo;
};
/** Repasses: o que já foi pago pela equipe e o que ainda falta receber. */
export type Saldo = { aReceber: number; recebido: number; total: number };
export type Movimentacao = { id: string; papel: string; percentual: number; valor: number; status: 'a_pagar' | 'pago'; criadoEm: string; campanha: string; igreja: string };
export type Painel = {
  igrejas: PainelIgreja[];
  semeador: null | {
    nome: string; codigo: string; status: string; volume: number; comissao: number; semeadoresIndicados: number;
    nivel: 1 | 2; saldo: Saldo; movimentacoes: Movimentacao[];
    rede: { nome: string; status: string; igrejas: number; volume: number }[];
    igrejas: { id: string; nomeFantasia: string; cidade: string; uf: string; status: string; arrecadado: number }[];
  };
  parceiro: null | {
    nome: string; saldo: Saldo; movimentacoes: Movimentacao[];
    campanhas: { edicao: string; ativa: boolean; totalOfertas: number }[];
  };
  percentuais: { igreja: number; semeador: number };
};
