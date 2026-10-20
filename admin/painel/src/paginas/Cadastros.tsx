import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, data, dataHora, moeda, numero } from '../api';
import { CrudPagina } from '../componentes/CrudPagina';
import { Cabecalho, Carregando, Erro, Selo } from '../componentes/ui';

const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'
  .split(' ')
  .map((u) => ({ valor: u, rotulo: u }));

/** Botões rápidos para trocar o status de um registro (aprovar/rejeitar). */
function AcoesStatus({ recurso, id, atual, opcoes, recarregar }: {
  recurso: string; id: string; atual: string; opcoes: { status: string; rotulo: string; perigo?: boolean }[]; recarregar: () => void;
}) {
  const m = useMutation({
    mutationFn: (status: string) => api(`/${recurso}/${id}`, { method: 'PUT', json: { status } }),
    onSuccess: recarregar,
  });
  return (
    <>
      {opcoes.filter((o) => o.status !== atual).map((o) => (
        <button key={o.status} className={`btn peq ${o.perigo ? 'perigo' : ''}`} disabled={m.isPending} onClick={() => m.mutate(o.status)}>
          {o.rotulo}
        </button>
      ))}
    </>
  );
}

// ---------- Igrejas ----------

type Igreja = {
  id: string; protocolo: string; slug: string; logoUrl: string; nomeFantasia: string; razaoSocial: string; cnpj: string; cidade: string; uf: string;
  pastorNome: string; pastorWhatsapp: string; chavePix: string; status: string; criadoEm: string;
};

export function Igrejas() {
  const [params] = useSearchParams();
  return (
    <CrudPagina<Igreja>
      recurso="igrejas"
      titulo="Igrejas"
      sub="Igrejas cadastradas pelo app entram como pendentes. Só as ativas aparecem para os ofertantes."
      rotuloItem="igreja"
      feminino
      statusInicial={params.get('status') ?? ''}
      filtroStatus={[
        { valor: 'pendente', rotulo: 'Pendentes' }, { valor: 'ativa', rotulo: 'Ativas' },
        { valor: 'rejeitada', rotulo: 'Rejeitadas' }, { valor: 'inativa', rotulo: 'Inativas' },
      ]}
      campos={[
        { nome: 'nomeFantasia', rotulo: 'Nome fantasia', obrigatorio: true, ajuda: 'Nome exibido no app.' },
        { nome: 'razaoSocial', rotulo: 'Razão social', obrigatorio: true },
        { nome: 'cnpj', rotulo: 'CNPJ' },
        { nome: 'cep', rotulo: 'CEP' },
        { nome: 'endereco', rotulo: 'Endereço', largo: true },
        { nome: 'cidade', rotulo: 'Cidade', obrigatorio: true },
        { nome: 'uf', rotulo: 'UF', tipo: 'select', opcoes: UFS, padrao: 'TO' },
        {
          nome: 'tipoChavePix', rotulo: 'Tipo da chave PIX', tipo: 'select', padrao: 'cnpj',
          opcoes: [{ valor: 'cnpj', rotulo: 'CNPJ' }, { valor: 'cpf', rotulo: 'CPF' }, { valor: 'email', rotulo: 'E-mail' }, { valor: 'telefone', rotulo: 'Telefone' }, { valor: 'aleatoria', rotulo: 'Aleatória' }],
        },
        { nome: 'chavePix', rotulo: 'Chave PIX' },
        { nome: 'pastorNome', rotulo: 'Pastor responsável' },
        { nome: 'pastorWhatsapp', rotulo: 'WhatsApp do pastor' },
        {
          nome: 'status', rotulo: 'Status', tipo: 'select', padrao: 'ativa',
          opcoes: [{ valor: 'pendente', rotulo: 'Pendente' }, { valor: 'ativa', rotulo: 'Ativa' }, { valor: 'rejeitada', rotulo: 'Rejeitada' }, { valor: 'inativa', rotulo: 'Inativa' }],
        },
        { nome: 'logoUrl', rotulo: 'Logo da igreja', tipo: 'imagem' },
        { nome: 'slug', rotulo: 'Endereço da página da igreja', ajuda: 'Gerado do nome se ficar vazio. O link fica: SEU-DOMINIO/igreja/endereco' },
        { nome: 'descricao', rotulo: 'Mensagem na página da igreja', tipo: 'textarea', ajuda: 'Aparece no topo da página da igreja no app (opcional).' },
        { nome: 'observacao', rotulo: 'Observação interna', tipo: 'textarea' },
      ]}
      colunas={[
        { titulo: '', render: (i) => (i.logoUrl ? <img className="miniatura" style={{ borderRadius: '50%', width: 40, height: 40 }} src={i.logoUrl} alt="" /> : null) },
        { titulo: 'Igreja', render: (i) => <><strong>{i.nomeFantasia}</strong><div style={{ color: 'var(--texto-3)', fontSize: 12 }}>Protocolo {i.protocolo} · /igreja/{i.slug}</div></> },
        { titulo: 'Cidade', render: (i) => `${i.cidade}/${i.uf}` },
        { titulo: 'Pastor', render: (i) => <>{i.pastorNome || '—'}<div style={{ color: 'var(--texto-3)', fontSize: 12 }}>{i.pastorWhatsapp}</div></> },
        { titulo: 'PIX', render: (i) => i.chavePix || '—' },
        { titulo: 'Cadastro', render: (i) => data(i.criadoEm) },
        { titulo: 'Status', render: (i) => <Selo status={i.status} /> },
      ]}
      acoes={(i, recarregar) => i.status === 'pendente' ? (
        <AcoesStatus recurso="igrejas" id={i.id} atual={i.status} recarregar={recarregar}
          opcoes={[{ status: 'ativa', rotulo: 'Aprovar' }, { status: 'rejeitada', rotulo: 'Rejeitar', perigo: true }]} />
      ) : null}
    />
  );
}

// ---------- Semeadores ----------

type Semeador = { id: string; nome: string; sobrenome: string; whatsapp: string; cpf: string; chavePix: string; codigo: string; status: string; criadoEm: string };

export function Semeadores() {
  return (
    <CrudPagina<Semeador>
      recurso="semeadores"
      titulo="Semeadores"
      sub="Pessoas que indicam igrejas. O código de cada semeador é usado no cadastro das igrejas."
      rotuloItem="semeador"
      filtroStatus={[
        { valor: 'pendente', rotulo: 'Pendentes' }, { valor: 'ativo', rotulo: 'Ativos' },
        { valor: 'rejeitado', rotulo: 'Rejeitados' }, { valor: 'inativo', rotulo: 'Inativos' },
      ]}
      campos={[
        { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
        { nome: 'sobrenome', rotulo: 'Sobrenome' },
        { nome: 'whatsapp', rotulo: 'WhatsApp', obrigatorio: true },
        { nome: 'cpf', rotulo: 'CPF' },
        { nome: 'chavePix', rotulo: 'Chave PIX' },
        { nome: 'codigo', rotulo: 'Código de indicação', obrigatorio: true },
        {
          nome: 'status', rotulo: 'Status', tipo: 'select', padrao: 'ativo',
          opcoes: [{ valor: 'pendente', rotulo: 'Pendente' }, { valor: 'ativo', rotulo: 'Ativo' }, { valor: 'rejeitado', rotulo: 'Rejeitado' }, { valor: 'inativo', rotulo: 'Inativo' }],
        },
      ]}
      colunas={[
        { titulo: 'Nome', render: (s) => `${s.nome} ${s.sobrenome}` },
        { titulo: 'WhatsApp', render: (s) => s.whatsapp },
        { titulo: 'Código', render: (s) => <code>{s.codigo}</code> },
        { titulo: 'Cadastro', render: (s) => data(s.criadoEm) },
        { titulo: 'Status', render: (s) => <Selo status={s.status} /> },
      ]}
      acoes={(s, recarregar) => s.status === 'pendente' ? (
        <AcoesStatus recurso="semeadores" id={s.id} atual={s.status} recarregar={recarregar}
          opcoes={[{ status: 'ativo', rotulo: 'Aprovar' }, { status: 'rejeitado', rotulo: 'Rejeitar', perigo: true }]} />
      ) : null}
    />
  );
}

// ---------- Notícias ----------

type Noticia = { id: string; titulo: string; slug: string; resumo: string; imagemUrl: string; publicada: boolean; publicadaEm: string | null };

export function Noticias() {
  return (
    <CrudPagina<Noticia>
      recurso="noticias"
      titulo="Notícias"
      sub="Aparecem em “Novidades” no app. Só as publicadas ficam visíveis."
      rotuloItem="notícia"
      feminino
      campos={[
        { nome: 'titulo', rotulo: 'Título', obrigatorio: true, largo: true },
        { nome: 'resumo', rotulo: 'Resumo', largo: true, ajuda: 'Uma ou duas frases para a lista de notícias.' },
        { nome: 'imagemUrl', rotulo: 'Imagem de capa', tipo: 'imagem' },
        { nome: 'conteudo', rotulo: 'Texto completo', tipo: 'textarea', ajuda: 'Separe os parágrafos com uma linha em branco.' },
        { nome: 'publicada', rotulo: 'Publicada', tipo: 'checkbox' },
        { nome: 'publicadaEm', rotulo: 'Data de publicação', tipo: 'datahora', ajuda: 'Em branco = agora, ao publicar.' },
      ]}
      colunas={[
        { titulo: '', render: (n) => (n.imagemUrl ? <img className="miniatura" src={n.imagemUrl} alt="" /> : null) },
        { titulo: 'Título', render: (n) => <><strong>{n.titulo}</strong><div style={{ color: 'var(--texto-3)', fontSize: 12 }}>{n.resumo}</div></> },
        { titulo: 'Publicação', render: (n) => dataHora(n.publicadaEm) },
        { titulo: 'Status', render: (n) => <Selo status={n.publicada ? 'publicada' : 'rascunho'} /> },
      ]}
    />
  );
}

// ---------- Depoimentos ----------

type Depoimento = { id: string; titulo: string; texto: string; autor: string; local: string; publicado: boolean; ordem: number };

export function Depoimentos() {
  return (
    <CrudPagina<Depoimento>
      recurso="depoimentos"
      titulo="Depoimentos"
      sub="Testemunhos exibidos na tela inicial do app."
      rotuloItem="depoimento"
      campos={[
        { nome: 'titulo', rotulo: 'Título', obrigatorio: true, largo: true },
        { nome: 'texto', rotulo: 'Depoimento', tipo: 'textarea', obrigatorio: true },
        { nome: 'autor', rotulo: 'Autor', obrigatorio: true },
        { nome: 'local', rotulo: 'Cidade/UF ou igreja' },
        { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
        { nome: 'publicado', rotulo: 'Publicado', tipo: 'checkbox', padrao: true },
      ]}
      colunas={[
        { titulo: 'Título', render: (d) => d.titulo },
        { titulo: 'Autor', render: (d) => `${d.autor}${d.local ? ` · ${d.local}` : ''}` },
        { titulo: 'Ordem', num: true, render: (d) => d.ordem },
        { titulo: 'Status', render: (d) => <Selo status={d.publicado ? 'publicada' : 'rascunho'} /> },
      ]}
    />
  );
}

// ---------- FAQ ----------

type Faq = { id: string; pergunta: string; resposta: string; publicada: boolean; ordem: number };

export function Faqs() {
  return (
    <CrudPagina<Faq>
      recurso="faqs"
      titulo="Perguntas frequentes"
      rotuloItem="pergunta"
      feminino
      campos={[
        { nome: 'pergunta', rotulo: 'Pergunta', obrigatorio: true, largo: true },
        { nome: 'resposta', rotulo: 'Resposta', tipo: 'textarea', obrigatorio: true },
        { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
        { nome: 'publicada', rotulo: 'Publicada', tipo: 'checkbox', padrao: true },
      ]}
      colunas={[
        { titulo: 'Pergunta', render: (f) => f.pergunta },
        { titulo: 'Ordem', num: true, render: (f) => f.ordem },
        { titulo: 'Status', render: (f) => <Selo status={f.publicada ? 'publicada' : 'rascunho'} /> },
      ]}
    />
  );
}

// ---------- Shows: artistas e pedidos ----------

type Artista = { id: string; nome: string; slug: string; fotoUrl: string; ativo: boolean; ordem: number; galeria: string[] };
type Pedido = {
  id: string; nome: string; whatsapp: string; email: string; igreja: string; cidade: string; uf: string; dataEvento: string;
  tipo: string; publico: string; artistas: string; mensagem: string; status: string; criadoEm: string;
};

export function Shows() {
  const [aba, setAba] = useState<'pedidos' | 'artistas'>('pedidos');
  const abas = (
    <div className="linha" style={{ marginBottom: 16 }}>
      <button className={`btn ${aba === 'pedidos' ? '' : 'sec'}`} onClick={() => setAba('pedidos')}>Pedidos de proposta</button>
      <button className={`btn ${aba === 'artistas' ? '' : 'sec'}`} onClick={() => setAba('artistas')}>Catálogo de artistas</button>
    </div>
  );

  return aba === 'artistas' ? (
    <CrudPagina<Artista>
      recurso="artistas"
      titulo="Shows gospel"
      sub="Artistas exibidos no catálogo do app."
      rotuloItem="artista"
      topo={abas}
      campos={[
        { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
        { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
        { nome: 'fotoUrl', rotulo: 'Foto principal', tipo: 'imagem' },
        { nome: 'bio', rotulo: 'Biografia', tipo: 'textarea' },
        { nome: 'galeria', rotulo: 'Galeria de fotos', tipo: 'galeria', ajuda: 'Até 20 fotos, mostradas na página do artista.' },
        { nome: 'ativo', rotulo: 'Visível no catálogo', tipo: 'checkbox', padrao: true },
      ]}
      colunas={[
        { titulo: '', render: (a) => (a.fotoUrl ? <img className="miniatura" src={a.fotoUrl} alt="" /> : null) },
        { titulo: 'Artista', render: (a) => <>{a.nome}<div style={{ color: 'var(--texto-3)', fontSize: 12 }}>{a.galeria?.length ?? 0} foto(s) na galeria</div></> },
        { titulo: 'Status', render: (a) => <Selo status={a.ativo ? 'ativo' : 'inativo'} /> },
      ]}
    />
  ) : (
    <CrudPagina<Pedido>
      recurso="solicitacoes-show"
      titulo="Shows gospel"
      sub="Pedidos enviados pelo app. Entre em contato pelo WhatsApp e atualize a situação."
      rotuloItem="pedido"
      podeCriar={false}
      topo={abas}
      filtroStatus={[
        { valor: 'nova', rotulo: 'Novos' }, { valor: 'em_contato', rotulo: 'Em contato' },
        { valor: 'fechada', rotulo: 'Fechados' }, { valor: 'descartada', rotulo: 'Descartados' },
      ]}
      campos={[
        {
          nome: 'status', rotulo: 'Situação', tipo: 'select',
          opcoes: [{ valor: 'nova', rotulo: 'Novo' }, { valor: 'em_contato', rotulo: 'Em contato' }, { valor: 'fechada', rotulo: 'Fechado' }, { valor: 'descartada', rotulo: 'Descartado' }],
        },
        { nome: 'mensagem', rotulo: 'Mensagem do solicitante', tipo: 'textarea' },
      ]}
      colunas={[
        { titulo: 'Recebido', render: (p) => data(p.criadoEm) },
        { titulo: 'Solicitante', render: (p) => <>{p.nome}<div style={{ color: 'var(--texto-3)', fontSize: 12 }}>{p.whatsapp} · {p.email}</div></> },
        { titulo: 'Evento', render: (p) => <>{data(`${p.dataEvento}T12:00:00`)} · {p.cidade}/{p.uf}<div style={{ color: 'var(--texto-3)', fontSize: 12 }}>{[p.tipo, p.igreja, p.publico && `${p.publico} pessoas`].filter(Boolean).join(' · ')}</div></> },
        { titulo: 'Artistas', render: (p) => p.artistas },
        { titulo: 'Situação', render: (p) => <Selo status={p.status} /> },
      ]}
      acoes={(p) => (
        <a className="btn sec peq" target="_blank" rel="noreferrer" href={`https://wa.me/55${p.whatsapp.replace(/\D/g, '')}`}>WhatsApp</a>
      )}
    />
  );
}

// ---------- Ofertantes ----------

type Ofertante = { id: string; nome: string; sobrenome: string; whatsapp: string; criadoEm: string; cupons: number; total: number };

export function Ofertantes() {
  const [busca, setBusca] = useState('');
  const q = useQuery({
    queryKey: ['usuarios', busca],
    queryFn: () => api<Ofertante[]>(`/usuarios?busca=${encodeURIComponent(busca)}`),
  });
  return (
    <div className="pilha">
      <Cabecalho titulo="Ofertantes" sub="Pessoas cadastradas no app (até 200, ordenadas pelo total ofertado)." />
      <div className="filtros">
        <div className="campo" style={{ minWidth: 280 }}>
          <label htmlFor="busca">Buscar</label>
          <input id="busca" className="input" placeholder="Nome ou WhatsApp completo com DDD" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>
      <div className="cartao">
        <Erro erro={q.error} />
        {q.isLoading ? <Carregando /> : (
          <div className="tabela-wrap">
            <table className="cartoes">
              <thead><tr><th>Nome</th><th>WhatsApp</th><th>Cadastro</th><th className="num">Cupons</th><th className="num">Total ofertado</th></tr></thead>
              <tbody>
                {q.data?.length === 0 ? <tr><td colSpan={5} className="vazio">Ninguém encontrado.</td></tr> : null}
                {q.data?.map((u) => (
                  <tr key={u.id}>
                    <td data-titulo>{u.nome} {u.sobrenome}</td><td data-rotulo="WhatsApp">{u.whatsapp}</td><td data-rotulo="Cadastro">{data(u.criadoEm)}</td>
                    <td className="num" data-rotulo="Cupons">{numero(u.cupons)}</td><td className="num" data-rotulo="Total ofertado">{moeda(u.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Usuários do painel ----------

type UsuarioAdmin = { id: string; nome: string; email: string; papel: string; ativo: boolean; totpAtivo: boolean; criadoEm: string };

export function UsuariosAdmin() {
  return (
    <CrudPagina<UsuarioAdmin>
      recurso="admins"
      titulo="Usuários do painel"
      sub="Editores cuidam de igrejas, notícias e conteúdo. Administradores também gerenciam campanhas, sorteios e usuários."
      rotuloItem="usuário"
      podeExcluir={false}
      campos={[
        { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
        { nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true },
        { nome: 'senha', rotulo: 'Senha', tipo: 'senha', ajuda: 'Mínimo de 8 caracteres. Ao editar, deixe em branco para manter a atual.' },
        {
          nome: 'papel', rotulo: 'Papel', tipo: 'select', padrao: 'editor',
          opcoes: [{ valor: 'editor', rotulo: 'Editor' }, { valor: 'admin', rotulo: 'Administrador' }],
        },
        { nome: 'ativo', rotulo: 'Ativo', tipo: 'checkbox', padrao: true },
        { nome: 'totpAtivo', rotulo: 'Verificação em duas etapas', tipo: 'checkbox', padrao: false, ajuda: 'Só a própria pessoa ativa (em Minha conta). Desmarque para desligar, se ela perdeu o celular.' },
      ]}
      colunas={[
        { titulo: 'Nome', render: (u) => u.nome },
        { titulo: 'E-mail', render: (u) => u.email },
        { titulo: 'Papel', render: (u) => (u.papel === 'admin' ? 'Administrador' : 'Editor') },
        { titulo: 'Status', render: (u) => <Selo status={u.ativo ? 'ativo' : 'inativo'} /> },
        { titulo: '2 etapas', render: (u) => (u.totpAtivo ? 'Ativa' : '—') },
      ]}
    />
  );
}
