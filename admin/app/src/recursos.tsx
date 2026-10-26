import { api } from '@/api';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Text } from 'react-native';
import { Anexos } from '@/components/Anexos';
import { Selo } from '@/components/admin';
import type { CampoDef } from '@/components/Formulario';
import { cores } from '@/theme';
import { data, dataHora, moeda } from '@/utils/format';

type L = Record<string, any>;

export type Recurso = {
  /** Caminho na API do admin (ex.: "igrejas" → /api/igrejas). */
  caminho: string;
  titulo: string;
  rotuloItem: string;
  feminino?: boolean;
  icone: ComponentProps<typeof Ionicons>['name'];
  descricao?: string;
  soAdmin?: boolean;
  podeCriar?: boolean;
  podeExcluir?: boolean;
  campos: CampoDef[];
  filtroStatus?: { valor: string; rotulo: string }[];
  /** Ações rápidas de status na lista (ex.: aprovar / rejeitar pendentes). */
  acoesRapidas?: (l: L) => { status: string; rotulo: string; perigo?: boolean }[];
  item: (l: L) => { titulo: string; sub?: string; imagem?: string; status?: ReactNode; infos?: [string, ReactNode][] };
};

const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ').map((u) => ({ valor: u, rotulo: u }));
const publicado = (b: boolean) => <Selo status={b ? 'publicada' : 'rascunho'} texto={b ? 'Publicado' : 'Rascunho'} />;
const aprovarRejeitar = (aprovado: string, rejeitado: string) => (l: L) =>
  l.status === 'pendente' ? [{ status: aprovado, rotulo: 'Aprovar' }, { status: rejeitado, rotulo: 'Rejeitar', perigo: true }] : [];

export const RECURSOS: Record<string, Recurso> = {
  igrejas: {
    caminho: 'igrejas', titulo: 'Igrejas', rotuloItem: 'igreja', feminino: true, icone: 'business-outline',
    descricao: 'Igrejas cadastradas pelo app entram como pendentes. Só as ativas aparecem para os ofertantes.',
    filtroStatus: [
      { valor: '', rotulo: 'Todas' }, { valor: 'pendente', rotulo: 'Pendentes' }, { valor: 'ativa', rotulo: 'Ativas' },
      { valor: 'rejeitada', rotulo: 'Rejeitadas' }, { valor: 'inativa', rotulo: 'Inativas' },
    ],
    acoesRapidas: aprovarRejeitar('ativa', 'rejeitada'),
    campos: [
      { nome: 'nomeFantasia', rotulo: 'Nome fantasia', obrigatorio: true, ajuda: 'Nome exibido no app.' },
      { nome: 'razaoSocial', rotulo: 'Razão social', obrigatorio: true },
      { nome: 'cnpj', rotulo: 'CNPJ', tipo: 'telefone' },
      { nome: 'cep', rotulo: 'CEP', tipo: 'telefone' },
      { nome: 'endereco', rotulo: 'Endereço' },
      { nome: 'cidade', rotulo: 'Cidade', obrigatorio: true },
      { nome: 'uf', rotulo: 'UF', tipo: 'select', opcoes: UFS, padrao: 'TO' },
      { nome: 'tipoChavePix', rotulo: 'Tipo da chave PIX', tipo: 'select', padrao: 'cnpj',
        opcoes: [{ valor: 'cnpj', rotulo: 'CNPJ' }, { valor: 'cpf', rotulo: 'CPF' }, { valor: 'email', rotulo: 'E-mail' }, { valor: 'telefone', rotulo: 'Telefone' }, { valor: 'aleatoria', rotulo: 'Aleatória' }] },
      { nome: 'chavePix', rotulo: 'Chave PIX' },
      { nome: 'pastorNome', rotulo: 'Pastor responsável' },
      { nome: 'pastorWhatsapp', rotulo: 'WhatsApp do pastor', tipo: 'telefone' },
      { nome: 'status', rotulo: 'Status', tipo: 'select', padrao: 'ativa',
        opcoes: [{ valor: 'pendente', rotulo: 'Pendente' }, { valor: 'ativa', rotulo: 'Ativa' }, { valor: 'rejeitada', rotulo: 'Rejeitada' }, { valor: 'inativa', rotulo: 'Inativa' }] },
      { nome: 'logoUrl', rotulo: 'Logo da igreja', tipo: 'imagem' },
      { nome: 'slug', rotulo: 'Endereço da página da igreja', ajuda: 'Gerado do nome se ficar vazio. Link: SEU-DOMINIO/igreja/endereco' },
      { nome: 'descricao', rotulo: 'Mensagem na página da igreja', tipo: 'textarea' },
      { nome: 'observacao', rotulo: 'Observação interna', tipo: 'textarea' },
    ],
    item: (l) => ({
      titulo: l.nomeFantasia, sub: `Protocolo ${l.protocolo} · /igreja/${l.slug}`, imagem: l.logoUrl || undefined, status: <Selo status={l.status} />,
      infos: [['Cidade', `${l.cidade}/${l.uf}`], ['Pastor', l.pastorNome || '—'], ['WhatsApp', l.pastorWhatsapp || '—'], ['PIX', l.chavePix || '—'], ['Cadastro', data(l.criadoEm)]],
    }),
  },

  semeadores: {
    caminho: 'semeadores', titulo: 'Semeadores', rotuloItem: 'semeador', icone: 'people-outline',
    descricao: 'Pessoas que indicam igrejas. O código é usado no cadastro das igrejas.',
    filtroStatus: [
      { valor: '', rotulo: 'Todos' }, { valor: 'pendente', rotulo: 'Pendentes' }, { valor: 'ativo', rotulo: 'Ativos' },
      { valor: 'rejeitado', rotulo: 'Rejeitados' }, { valor: 'inativo', rotulo: 'Inativos' },
    ],
    acoesRapidas: aprovarRejeitar('ativo', 'rejeitado'),
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
      { nome: 'sobrenome', rotulo: 'Sobrenome' },
      { nome: 'whatsapp', rotulo: 'WhatsApp', tipo: 'telefone', obrigatorio: true },
      { nome: 'cpf', rotulo: 'CPF', tipo: 'telefone' },
      { nome: 'chavePix', rotulo: 'Chave PIX' },
      { nome: 'codigo', rotulo: 'Código de indicação', obrigatorio: true },
      { nome: 'status', rotulo: 'Status', tipo: 'select', padrao: 'ativo',
        opcoes: [{ valor: 'pendente', rotulo: 'Pendente' }, { valor: 'ativo', rotulo: 'Ativo' }, { valor: 'rejeitado', rotulo: 'Rejeitado' }, { valor: 'inativo', rotulo: 'Inativo' }] },
      { nome: 'paiId', rotulo: 'Semeador N1 da rede', tipo: 'select', padrao: '', ajuda: 'Preencha só se este semeador for N2 (trazido por um N1).',
        carregarOpcoes: async () => [{ valor: '', rotulo: 'Nenhum (é um N1)' }, ...(await api<L[]>('/semeadores?status=ativo'))
          .filter((x) => !x.paiId).map((x) => ({ valor: String(x.id), rotulo: `${x.nome} ${x.sobrenome} (${x.codigo})` }))] },
      { nome: 'observacao', rotulo: 'Observação / motivo da recusa', tipo: 'textarea' },
    ],
    item: (l) => ({
      titulo: `${l.nome} ${l.sobrenome}`, sub: `Código ${l.codigo}`, status: <Selo status={l.status} />,
      infos: [['Nível', l.nivel === 2 ? `N2 · rede de ${l.indicadoPor}` : `N1${l.n2 ? ` · ${l.n2} N2` : ''}`], ['Igrejas', String(l.igrejas ?? 0)], ['WhatsApp', l.whatsapp], ['Cadastro', data(l.criadoEm)]],
    }),
  },

  premios: {
    caminho: 'premios', titulo: 'Prêmios e sorteios', rotuloItem: 'prêmio', icone: 'gift-outline',
    descricao: 'Os prêmios da campanha aparecem no app com data e ganhador.',
    campos: [
      { nome: 'nome', rotulo: 'Nome do prêmio', obrigatorio: true },
      { nome: 'dataSorteio', rotulo: 'Data e hora do sorteio', tipo: 'datahora', obrigatorio: true },
      { nome: 'valorEstimado', rotulo: 'Valor estimado (R$)', tipo: 'numero', padrao: 0 },
      { nome: 'ordem', rotulo: 'Ordem de exibição', tipo: 'numero', padrao: 0 },
      { nome: 'principal', rotulo: 'Prêmio principal', tipo: 'checkbox', ajuda: 'Destaque no app.' },
      { nome: 'imagemUrl', rotulo: 'Imagem', tipo: 'imagem' },
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea' },
    ],
    item: (l) => ({
      titulo: l.nome, imagem: l.imagemUrl,
      status: l.ganhadorNumero ? <Selo status="ativa" texto={`Nº ${l.ganhadorNumero}`} /> : <Selo status="" texto="A sortear" />,
      infos: [
        ['Sorteio', dataHora(l.dataSorteio)], ['Valor', moeda(l.valorEstimado)],
        ...(l.principal ? [['Destaque', 'Prêmio principal'] as [string, ReactNode]] : []),
        ...(l.ganhadorNumero ? [['Ganhador', `${l.ganhadorNome} · ${l.ganhadorCidade}`] as [string, ReactNode]] : []),
      ],
    }),
  },

  noticias: {
    caminho: 'noticias', titulo: 'Notícias', rotuloItem: 'notícia', feminino: true, icone: 'newspaper-outline',
    descricao: 'Aparecem em “Novidades” no app. Só as publicadas ficam visíveis.',
    campos: [
      { nome: 'titulo', rotulo: 'Título', obrigatorio: true },
      { nome: 'resumo', rotulo: 'Resumo', ajuda: 'Uma ou duas frases para a lista de notícias.' },
      { nome: 'imagemUrl', rotulo: 'Imagem de capa', tipo: 'imagem' },
      { nome: 'conteudo', rotulo: 'Texto completo', tipo: 'textarea', ajuda: 'Separe os parágrafos com uma linha em branco.' },
      { nome: 'publicada', rotulo: 'Publicada', tipo: 'checkbox' },
      { nome: 'publicadaEm', rotulo: 'Data de publicação', tipo: 'datahora', ajuda: 'Em branco = agora, ao publicar.' },
    ],
    item: (l) => ({ titulo: l.titulo, sub: l.resumo, imagem: l.imagemUrl, status: publicado(l.publicada), infos: [['Publicação', dataHora(l.publicadaEm)]] }),
  },

  depoimentos: {
    caminho: 'depoimentos', titulo: 'Depoimentos', rotuloItem: 'depoimento', icone: 'chatbubble-ellipses-outline',
    descricao: 'Testemunhos exibidos na tela inicial do app.',
    campos: [
      { nome: 'titulo', rotulo: 'Título', obrigatorio: true },
      { nome: 'texto', rotulo: 'Depoimento', tipo: 'textarea', obrigatorio: true },
      { nome: 'autor', rotulo: 'Autor', obrigatorio: true },
      { nome: 'local', rotulo: 'Cidade/UF ou igreja' },
      { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
      { nome: 'publicado', rotulo: 'Publicado', tipo: 'checkbox', padrao: true },
    ],
    item: (l) => ({ titulo: l.titulo, sub: `${l.autor}${l.local ? ` · ${l.local}` : ''}`, status: publicado(l.publicado) }),
  },

  faqs: {
    caminho: 'faqs', titulo: 'Perguntas frequentes', rotuloItem: 'pergunta', feminino: true, icone: 'help-circle-outline',
    campos: [
      { nome: 'pergunta', rotulo: 'Pergunta', obrigatorio: true },
      { nome: 'resposta', rotulo: 'Resposta', tipo: 'textarea', obrigatorio: true },
      { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
      { nome: 'publicada', rotulo: 'Publicada', tipo: 'checkbox', padrao: true },
    ],
    item: (l) => ({ titulo: l.pergunta, sub: l.resposta, status: publicado(l.publicada) }),
  },

  artistas: {
    caminho: 'artistas', titulo: 'Artistas (shows)', rotuloItem: 'artista', icone: 'musical-notes-outline',
    descricao: 'Catálogo de artistas exibido na página de shows do app.',
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
      { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
      { nome: 'fotoUrl', rotulo: 'Foto principal', tipo: 'imagem' },
      { nome: 'bio', rotulo: 'Biografia', tipo: 'textarea' },
      { nome: 'galeria', rotulo: 'Galeria de fotos', tipo: 'galeria', ajuda: 'Até 20 fotos, mostradas na página do artista.' },
      { nome: 'ativo', rotulo: 'Visível no catálogo', tipo: 'checkbox', padrao: true },
    ],
    item: (l) => ({ titulo: l.nome, imagem: l.fotoUrl, status: <Selo status={l.ativo ? 'ativo' : 'inativo'} /> }),
  },

  'solicitacoes-show': {
    caminho: 'solicitacoes-show', titulo: 'Pedidos de show', rotuloItem: 'pedido', icone: 'mic-outline',
    descricao: 'Pedidos enviados pelo app. Fale com o solicitante e atualize a situação.',
    podeCriar: false,
    filtroStatus: [
      { valor: '', rotulo: 'Todos' }, { valor: 'nova', rotulo: 'Novos' }, { valor: 'em_contato', rotulo: 'Em contato' },
      { valor: 'fechada', rotulo: 'Fechados' }, { valor: 'descartada', rotulo: 'Descartados' },
    ],
    campos: [
      { nome: 'status', rotulo: 'Situação', tipo: 'select',
        opcoes: [{ valor: 'nova', rotulo: 'Novo' }, { valor: 'em_contato', rotulo: 'Em contato' }, { valor: 'fechada', rotulo: 'Fechado' }, { valor: 'descartada', rotulo: 'Descartado' }] },
      { nome: 'mensagem', rotulo: 'Mensagem do solicitante', tipo: 'textarea' },
    ],
    item: (l) => ({
      titulo: l.nome, sub: `${l.whatsapp} · ${l.email}`, status: <Selo status={l.status} />,
      infos: [
        ['Evento', `${data(`${l.dataEvento}T12:00:00`)} · ${l.cidade}/${l.uf}`],
        ['Artistas', <Text key="a" style={{ color: cores.texto, textAlign: 'right' }}>{l.artistas}</Text>],
        ...(l.tipo ? [['Tipo', l.tipo] as [string, ReactNode]] : []),
        ...(l.publico ? [['Público', `${l.publico} pessoas`] as [string, ReactNode]] : []),
        ['Recebido', data(l.criadoEm)],
      ],
    }),
  },

  banners: {
    caminho: 'banners', titulo: 'Banners do topo', rotuloItem: 'banner', icone: 'images-outline',
    descricao: 'Faixas rotativas no início do app. Sem imagem, o app usa as cores da marca.',
    campos: [
      { nome: 'titulo', rotulo: 'Título', obrigatorio: true },
      { nome: 'subtitulo', rotulo: 'Subtítulo' },
      { nome: 'imagemUrl', rotulo: 'Imagem (horizontal)', tipo: 'imagem' },
      { nome: 'link', rotulo: 'Ao tocar, abre', ajuda: 'Tela do app (ex.: /shows, /ofertar, /igrejas) ou site começando com https://' },
      { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
      { nome: 'ativo', rotulo: 'Visível no app', tipo: 'checkbox', padrao: true },
    ],
    item: (l) => ({ titulo: l.titulo, sub: l.subtitulo, imagem: l.imagemUrl || undefined, status: <Selo status={l.ativo ? 'ativo' : 'inativo'} />, infos: [['Abre', l.link || '—']] }),
  },

  parceiros: {
    caminho: 'parceiros', titulo: 'Parcerias', rotuloItem: 'parceiro', icone: 'hand-left-outline',
    descricao: 'Rede de parceiros mostrada na página do projeto.',
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
      { nome: 'site', rotulo: 'Site (opcional)', ajuda: 'Começando com https://' },
      { nome: 'logoUrl', rotulo: 'Logo', tipo: 'imagem' },
      { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
      { nome: 'ativo', rotulo: 'Visível no app', tipo: 'checkbox', padrao: true },
      { nome: 'whatsapp', rotulo: 'WhatsApp do responsável', tipo: 'telefone', ajuda: 'Parceiro da campanha entra no app com este número e vê saldo e movimentações.' },
      { nome: 'tipoChavePix', rotulo: 'Tipo de chave PIX', tipo: 'select', padrao: 'cnpj',
        opcoes: [{ valor: 'cnpj', rotulo: 'CNPJ' }, { valor: 'cpf', rotulo: 'CPF' }, { valor: 'email', rotulo: 'E-mail' }, { valor: 'telefone', rotulo: 'Telefone' }, { valor: 'aleatoria', rotulo: 'Aleatória' }] },
      { nome: 'chavePix', rotulo: 'Chave PIX (para os repasses)', ajuda: 'Só administradores definem. Fica criptografada.' },
    ],
    item: (l) => ({ titulo: l.nome, sub: l.site, imagem: l.logoUrl || undefined, status: <Selo status={l.ativo ? 'ativo' : 'inativo'} /> }),
  },

  galeria: {
    caminho: 'galeria', titulo: 'Galeria Palmas para Jesus', rotuloItem: 'imagem', feminino: true, icone: 'image-outline',
    descricao: 'Imagens conceituais mostradas na página do Palmas para Jesus.',
    campos: [
      { nome: 'imagemUrl', rotulo: 'Imagem', tipo: 'imagem', obrigatorio: true },
      { nome: 'titulo', rotulo: 'Legenda' },
      { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
      { nome: 'ativo', rotulo: 'Visível no app', tipo: 'checkbox', padrao: true },
    ],
    item: (l) => ({ titulo: l.titulo || 'Imagem', imagem: l.imagemUrl, status: <Selo status={l.ativo ? 'ativo' : 'inativo'} /> }),
  },

  paginas: {
    caminho: 'paginas', titulo: 'Páginas legais', rotuloItem: 'página', feminino: true, icone: 'document-lock-outline', soAdmin: true,
    descricao: 'Política de Privacidade e Termos de Uso do app. Use “## Título” para subtítulos e “- item” para listas.',
    podeCriar: false, podeExcluir: false,
    campos: [
      { nome: 'slug', rotulo: 'Página', tipo: 'select', opcoes: [{ valor: 'privacidade', rotulo: 'Privacidade' }, { valor: 'termos', rotulo: 'Termos' }] },
      { nome: 'titulo', rotulo: 'Título', obrigatorio: true },
      { nome: 'conteudo', rotulo: 'Texto', tipo: 'textarea', obrigatorio: true },
    ],
    item: (l) => ({ titulo: l.titulo, infos: [['Atualizada em', data(l.atualizadoEm)]] }),
  },

  mensagens: {
    caminho: 'mensagens', titulo: 'Mensagens', rotuloItem: 'mensagem', feminino: true, icone: 'mail-unread-outline',
    descricao: 'Mensagens do “Fale conosco”. Toque num anexo para baixar e compartilhar.',
    podeCriar: false,
    filtroStatus: [
      { valor: '', rotulo: 'Todas' }, { valor: 'nova', rotulo: 'Novas' }, { valor: 'em_contato', rotulo: 'Em contato' },
      { valor: 'respondida', rotulo: 'Respondidas' }, { valor: 'arquivada', rotulo: 'Arquivadas' },
    ],
    campos: [
      { nome: 'status', rotulo: 'Situação', tipo: 'select',
        opcoes: [{ valor: 'nova', rotulo: 'Nova' }, { valor: 'em_contato', rotulo: 'Em contato' }, { valor: 'respondida', rotulo: 'Respondida' }, { valor: 'arquivada', rotulo: 'Arquivada' }] },
    ],
    item: (l) => ({
      titulo: `${l.nome} ${l.sobrenome}`.trim(), sub: l.whatsapp,
      status: <Selo status={l.status === 'respondida' ? 'fechada' : l.status === 'arquivada' ? 'inativo' : l.status} />,
      infos: [
        ['Mensagem', <Text key="m" style={{ color: cores.texto, textAlign: 'right' }}>{l.mensagem}</Text>],
        ['Recebida', dataHora(l.criadoEm)],
        ...((l.anexos ?? []).length ? [['Anexos', <Anexos key="a" anexos={l.anexos} />] as [string, ReactNode]] : []),
      ],
    }),
  },

  admins: {
    caminho: 'admins', titulo: 'Usuários do admin', rotuloItem: 'usuário', icone: 'shield-checkmark-outline', soAdmin: true,
    descricao: 'Editores cuidam de igrejas e conteúdo. Administradores também gerenciam campanhas, sorteios e usuários.',
    podeExcluir: false,
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
      { nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true },
      { nome: 'senha', rotulo: 'Senha', tipo: 'senha', ajuda: 'Mínimo de 8 caracteres. Ao editar, deixe em branco para manter.' },
      { nome: 'papel', rotulo: 'Papel', tipo: 'select', padrao: 'editor', opcoes: [{ valor: 'editor', rotulo: 'Editor' }, { valor: 'admin', rotulo: 'Administrador' }] },
      { nome: 'ativo', rotulo: 'Ativo', tipo: 'checkbox', padrao: true },
      { nome: 'totpAtivo', rotulo: 'Verificação em duas etapas', tipo: 'checkbox', padrao: false, ajuda: 'Só a própria pessoa ativa (em Conta). Desmarque para desligar, se ela perdeu o celular.' },
    ],
    item: (l) => ({
      titulo: l.nome, sub: l.email, status: <Selo status={l.ativo ? 'ativo' : 'inativo'} />,
      infos: [['Papel', l.papel === 'admin' ? 'Administrador' : 'Editor'], ['2 etapas', l.totpAtivo ? 'Ativa' : 'Não']],
    }),
  },
};
