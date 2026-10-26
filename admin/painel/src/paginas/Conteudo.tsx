import { useState } from 'react';
import { baixar, data, dataHora } from '../api';
import { CrudPagina } from '../componentes/CrudPagina';
import { Erro, Selo } from '../componentes/ui';

const LINKS_APP = '/ofertar, /shows, /igrejas, /premios, /projeto, /palmas-para-jesus, /noticias, /contato';

type Banner = { id: string; titulo: string; subtitulo: string; imagemUrl: string; link: string; ordem: number; ativo: boolean };
export function Banners() {
  return (
    <CrudPagina<Banner>
      recurso="banners"
      titulo="Banners do topo"
      sub="Faixas rotativas no início do app. Sem imagem, o app usa o fundo com as cores da marca."
      rotuloItem="banner"
      campos={[
        { nome: 'titulo', rotulo: 'Título', obrigatorio: true },
        { nome: 'subtitulo', rotulo: 'Subtítulo' },
        { nome: 'imagemUrl', rotulo: 'Imagem (horizontal, ex.: 1200×500)', tipo: 'imagem' },
        { nome: 'link', rotulo: 'Ao tocar, abre', largo: true, ajuda: `Uma tela do app (${LINKS_APP}) ou um site começando com https://` },
        { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
        { nome: 'ativo', rotulo: 'Visível no app', tipo: 'checkbox', padrao: true },
      ]}
      colunas={[
        { titulo: '', render: (b) => (b.imagemUrl ? <img className="miniatura" src={b.imagemUrl} alt="" /> : null) },
        { titulo: 'Banner', render: (b) => <><strong>{b.titulo}</strong><div style={{ color: 'var(--texto-3)', fontSize: 12 }}>{b.subtitulo}</div></> },
        { titulo: 'Abre', render: (b) => <code>{b.link || '—'}</code> },
        { titulo: 'Ordem', num: true, render: (b) => b.ordem },
        { titulo: 'Status', render: (b) => <Selo status={b.ativo ? 'ativo' : 'inativo'} /> },
      ]}
    />
  );
}

type Parceiro = { id: string; nome: string; logoUrl: string; site: string; ordem: number; ativo: boolean; whatsapp?: string; chavePix?: string; tipoChavePix?: string };
export function Parceiros() {
  return (
    <CrudPagina<Parceiro>
      recurso="parceiros"
      titulo="Parcerias"
      sub="Rede de parceiros mostrada na página do projeto."
      rotuloItem="parceiro"
      campos={[
        { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
        { nome: 'site', rotulo: 'Site (opcional)', ajuda: 'Começando com https://' },
        { nome: 'logoUrl', rotulo: 'Logo', tipo: 'imagem' },
        { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
        { nome: 'ativo', rotulo: 'Visível no app', tipo: 'checkbox', padrao: true },
        { nome: 'whatsapp', rotulo: 'WhatsApp do responsável', ajuda: 'Se este parceiro for o parceiro da campanha: com este número ele entra no app (Meu painel) e vê saldo e movimentações.' },
        {
          nome: 'tipoChavePix', rotulo: 'Tipo de chave PIX', tipo: 'select', padrao: 'cnpj',
          opcoes: [{ valor: 'cnpj', rotulo: 'CNPJ' }, { valor: 'cpf', rotulo: 'CPF' }, { valor: 'email', rotulo: 'E-mail' }, { valor: 'telefone', rotulo: 'Telefone' }, { valor: 'aleatoria', rotulo: 'Aleatória' }],
        },
        { nome: 'chavePix', rotulo: 'Chave PIX (para os repasses)', ajuda: 'Só administradores definem. Fica criptografada.' },
      ]}
      colunas={[
        { titulo: '', render: (p) => (p.logoUrl ? <img className="miniatura" style={{ objectFit: 'contain', background: '#fff' }} src={p.logoUrl} alt="" /> : null) },
        { titulo: 'Parceiro', render: (p) => p.nome },
        { titulo: 'Site', render: (p) => p.site || '—' },
        { titulo: 'Acesso ao painel', render: (p) => (p.whatsapp ? p.whatsapp : '—') },
        { titulo: 'Status', render: (p) => <Selo status={p.ativo ? 'ativo' : 'inativo'} /> },
      ]}
    />
  );
}

type Imagem = { id: string; titulo: string; imagemUrl: string; ordem: number; ativo: boolean };
export function GaleriaPalmas() {
  return (
    <CrudPagina<Imagem>
      recurso="galeria"
      titulo="Galeria do Palmas para Jesus"
      sub="Imagens conceituais (“Veja o que esse lugar pode se tornar”) na página do Palmas para Jesus."
      rotuloItem="imagem"
      feminino
      campos={[
        { nome: 'imagemUrl', rotulo: 'Imagem', tipo: 'imagem', obrigatorio: true },
        { nome: 'titulo', rotulo: 'Legenda', largo: true },
        { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
        { nome: 'ativo', rotulo: 'Visível no app', tipo: 'checkbox', padrao: true },
      ]}
      colunas={[
        { titulo: '', render: (g) => <img className="miniatura" src={g.imagemUrl} alt="" /> },
        { titulo: 'Legenda', render: (g) => g.titulo || '—' },
        { titulo: 'Ordem', num: true, render: (g) => g.ordem },
        { titulo: 'Status', render: (g) => <Selo status={g.ativo ? 'ativo' : 'inativo'} /> },
      ]}
    />
  );
}

type Pagina = { id: string; slug: string; titulo: string; atualizadoEm: string };
export function PaginasLegais() {
  return (
    <CrudPagina<Pagina>
      recurso="paginas"
      titulo="Páginas legais"
      sub="Política de Privacidade e Termos de Uso mostrados no app. Use “## Título” para subtítulos e “- item” para listas. Revise com o jurídico."
      rotuloItem="página"
      feminino
      podeCriar={false}
      podeExcluir={false}
      campos={[
        { nome: 'slug', rotulo: 'Página', tipo: 'select', opcoes: [{ valor: 'privacidade', rotulo: 'Política de Privacidade' }, { valor: 'termos', rotulo: 'Termos de Uso' }] },
        { nome: 'titulo', rotulo: 'Título', obrigatorio: true },
        { nome: 'conteudo', rotulo: 'Texto', tipo: 'textarea', obrigatorio: true },
      ]}
      colunas={[
        { titulo: 'Página', render: (p) => <strong>{p.titulo}</strong> },
        { titulo: 'Atualizada em', render: (p) => data(p.atualizadoEm) },
      ]}
    />
  );
}

type Mensagem = {
  id: string; nome: string; sobrenome: string; whatsapp: string; mensagem: string;
  anexos: { arquivo: string; nome: string }[]; status: string; criadoEm: string;
};
const ROTULOS: Record<string, string> = { nova: 'Nova', em_contato: 'Em contato', respondida: 'Respondida', arquivada: 'Arquivada' };

function Anexos({ anexos }: { anexos: Mensagem['anexos'] }) {
  const [erro, setErro] = useState<unknown>(null);
  if (!anexos?.length) return <>—</>;
  return (
    <span className="anexos">
      {anexos.map((a) => (
        <button key={a.arquivo} className="btn sec peq" title={a.nome}
          onClick={() => baixar(`/anexos/${a.arquivo}`, a.nome).catch(setErro)}>
          {a.arquivo.endsWith('.pdf') ? '📄' : '🖼️'} {a.nome.length > 18 ? `${a.nome.slice(0, 16)}…` : a.nome}
        </button>
      ))}
      <Erro erro={erro} />
    </span>
  );
}

export function Mensagens() {
  return (
    <CrudPagina<Mensagem>
      recurso="mensagens"
      titulo="Mensagens (Fale conosco)"
      sub="Mensagens enviadas pelo app. Os anexos só podem ser baixados aqui no admin."
      rotuloItem="mensagem"
      feminino
      podeCriar={false}
      filtroStatus={Object.entries(ROTULOS).map(([valor, rotulo]) => ({ valor, rotulo }))}
      campos={[
        { nome: 'status', rotulo: 'Situação', tipo: 'select', opcoes: Object.entries(ROTULOS).map(([valor, rotulo]) => ({ valor, rotulo })) },
      ]}
      colunas={[
        { titulo: 'Recebida', render: (m) => dataHora(m.criadoEm) },
        { titulo: 'De', render: (m) => <>{m.nome} {m.sobrenome}<div style={{ color: 'var(--texto-3)', fontSize: 12 }}>{m.whatsapp}</div></> },
        { titulo: 'Mensagem', render: (m) => <span style={{ whiteSpace: 'pre-wrap' }}>{m.mensagem}</span> },
        { titulo: 'Anexos', render: (m) => <Anexos anexos={m.anexos} /> },
        { titulo: 'Situação', render: (m) => <Selo status={m.status === 'respondida' ? 'fechada' : m.status === 'arquivada' ? 'inativo' : m.status} /> },
      ]}
      acoes={(m) => (
        <a className="btn sec peq" target="_blank" rel="noreferrer" href={`https://wa.me/55${m.whatsapp.replace(/\D/g, '')}`}>WhatsApp</a>
      )}
    />
  );
}
