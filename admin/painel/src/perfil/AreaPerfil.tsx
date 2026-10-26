import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { dataHora, moeda, numero } from '../api';
import { Simbolo } from '../componentes/Marca';
import { Cabecalho, Carregando, Erro, Selo } from '../componentes/ui';
import { apiPerfil, baixarPerfil, lerSessaoPerfil, salvarSessaoPerfil } from './sessao';

type Saldo = { aReceber: number; recebido: number };
type Mov = { id: string; papel: string; percentual: number; valor: number; status: string; criadoEm: string; campanha: string; igreja: string };
type Oferta = { id: string; valor: number; quantidade: number; pagaEm: string; igreja: string; ofertante: string };
type IgrejaPastor = { id: string; slug: string; nomeFantasia: string; cidade: string; uf: string; status: string; protocolo: string; observacao: string; arrecadado: number; ofertas: number; cupons: number; saldo: Saldo };
type Painel = {
  urlPublica?: string;
  igrejas?: IgrejaPastor[];
  ofertas?: Oferta[];
  semeador?: {
    nome: string; codigo: string; status: string; nivel: 1 | 2; volume: number; saldo: Saldo; movimentacoes: Mov[];
    igrejas: { id: string; slug: string; nomeFantasia: string; cidade: string; uf: string; status: string; arrecadado: number }[];
    rede: { nome: string; status: string; igrejas: number; volume: number }[];
  } | null;
  parceiro?: { nome: string; saldo: Saldo; movimentacoes: Mov[]; campanhas: { edicao: string; ativa: boolean; totalOfertas: number }[] } | null;
};

/** Área de quem entrou pelo WhatsApp como pastor, semeador ou parceiro (como os painéis por perfil do site). */
export function LayoutPerfil() {
  const navigate = useNavigate();
  const s = lerSessaoPerfil();
  if (!s) return <Navigate to="/login" replace />;
  const ehSemeador = s.perfil.tipo === 'semeador';
  const ehN1 = s.perfil.rotulo === 'Semeador N1';
  return (
    <div className="layout">
      <nav className="menu" aria-label="Menu">
        <div className="marca"><Simbolo /><div>Renovando<small>{s.perfil.rotulo}</small></div></div>
        <NavLink to="/perfil" end>Meu painel</NavLink>
        {ehSemeador ? <NavLink to="/perfil/cadastrar-igreja">Cadastrar igreja</NavLink> : null}
        {ehN1 ? <NavLink to="/perfil/cadastrar-semeador">Cadastrar semeador N2</NavLink> : null}
        <div className="rodape">
          <span className="avatar" aria-hidden="true">{s.perfil.nome.charAt(0).toUpperCase()}</span>
          <div className="quem"><strong>{s.perfil.nome}</strong><span>{s.perfil.rotulo}</span></div>
          <button onClick={() => (salvarSessaoPerfil(null), navigate('/login'))} aria-label="Sair" title="Sair">Sair</button>
        </div>
      </nav>
      <main className="conteudo"><Outlet /></main>
    </div>
  );
}

const Num = ({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) => (
  <div className={`cartao kpi${destaque ? ' kpi-destaque' : ''}`}><div className="rotulo">{rotulo}</div><div className="valor">{valor}</div></div>
);

function Movimentacoes({ lista }: { lista: Mov[] }) {
  if (!lista.length) return null;
  return (
    <div className="cartao">
      <h2>Movimentações</h2>
      <table className="cartoes">
        <thead><tr><th>Data</th><th>Igreja</th><th>Parte</th><th className="num">Valor</th><th>Situação</th></tr></thead>
        <tbody>
          {lista.map((m) => (
            <tr key={m.id}>
              <td data-rotulo="Data">{dataHora(m.criadoEm)}</td><td data-titulo>{m.igreja}</td>
              <td data-rotulo="Parte">{m.papel} ({m.percentual}%)</td><td className="num" data-rotulo="Valor">{moeda(m.valor)}</td>
              <td data-rotulo="Situação"><Selo status={m.status === 'pago' ? 'paga' : 'pendente'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ajuda">Os valores são pagos pela equipe do Renovando, por PIX, na chave cadastrada.</p>
    </div>
  );
}

function Ofertas({ lista, titulo }: { lista: Oferta[]; titulo: string }) {
  return (
    <div className="cartao">
      <h2>{titulo}</h2>
      {lista.length === 0 ? <p className="vazio">Nenhuma oferta registrada ainda.</p> : (
        <table className="cartoes">
          <thead><tr><th>Data</th><th>Membro</th><th>Igreja</th><th className="num">Cupons</th><th className="num">Valor</th></tr></thead>
          <tbody>
            {lista.map((o) => (
              <tr key={o.id}>
                <td data-rotulo="Data">{dataHora(o.pagaEm)}</td><td data-titulo>{o.ofertante}</td><td data-rotulo="Igreja">{o.igreja}</td>
                <td className="num" data-rotulo="Cupons">{o.quantidade}</td><td className="num" data-rotulo="Valor">{moeda(o.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function BotoesPanfleto({ igreja }: { igreja: { id: string; slug: string } }) {
  const [erro, setErro] = useState<unknown>(null);
  const baixar = (n: 1 | 6) => baixarPerfil(`/igrejas/${igreja.id}/panfleto?porPagina=${n}`, `panfleto-${igreja.slug}-${n}-por-pagina.pdf`).catch(setErro);
  return (
    <>
      <button className="btn sec peq" onClick={() => baixar(1)}>Panfleto 1/folha</button>
      <button className="btn sec peq" onClick={() => baixar(6)}>Panfleto 6/folha</button>
      {erro ? <Erro erro={erro} /> : null}
    </>
  );
}

/** Painel do perfil: muda conforme quem entrou (pastor, semeador ou parceiro). */
export function PainelPerfil() {
  const s = lerSessaoPerfil()!;
  const q = useQuery({ queryKey: ['perfil-painel'], queryFn: () => apiPerfil<Painel>('/painel') });
  const d = q.data;
  const [copiado, setCopiado] = useState('');
  const copiar = async (texto: string) => {
    await navigator.clipboard.writeText(texto).catch(() => {});
    setCopiado(texto);
  };
  const origemApi = d?.urlPublica ?? '';

  return (
    <div className="pilha">
      <Cabecalho
        titulo={s.perfil.tipo === 'pastor' ? 'Painel do pastor' : s.perfil.tipo === 'parceiro' ? `Portal do parceiro · ${s.perfil.nome}` : `Olá, ${s.perfil.nome.split(' ')[0]}`}
        sub={s.perfil.tipo === 'pastor' ? s.perfil.nome : s.perfil.rotulo} />
      <Erro erro={q.error} />
      {q.isLoading ? <Carregando /> : null}

      {d?.igrejas ? d.igrejas.map((i) => (
        <div key={i.id} className="cartao pilha">
          <div className="linha" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>{i.nomeFantasia}</h2><Selo status={i.status} />
          </div>
          <span className="ajuda">{i.cidade}/{i.uf} · Protocolo {i.protocolo}</span>
          {i.status === 'ativa' ? (
            <>
              <div className="grade grade-kpi">
                <Num destaque rotulo="A receber da equipe" valor={moeda(i.saldo.aReceber)} />
                <Num rotulo="Já recebido" valor={moeda(i.saldo.recebido)} />
                <Num rotulo="Arrecadado" valor={moeda(i.arrecadado)} />
                <Num rotulo="Ofertas pagas" valor={numero(i.ofertas)} />
                <Num rotulo="Números da sorte" valor={numero(i.cupons)} />
              </div>
              <div className="linha" style={{ flexWrap: 'wrap' }}>
                <NavLink className="btn peq" to={`/perfil/minha-igreja/${i.id}`}>Minha igreja (logo e mensagem)</NavLink>
                <BotoesPanfleto igreja={i} />
              </div>
            </>
          ) : <div className="alerta info">{i.status === 'pendente' ? 'Cadastro em análise.' : `Igreja não ativa${i.observacao ? `: ${i.observacao}` : '.'}`}</div>}
        </div>
      )) : null}
      {d?.igrejas && d.ofertas ? <Ofertas lista={d.ofertas} titulo="Membros contribuintes · últimas ofertas" /> : null}

      {d?.semeador ? (
        <>
          <div className="cartao pilha">
            <div className="linha" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>Seu código: <code>{d.semeador.codigo}</code></h2>
              <span className="selo">{d.semeador.nivel === 1 ? 'Semeador N1' : 'Semeador N2'}</span>
            </div>
            <div className="grade grade-kpi">
              <Num destaque rotulo="A receber" valor={moeda(d.semeador.saldo.aReceber)} />
              <Num rotulo="Já recebido" valor={moeda(d.semeador.saldo.recebido)} />
              <Num rotulo="Volume das igrejas ativas" valor={moeda(d.semeador.volume)} />
              <Num rotulo="Igrejas" valor={numero(d.semeador.igrejas.length)} />
            </div>
            {origemApi ? (
              <div className="linha" style={{ flexWrap: 'wrap' }}>
                <button className="btn sec peq" onClick={() => copiar(`${origemApi}/indicacao/${d.semeador!.codigo}`)}>
                  {copiado.includes('/indicacao/') ? 'Link copiado' : 'Copiar link de cadastro de igreja'}
                </button>
                {d.semeador.nivel === 1 ? (
                  <button className="btn sec peq" onClick={() => copiar(`${origemApi}/semeador/${d.semeador!.codigo}`)}>
                    {copiado.includes('/semeador/') ? 'Link copiado' : 'Copiar convite para semeador N2'}
                  </button>
                ) : null}
              </div>
            ) : <span className="ajuda">Quem se cadastrar no app com o código {d.semeador.codigo} fica ligado a você.</span>}
          </div>
          <div className="cartao">
            <h2>{d.semeador.nivel === 1 ? 'Minhas igrejas' : 'Igrejas sob sua responsabilidade'}</h2>
            {d.semeador.igrejas.length === 0 ? <p className="vazio">Nenhuma igreja ainda. Use “Cadastrar igreja” no menu.</p> : (
              <table className="cartoes">
                <thead><tr><th>Igreja</th><th className="num">Arrecadado</th><th>Situação</th><th /></tr></thead>
                <tbody>
                  {d.semeador.igrejas.map((i) => (
                    <tr key={i.id}>
                      <td data-titulo>{i.nomeFantasia}<div className="ajuda">{i.cidade}/{i.uf}</div></td>
                      <td className="num" data-rotulo="Arrecadado">{moeda(i.arrecadado)}</td>
                      <td data-rotulo="Situação"><Selo status={i.status} /></td>
                      <td className="acoes">{i.status === 'ativa' ? <BotoesPanfleto igreja={i} /> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {d.semeador.nivel === 1 ? (
            <div className="cartao">
              <h2>Meus semeadores N2</h2>
              {d.semeador.rede.length === 0 ? <p className="vazio">Ninguém na sua rede ainda. Compartilhe o convite ou cadastre pelo menu.</p> : (
                <table className="cartoes">
                  <thead><tr><th>Semeador</th><th className="num">Igrejas</th><th className="num">Volume</th><th>Situação</th></tr></thead>
                  <tbody>
                    {d.semeador.rede.map((n, k) => (
                      <tr key={k}>
                        <td data-titulo>{n.nome}</td><td className="num" data-rotulo="Igrejas">{n.igrejas}</td>
                        <td className="num" data-rotulo="Volume">{moeda(n.volume)}</td><td data-rotulo="Situação"><Selo status={n.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}
          {d.ofertas ? <Ofertas lista={d.ofertas} titulo="Últimas ofertas nas suas igrejas" /> : null}
          <Movimentacoes lista={d.semeador.movimentacoes} />
        </>
      ) : null}

      {d?.parceiro ? (
        <>
          <div className="grade grade-kpi">
            <Num destaque rotulo="Saldo a receber" valor={moeda(d.parceiro.saldo.aReceber)} />
            <Num rotulo="Já recebido" valor={moeda(d.parceiro.saldo.recebido)} />
          </div>
          <div className="cartao">
            <h2>Campanhas vinculadas</h2>
            {d.parceiro.campanhas.length === 0 ? <p className="vazio">Nenhuma campanha vinculada no momento.</p> : d.parceiro.campanhas.map((c) => (
              <div key={c.edicao} className="linha" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--borda)', padding: '8px 0' }}>
                <strong>{c.edicao}{c.ativa ? ' (ativa)' : ''}</strong><span>{moeda(c.totalOfertas)} em ofertas</span>
              </div>
            ))}
          </div>
          <Movimentacoes lista={d.parceiro.movimentacoes} />
        </>
      ) : null}
    </div>
  );
}

// ---------- Cadastros pelo semeador ----------

const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');

function Campo({ id, rotulo, children }: { id: string; rotulo: string; children: ReactNode }) {
  return <div className="campo"><label htmlFor={id}>{rotulo}</label>{children}</div>;
}

export function CadastrarIgreja() {
  const qc = useQueryClient();
  const vazio = { razaoSocial: '', nomeFantasia: '', cnpj: '', cep: '', endereco: '', cidade: '', uf: 'TO', tipoChavePix: 'cnpj', chavePix: '', pastorNome: '', pastorWhatsapp: '' };
  const [f, setF] = useState(vazio);
  const set = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }));
  const salvar = useMutation({
    mutationFn: () => apiPerfil<{ protocolo: string }>('/igrejas', { method: 'POST', json: f }),
    onSuccess: () => (setF(vazio), qc.invalidateQueries({ queryKey: ['perfil-painel'] })),
  });
  return (
    <form className="pilha" style={{ maxWidth: 760 }} onSubmit={(e: FormEvent) => (e.preventDefault(), salvar.mutate())}>
      <Cabecalho titulo="Cadastrar igreja" sub="A igreja fica ligada a você e entra em análise pela equipe. O pastor recebe o acesso pelo WhatsApp dele." />
      <Erro erro={salvar.error} />
      {salvar.data ? <div className="alerta ok">Igreja cadastrada (protocolo {salvar.data.protocolo}). Ela aparece em “Meu painel” como pendente até a aprovação.</div> : null}
      <div className="cartao form-grade">
        <Campo id="rs" rotulo="Razão social *"><input id="rs" className="input" required value={f.razaoSocial} onChange={(e) => set({ razaoSocial: e.target.value })} /></Campo>
        <Campo id="nf" rotulo="Nome da igreja *"><input id="nf" className="input" required value={f.nomeFantasia} onChange={(e) => set({ nomeFantasia: e.target.value })} /></Campo>
        <Campo id="cnpj" rotulo="CNPJ"><input id="cnpj" className="input" value={f.cnpj} onChange={(e) => set({ cnpj: e.target.value })} /></Campo>
        <Campo id="cep" rotulo="CEP"><input id="cep" className="input" value={f.cep} onChange={(e) => set({ cep: e.target.value })} /></Campo>
        <div className="campo largo"><label htmlFor="end">Endereço</label><input id="end" className="input" value={f.endereco} onChange={(e) => set({ endereco: e.target.value })} /></div>
        <Campo id="cid" rotulo="Cidade *"><input id="cid" className="input" required value={f.cidade} onChange={(e) => set({ cidade: e.target.value })} /></Campo>
        <Campo id="uf" rotulo="UF *"><select id="uf" className="input" value={f.uf} onChange={(e) => set({ uf: e.target.value })}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></Campo>
        <Campo id="tpix" rotulo="Tipo de chave PIX *">
          <select id="tpix" className="input" value={f.tipoChavePix} onChange={(e) => set({ tipoChavePix: e.target.value })}>
            <option value="cnpj">CNPJ</option><option value="cpf">CPF</option><option value="email">E-mail</option><option value="telefone">Telefone</option><option value="aleatoria">Aleatória</option>
          </select>
        </Campo>
        <Campo id="pix" rotulo="Chave PIX da igreja *"><input id="pix" className="input" required value={f.chavePix} onChange={(e) => set({ chavePix: e.target.value })} /></Campo>
        <Campo id="pn" rotulo="Nome do pastor *"><input id="pn" className="input" required value={f.pastorNome} onChange={(e) => set({ pastorNome: e.target.value })} /></Campo>
        <Campo id="pw" rotulo="WhatsApp do pastor *"><input id="pw" className="input" required inputMode="tel" placeholder="(63) 99999-9999" value={f.pastorWhatsapp} onChange={(e) => set({ pastorWhatsapp: e.target.value })} /></Campo>
      </div>
      <div><button className="btn" disabled={salvar.isPending}>{salvar.isPending ? 'Enviando…' : 'Cadastrar igreja'}</button></div>
    </form>
  );
}

export function CadastrarSemeador() {
  const qc = useQueryClient();
  const vazio = { nome: '', sobrenome: '', whatsapp: '', cpf: '', chavePix: '' };
  const [f, setF] = useState(vazio);
  const set = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }));
  const salvar = useMutation({
    mutationFn: () => apiPerfil('/semeadores', { method: 'POST', json: f }),
    onSuccess: () => (setF(vazio), qc.invalidateQueries({ queryKey: ['perfil-painel'] })),
  });
  return (
    <form className="pilha" style={{ maxWidth: 640 }} onSubmit={(e: FormEvent) => (e.preventDefault(), salvar.mutate())}>
      <Cabecalho titulo="Cadastrar semeador N2" sub="O semeador N2 fica ligado a você e à sua rede. A equipe analisa o cadastro." />
      <Erro erro={salvar.error} />
      {salvar.isSuccess ? <div className="alerta ok">Semeador cadastrado. Ele entra no painel pelo WhatsApp depois da aprovação.</div> : null}
      <div className="cartao form-grade">
        <Campo id="sn" rotulo="Nome *"><input id="sn" className="input" required value={f.nome} onChange={(e) => set({ nome: e.target.value })} /></Campo>
        <Campo id="ss" rotulo="Sobrenome *"><input id="ss" className="input" required value={f.sobrenome} onChange={(e) => set({ sobrenome: e.target.value })} /></Campo>
        <Campo id="sw" rotulo="WhatsApp *"><input id="sw" className="input" required inputMode="tel" value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} /></Campo>
        <Campo id="sc" rotulo="CPF *"><input id="sc" className="input" required inputMode="numeric" value={f.cpf} onChange={(e) => set({ cpf: e.target.value })} /></Campo>
        <div className="campo largo"><label htmlFor="sp">Chave PIX *</label><input id="sp" className="input" required value={f.chavePix} onChange={(e) => set({ chavePix: e.target.value })} /></div>
      </div>
      <p className="ajuda">O acesso ao painel é feito pelo código enviado por WhatsApp no login.</p>
      <div><button className="btn" disabled={salvar.isPending}>{salvar.isPending ? 'Enviando…' : 'Cadastrar semeador'}</button></div>
    </form>
  );
}

// ---------- Minha igreja (pastor) ----------

type MinhaIgrejaDados = { id: string; nomeFantasia: string; logoUrl: string; descricao: string; endereco: string; cep: string; cidade: string; uf: string };

export function MinhaIgreja() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['minha-igreja', id], queryFn: () => apiPerfil<MinhaIgrejaDados>(`/minha-igreja/${id}`) });
  const [f, setF] = useState<Partial<MinhaIgrejaDados>>({});
  const [enviando, setEnviando] = useState(false);
  const [erroLogo, setErroLogo] = useState<unknown>(null);
  const atual = { ...q.data, ...f } as MinhaIgrejaDados;
  const salvar = useMutation({
    mutationFn: () => apiPerfil(`/minha-igreja/${id}`, { method: 'PUT', json: { logoUrl: atual.logoUrl, descricao: atual.descricao, endereco: atual.endereco, cep: atual.cep } }),
    onSuccess: () => (setF({}), qc.invalidateQueries({ queryKey: ['minha-igreja', id] })),
  });
  if (q.isLoading) return <Carregando />;
  if (!q.data) return <Erro erro={q.error} />;
  return (
    <form className="pilha" style={{ maxWidth: 680 }} onSubmit={(e: FormEvent) => (e.preventDefault(), salvar.mutate())}>
      <Cabecalho titulo="Minha igreja" sub={`${q.data.nomeFantasia} · ${q.data.cidade}/${q.data.uf}`} />
      <Erro erro={salvar.error ?? erroLogo} />
      {salvar.isSuccess ? <div className="alerta ok">Dados atualizados. Já aparecem na página da igreja no app.</div> : null}
      <div className="cartao pilha">
        <div className="campo">
          <label htmlFor="logo">Logo da igreja</label>
          <div className="linha">
            {atual.logoUrl ? <img src={atual.logoUrl} alt="Logo" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--borda)' }} /> : null}
            <label className="btn sec peq">
              {enviando ? 'Enviando…' : atual.logoUrl ? 'Trocar logo' : 'Enviar logo'}
              <input id="logo" type="file" accept="image/*" hidden onChange={async (e) => {
                const arq = e.target.files?.[0];
                if (!arq) return;
                setEnviando(true);
                setErroLogo(null);
                try {
                  const fd = new FormData();
                  fd.append('arquivo', arq);
                  const { url } = await apiPerfil<{ url: string }>('/upload', { method: 'POST', body: fd });
                  setF((v) => ({ ...v, logoUrl: url }));
                } catch (err) {
                  setErroLogo(err);
                } finally {
                  setEnviando(false);
                }
              }} />
            </label>
          </div>
        </div>
        <div className="campo">
          <label htmlFor="desc">Mensagem da igreja (aparece na página da igreja no app)</label>
          <textarea id="desc" className="input" maxLength={600} style={{ minHeight: 90 }} value={atual.descricao ?? ''} onChange={(e) => setF((v) => ({ ...v, descricao: e.target.value }))} />
        </div>
        <div className="form-grade">
          <div className="campo largo"><label htmlFor="mend">Endereço</label><input id="mend" className="input" maxLength={200} value={atual.endereco ?? ''} onChange={(e) => setF((v) => ({ ...v, endereco: e.target.value }))} /></div>
          <div className="campo"><label htmlFor="mcep">CEP</label><input id="mcep" className="input" maxLength={10} value={atual.cep ?? ''} onChange={(e) => setF((v) => ({ ...v, cep: e.target.value }))} /></div>
        </div>
        <p className="ajuda">Chave PIX, nome e responsável são alterados só pela equipe (fale conosco).</p>
      </div>
      <div><button className="btn" disabled={salvar.isPending}>{salvar.isPending ? 'Salvando…' : 'Salvar'}</button></div>
    </form>
  );
}
