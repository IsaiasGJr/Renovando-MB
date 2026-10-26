import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, dataHora, moeda } from '../api';
import { useCampanhas } from './Campanhas';
import { Cabecalho, Carregando, Erro, Modal, Selo } from '../componentes/ui';

type Linha = {
  beneficiarioTipo: 'igreja' | 'semeador' | 'parceiro' | 'plataforma'; beneficiarioId: string | null; nome: string;
  aPagar: number; pago: number; lancamentos: number; tipoChavePix: string; chavePix: string;
};
type Detalhe = {
  saldo: { aReceber: number; recebido: number; total: number };
  movimentacoes: { id: string; papel: string; percentual: number; valor: number; status: string; criadoEm: string; campanha: string; igreja: string }[];
  pagamentos: { id: string; valor: number; referencia: string; observacao: string; adminNome: string; criadoEm: string }[];
};

const TIPO: Record<Linha['beneficiarioTipo'], string> = { igreja: 'Igreja', semeador: 'Semeador', parceiro: 'Parceiro', plataforma: 'Plataforma' };

/**
 * Quanto cada um tem a receber das ofertas pagas. O sistema NÃO transfere dinheiro:
 * a equipe paga por fora (banco/gateway) e aqui registra o pagamento com a referência do comprovante.
 */
export default function Repasses() {
  const qc = useQueryClient();
  const campanhas = useCampanhas();
  const [campanhaId, setCampanhaId] = useState('');
  const lista = useQuery({ queryKey: ['repasses', campanhaId], queryFn: () => api<Linha[]>(`/repasses${campanhaId ? `?campanhaId=${campanhaId}` : ''}`) });
  const [aba, setAba] = useState<'beneficiarios' | 'movimentacoes'>('beneficiarios');
  const [aberto, setAberto] = useState<Linha | null>(null);
  const [referencia, setReferencia] = useState('');
  const [observacao, setObservacao] = useState('');
  const caminho = aberto ? `/repasses/${aberto.beneficiarioTipo}/${aberto.beneficiarioId ?? 'plataforma'}` : '';
  const detalhe = useQuery({ queryKey: ['repasse', caminho], queryFn: () => api<Detalhe>(caminho), enabled: !!aberto });

  const pagar = useMutation({
    mutationFn: () => api<{ valor: number }>(`${caminho}/pagar`, { method: 'POST', json: { referencia, observacao } }),
    onSuccess: () => {
      setReferencia('');
      setObservacao('');
      qc.invalidateQueries({ queryKey: ['repasses'] });
      qc.invalidateQueries({ queryKey: ['repasse'] });
    },
  });

  const totalAPagar = (lista.data ?? []).reduce((s, l) => s + l.aPagar, 0);
  const totalPago = (lista.data ?? []).reduce((s, l) => s + l.pago, 0);

  return (
    <div className="pilha">
      <Cabecalho titulo="Repasses" sub="Quanto cada igreja, semeador e parceiro tem a receber. O sistema não transfere dinheiro: pague pelo banco e registre aqui." />
      <div className="alerta info">
        Registrar um pagamento só marca o saldo como pago no sistema. Faça a transferência antes, pelo banco ou gateway, e anote a referência do comprovante.
      </div>
      <div className="filtros">
        <div className="campo">
          <label htmlFor="r-camp">Campanha</label>
          <select id="r-camp" className="input" value={campanhaId} onChange={(e) => setCampanhaId(e.target.value)}>
            <option value="">Todas</option>
            {campanhas.data?.map((c) => <option key={c.id} value={c.id}>{c.edicao}{c.ativa ? ' (ativa)' : ''}</option>)}
          </select>
        </div>
      </div>
      <div className="abas" role="tablist">
        <button role="tab" aria-selected={aba === 'beneficiarios'} className={`btn ${aba === 'beneficiarios' ? '' : 'sec'} peq`} onClick={() => setAba('beneficiarios')}>Por beneficiário</button>
        <button role="tab" aria-selected={aba === 'movimentacoes'} className={`btn ${aba === 'movimentacoes' ? '' : 'sec'} peq`} onClick={() => setAba('movimentacoes')}>Todas as movimentações</button>
      </div>
      {aba === 'movimentacoes' ? <TodasMovimentacoes campanhaId={campanhaId} /> : null}
      {aba === 'beneficiarios' ? <>
      <div className="grade grade-2">
        <div className="cartao kpi"><div className="rotulo">A pagar</div><div className="valor">{moeda(totalAPagar)}</div></div>
        <div className="cartao kpi"><div className="rotulo">Já pago</div><div className="valor">{moeda(totalPago)}</div></div>
      </div>
      <Erro erro={lista.error} />
      {lista.isLoading ? <Carregando /> : null}
      {lista.data ? (
        <div className="cartao">
          <div className="tabela-wrap">
            <table className="cartoes">
              <thead><tr><th>Beneficiário</th><th>Tipo</th><th>Chave PIX</th><th className="num">A pagar</th><th className="num">Pago</th><th /></tr></thead>
              <tbody>
                {lista.data.length === 0 ? <tr><td colSpan={6} className="vazio">Ainda não há ofertas pagas.</td></tr> : null}
                {lista.data.map((l) => (
                  <tr key={`${l.beneficiarioTipo}-${l.beneficiarioId}`}>
                    <td data-titulo><strong>{l.nome}</strong></td>
                    <td data-rotulo="Tipo">{TIPO[l.beneficiarioTipo]}</td>
                    <td data-rotulo="Chave PIX">{l.chavePix ? <code>{l.chavePix}</code> : '—'}</td>
                    <td className="num" data-rotulo="A pagar"><strong>{moeda(l.aPagar)}</strong></td>
                    <td className="num" data-rotulo="Pago">{moeda(l.pago)}</td>
                    <td className="acoes"><button className="btn sec peq" onClick={() => (pagar.reset(), setAberto(l))}>Detalhes</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      </> : null}

      {aberto ? (
        <Modal titulo={`${TIPO[aberto.beneficiarioTipo]}: ${aberto.nome}`} onFechar={() => setAberto(null)}>
          <div className="pilha">
            <Erro erro={detalhe.error ?? pagar.error} />
            {detalhe.data ? (
              <>
                <div className="grade grade-2">
                  <div className="cartao kpi"><div className="rotulo">A receber</div><div className="valor">{moeda(detalhe.data.saldo.aReceber)}</div></div>
                  <div className="cartao kpi"><div className="rotulo">Já recebido</div><div className="valor">{moeda(detalhe.data.saldo.recebido)}</div></div>
                </div>
                {aberto.chavePix ? <p style={{ margin: 0 }}>Chave PIX ({aberto.tipoChavePix}): <code style={{ userSelect: 'all' }}>{aberto.chavePix}</code></p> : null}
                {pagar.data ? <div className="alerta ok">Pagamento de {moeda(pagar.data.valor)} registrado.</div> : null}
                {detalhe.data.saldo.aReceber > 0 ? (
                  <form className="cartao pilha" style={{ boxShadow: 'none' }} onSubmit={(e) => {
                    e.preventDefault();
                    if (confirm(`Confirma que ${moeda(detalhe.data!.saldo.aReceber)} JÁ FOI PAGO por fora do sistema para ${aberto.nome}?`)) pagar.mutate();
                  }}>
                    <strong>Registrar pagamento de {moeda(detalhe.data.saldo.aReceber)}</strong>
                    <div className="campo">
                      <label htmlFor="ref">Referência do comprovante *</label>
                      <input id="ref" className="input" required minLength={3} maxLength={120} value={referencia} onChange={(e) => setReferencia(e.target.value)}
                        placeholder="Ex.: id da transação PIX ou nº do comprovante" />
                    </div>
                    <div className="campo">
                      <label htmlFor="obs">Observação</label>
                      <input id="obs" className="input" maxLength={300} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
                    </div>
                    <div><button className="btn" disabled={pagar.isPending}>Registrar pagamento</button></div>
                  </form>
                ) : null}

                {detalhe.data.pagamentos.length ? (
                  <div>
                    <h3>Pagamentos registrados</h3>
                    {detalhe.data.pagamentos.map((p) => (
                      <div key={p.id} style={{ borderTop: '1px solid var(--borda)', padding: '8px 0' }}>
                        <strong>{moeda(p.valor)}</strong> · ref. <code>{p.referencia}</code>
                        <div className="ajuda">{dataHora(p.criadoEm)} · {p.adminNome}{p.observacao ? ` · ${p.observacao}` : ''}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div>
                  <h3>Movimentações</h3>
                  <div className="tabela-wrap">
                    <table className="cartoes">
                      <thead><tr><th>Data</th><th>Igreja</th><th>Parte</th><th className="num">Valor</th><th>Situação</th></tr></thead>
                      <tbody>
                        {detalhe.data.movimentacoes.map((m) => (
                          <tr key={m.id}>
                            <td data-rotulo="Data">{dataHora(m.criadoEm)}</td>
                            <td data-titulo>{m.igreja}<div style={{ color: 'var(--texto-3)', fontSize: 12 }}>{m.campanha}</div></td>
                            <td data-rotulo="Parte">{m.papel} ({m.percentual}%)</td>
                            <td className="num" data-rotulo="Valor">{moeda(m.valor)}</td>
                            <td data-rotulo="Situação"><Selo status={m.status === 'pago' ? 'paga' : 'pendente'} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : <Carregando />}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

type MovLinha = { id: string; criadoEm: string; pagoEm: string | null; status: string; papel: string; percentual: number; valor: number; beneficiarioTipo: Linha['beneficiarioTipo']; campanha: string; igreja: string; beneficiario: string };

/** Lista única de lançamentos com filtros (tipo de beneficiário, situação e período). */
function TodasMovimentacoes({ campanhaId }: { campanhaId: string }) {
  const [f, setF] = useState({ tipo: '', status: '', de: '', ate: '' });
  const [pagina, setPagina] = useState(1);
  const qs = new URLSearchParams(Object.entries({ ...f, campanhaId, pagina: String(pagina) }).filter(([, v]) => v)).toString();
  const q = useQuery({ queryKey: ['movimentacoes', qs], queryFn: () => api<{ total: number; soma: number; pagina: number; porPagina: number; linhas: MovLinha[] }>(`/movimentacoes?${qs}`) });
  const set = (p: Partial<typeof f>) => (setPagina(1), setF((v) => ({ ...v, ...p })));
  return (
    <div className="pilha">
      <div className="filtros">
        <div className="campo"><label htmlFor="m-t">Beneficiário</label>
          <select id="m-t" className="input" value={f.tipo} onChange={(e) => set({ tipo: e.target.value })}>
            <option value="">Todos</option><option value="igreja">Igreja</option><option value="semeador">Semeador</option><option value="parceiro">Parceiro</option><option value="plataforma">Plataforma</option>
          </select></div>
        <div className="campo"><label htmlFor="m-s">Situação</label>
          <select id="m-s" className="input" value={f.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">Todas</option><option value="a_pagar">A pagar</option><option value="pago">Pago</option>
          </select></div>
        <div className="campo"><label htmlFor="m-de">De</label><input id="m-de" type="date" className="input" value={f.de} onChange={(e) => set({ de: e.target.value })} /></div>
        <div className="campo"><label htmlFor="m-ate">Até</label><input id="m-ate" type="date" className="input" value={f.ate} onChange={(e) => set({ ate: e.target.value })} /></div>
      </div>
      <Erro erro={q.error} />
      {q.isLoading ? <Carregando /> : null}
      {q.data ? (
        <div className="cartao">
          <h2>{q.data.total} lançamento(s) · {moeda(q.data.soma)}</h2>
          <div className="tabela-wrap">
            <table className="cartoes">
              <thead><tr><th>Data</th><th>Beneficiário</th><th>Igreja da oferta</th><th>Parte</th><th className="num">Valor</th><th>Situação</th></tr></thead>
              <tbody>
                {q.data.linhas.length === 0 ? <tr><td colSpan={6} className="vazio">Nenhuma movimentação com esses filtros.</td></tr> : null}
                {q.data.linhas.map((m) => (
                  <tr key={m.id}>
                    <td data-rotulo="Data">{dataHora(m.criadoEm)}</td>
                    <td data-titulo>{m.beneficiario}<div style={{ color: 'var(--texto-3)', fontSize: 12 }}>{TIPO[m.beneficiarioTipo]}</div></td>
                    <td data-rotulo="Igreja">{m.igreja}<div style={{ color: 'var(--texto-3)', fontSize: 12 }}>{m.campanha}</div></td>
                    <td data-rotulo="Parte">{m.papel} ({m.percentual}%)</td>
                    <td className="num" data-rotulo="Valor">{moeda(m.valor)}</td>
                    <td data-rotulo="Situação"><Selo status={m.status === 'pago' ? 'paga' : 'pendente'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="paginacao">
            <span>Página {q.data.pagina} de {Math.max(1, Math.ceil(q.data.total / q.data.porPagina))}</span>
            <div className="linha">
              <button className="btn sec peq" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
              <button className="btn sec peq" disabled={pagina * q.data.porPagina >= q.data.total} onClick={() => setPagina(pagina + 1)}>Próxima</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
