import type {
  Anexo,
  ArtistaDetalhe,
  Banner,
  IgrejaPublica,
  ImagemGaleria,
  MensagemContato,
  PaginaLegal,
  Painel,
  Parceiro,
  Artista,
  Campanha,
  Cupom,
  Depoimento,
  Faq,
  Igreja,
  Noticia,
  NoticiaResumo,
  NovaIgreja,
  NovoSemeador,
  Oferta,
  Premio,
  SolicitacaoShow,
  Usuario,
} from '@/types';

/** Tudo que o app consome da API. */
export interface Api {
  modoTeste(): Promise<boolean>;

  campanha(): Promise<Campanha>;
  premios(): Promise<Premio[]>;
  igrejas(busca?: string): Promise<Igreja[]>;
  noticias(): Promise<NoticiaResumo[]>;
  noticia(slug: string): Promise<Noticia>;
  depoimentos(): Promise<Depoimento[]>;
  faqs(): Promise<Faq[]>;
  artistas(): Promise<Artista[]>;
  artista(slug: string): Promise<ArtistaDetalhe>;
  igreja(slug: string): Promise<IgrejaPublica>;
  banners(): Promise<Banner[]>;
  parceiros(): Promise<Parceiro[]>;
  galeria(grupo: string): Promise<ImagemGaleria[]>;
  pagina(slug: 'privacidade' | 'termos'): Promise<PaginaLegal>;
  enviarAnexo(arquivo: { uri: string; nome: string; tipo: string }): Promise<Anexo>;
  enviarContato(m: MensagemContato): Promise<void>;
  painel(): Promise<Painel>;

  enviarCodigo(whatsapp: string): Promise<void>;
  verificarCodigo(p: {
    whatsapp: string;
    codigo: string;
    nome?: string;
    sobrenome?: string;
  }): Promise<{ token: string; usuario: Usuario }>;

  criarOferta(p: { igrejaId: string; quantidade: number; anonima: boolean }): Promise<Oferta>;
  oferta(ofertaId: string): Promise<Oferta>;
  /** Só funciona com a API em modo de teste: no real quem confirma é o webhook do gateway. */
  simularPagamento(ofertaId: string): Promise<void>;
  meusCupons(): Promise<Cupom[]>;
  /** Exclui a conta do usuário logado (dados pessoais apagados; ofertas pagas ficam anônimas). */
  excluirConta(): Promise<void>;
  /** Encerra o login em todos os aparelhos (inclusive neste). */
  sairDeTodos(): Promise<void>;

  cadastrarIgreja(dados: NovaIgreja): Promise<{ protocolo: string; status: 'pendente' }>;
  cadastrarSemeador(dados: NovoSemeador): Promise<{ status: 'pendente' }>;
  solicitarShow(dados: SolicitacaoShow): Promise<void>;
}
