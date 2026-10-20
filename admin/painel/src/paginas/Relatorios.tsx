import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, baixar, dataHora, moeda, numero } from '../api';
import { BarrasHorizontais, completarDias, GraficoArrecadacao } from '../componentes/Graficos';
import { Cabecalho, Carregando, Erro, Selo } from '../componentes/ui';
import { ROTULO_STATUS_OFERTA, type DadosDashboard } from '../consultas';

type Relatorio = Pick<DadosDashboard, 'resumo' | 'porDia' | 'porStatus' | 'repasses'> & {
  porIgreja: DadosDashboard['topIgrejas'];
  total: number;
  pagina: number;
  porPagina: number;
  ofertas: {
    id: string; criadaEm: string; status: string; quantidade: number; valor: number; igreja: string;
    cidade: string; ofertante: string; whatsapp: string; campanha: string;
  }[];
};

type RepasseIgreja = { igreja: string; cidade: string; chavePix: string; arrecadado: number; repasse: number; ofertas: number };

const isoDias = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);

export default function Relatorios() {
  const [aba, setAba] = useState<'ofertas' | 'igrejas'>('ofertas');
  const [f, setF] = useState({ campanhaId: '', igrejaId: '', status: '', de: isoDias(29), ate: isoDias(0) });
  const [pagina, setPagina] = useState(1);
  const set = (k: keyof typeof f, v: string) => (setF({ ...f, [k]: v }), setPagina(1));

  const campanhas = useQuery({ queryKey: ['campanhas'], queryFn: () => api<{ id: string; edicao: string }[]>('/campanhas') });
  const igrejas = useQuery({ queryKey: ['igrejas', ''], queryFn: () => api<{ id: string; nomeFantasia: string }[]>('/igrejas') });

  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const rel = useQuery({
    queryKey: ['relatorio', qs, pagina],
    queryFn: () => api<Relatorio>(`/relatorios/ofertas?${qs}&pagina=${pagina}`),
    enabled: aba === 'ofertas',
  });
  const porIgreja = useQuery({
    queryKey: ['relatorio-igrejas', qs],
    queryFn: () => api<RepasseIgreja[]>(`/relatorios/igrejas?${qs}`),
    enabled: aba === 'igrejas',
  });

  const [erroCsv, setErroCsv] = useState<unknown>(null);
  const r = rel.data;

  return (
    <div className="pilha">
      <Cabecalho titulo="Relatórios" sub="Ofertas, arrecadação e repasses por período">
        <button className={`btn ${aba === 'ofertas' ? '' : 'sec'}`} onClick={() => setAba('ofertas')}>Ofertas</button>
        <button className={`btn ${aba === 'igrejas' ? '' : 'sec'}`} onClick={() => setAba('igrejas')}>Repasses por igreja</button>
        <button className="btn sec" onClick={() => baixar(`/relatorios/ofertas.csv?${qs}`, 'ofertas.csv').catch(setErroCsv)}>
          Exportar CSV
        </button>
      </Cabecalho>

      <div className="filtros">
        <div className="campo">
          <label htmlFor="f-camp">Campanha</label>
          <select id="f-camp" className="input" value={f.campanhaId} onChange={(e) => set('campanhaId', e.target.value)}>
            <option value="">Todas</option>
            {campanhas.data?.map((c) => <option key={c.id} value={c.id}>{c.edicao}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="f-igr">Igreja</label>
          <select id="f-igr" className="input" value={f.igrejaId} onChange={(e) => set('igrejaId', e.target.value)}>
            <option value="">Todas</option>
            {igrejas.data?.map((i) => <option key={i.id} value={i.id}>{i.nomeFantasia}</option>)}
          </select>
        </div>
        {aba === 'ofertas' ? (
          <div className="campo">
            <label htmlFor="f-st">Situação</label>
            <select id="f-st" className="input" value={f.status} onChange={(e) => set('status', e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(ROTULO_STATUS_OFERTA).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ) : null}
        <div className="campo">
          <label htmlFor="f-de">De</label>
          <input id="f-de" type="date" className="input" value={f.de} onChange={(e) => set('de', e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="f-ate">Até</label>
          <input id="f-ate" type="date" className="input" value={f.ate} onChange={(e) => set('ate', e.target.value)} />
        </div>
        <div className="linha">
          {[[7, '7 dias'], [30, '30 dias'], [90, '90 dias']].map(([d, l]) => (
            <button key={l} className="btn sec peq" onClick={() => (setF({ ...f, de: isoDias(Number(d) - 1), ate: isoDias(0) }), setPagina(1))}>{l}</button>
          ))}
          <button className="btn sec peq" onClick={() => (setF({ ...f, de: '', ate: '' }), setPagina(1))}>Tudo</button>
        </div>
      </div>

      <Erro erro={erroCsv} />

      {aba === 'igrejas' ? (
        <div className="cartao">
          <h2>Quanto cada igreja tem a receber</h2>
          <Erro erro={porIgreja.error} />
          {porIgreja.isLoading ? <Carregando /> : (
            <div className="tabela-wrap">
              <table className="cartoes">
                <thead>
                  <tr><th>Igreja</th><th>Cidade</th><th>Chave PIX</th><th className="num">Ofertas</th><th className="num">Arrecadado</th><th className="num">Repasse à igreja</th></tr>
                </thead>
                <tbody>
                  {porIgreja.data?.length === 0 ? <tr><td colSpan={6} className="vazio">Sem ofertas pagas no período.</td></tr> : null}
                  {porIgreja.data?.map((l) => (
                    <tr key={l.igreja + l.cidade}>
                      <td data-titulo>{l.igreja}</td><td data-rotulo="Cidade">{l.cidade}</td><td data-rotulo="Chave PIX">{l.chavePix || '—'}</td>
                      <td className="num" data-rotulo="Ofertas">{numero(l.ofertas)}</td><td className="num" data-rotulo="Arrecadado">{moeda(l.arrecadado)}</td>
                      <td className="num" data-rotulo="Repasse à igreja"><strong>{moeda(l.repasse)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : rel.isLoading ? <Carregando /> : !r ? <Erro erro={rel.error} /> : (
        <>
          <div className="grade grade-kpi">
            <div className="cartao kpi"><div className="rotulo">Arrecadado</div><div className="valor">{moeda(r.resumo.arrecadado)}</div></div>
            <div className="cartao kpi"><div className="rotulo">Ofertas pagas</div><div className="valor">{numero(r.resumo.ofertas)}</div></div>
            <div className="cartao kpi"><div className="rotulo">Cupons</div><div className="valor">{numero(r.resumo.cupons)}</div></div>
            <div className="cartao kpi"><div className="rotulo">Ticket médio</div><div className="valor">{moeda(r.resumo.ticketMedio)}</div></div>
            <div className="cartao kpi"><div className="rotulo">Conversão</div><div className="valor">{r.resumo.conversao.toLocaleString('pt-BR')}%</div></div>
          </div>

          <div className="cartao">
            <h2>Arrecadação por dia</h2>
            <GraficoArrecadacao dados={completarDias(r.porDia, f.de || undefined, f.ate || undefined)} />
          </div>

          <div className="grade grade-2">
            <div className="cartao">
              <h2>Por igreja</h2>
              <BarrasHorizontais itens={r.porIgreja.map((i) => ({ rotulo: i.igreja, detalhe: `${i.cidade}/${i.uf}`, valor: i.valor }))} />
            </div>
            <div className="cartao">
              <h2>Divisão (repasses)</h2>
              <BarrasHorizontais itens={r.repasses.map((x) => ({ rotulo: x.rotulo, valor: x.valor }))} />
            </div>
          </div>

          <div className="cartao">
            <h2>Ofertas ({numero(r.total)})</h2>
            <div className="tabela-wrap">
              <table className="cartoes">
                <thead>
                  <tr><th>Data</th><th>Ofertante</th><th>WhatsApp</th><th>Igreja</th><th>Situação</th><th className="num">Cupons</th><th className="num">Valor</th></tr>
                </thead>
                <tbody>
                  {r.ofertas.length === 0 ? <tr><td colSpan={7} className="vazio">Nenhuma oferta com esses filtros.</td></tr> : null}
                  {r.ofertas.map((o) => (
                    <tr key={o.id}>
                      <td data-rotulo="Data">{dataHora(o.criadaEm)}</td><td data-titulo>{o.ofertante}</td><td data-rotulo="WhatsApp">{o.whatsapp || '—'}</td>
                      <td data-rotulo="Igreja"><span className="celula">{o.igreja}<div style={{ color: 'var(--texto-3)', fontSize: 12 }}>{o.cidade}</div></span></td>
                      <td data-rotulo="Situação"><Selo status={o.status} /></td>
                      <td className="num" data-rotulo="Cupons">{o.quantidade}</td><td className="num" data-rotulo="Valor">{moeda(o.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="paginacao">
              <span>Página {r.pagina} de {Math.max(1, Math.ceil(r.total / r.porPagina))}</span>
              <div className="linha">
                <button className="btn sec peq" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
                <button className="btn sec peq" disabled={pagina * r.porPagina >= r.total} onClick={() => setPagina(pagina + 1)}>Próxima</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
