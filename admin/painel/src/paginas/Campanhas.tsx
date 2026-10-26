import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, data, enviarImagem, moeda } from '../api';
import { Cabecalho, Carregando, Erro, Modal } from '../componentes/ui';

type Divisao = { rotulo: string; percentual: number }[];
export type Campanha = {
  id: string; edicao: string; titulo: string; subtitulo: string; descricao: string; valorCupom: number;
  divisao: Divisao; inicio: string | null; fim: string | null; ativa: boolean; imagemCupom?: string; imagemPanfleto?: string;
};

const NOVA: Omit<Campanha, 'id' | 'ativa'> = {
  edicao: '', titulo: '', subtitulo: '', descricao: '', valorCupom: 20, inicio: '', fim: '', imagemCupom: '', imagemPanfleto: '',
  divisao: [
    { rotulo: 'Igreja', percentual: 80 },
    { rotulo: 'Semeador', percentual: 7 },
    { rotulo: 'Parceiro da campanha', percentual: 5 },
    { rotulo: 'Plataforma', percentual: 8 },
  ],
};

export function useCampanhas() {
  return useQuery({ queryKey: ['campanhas'], queryFn: () => api<Campanha[]>('/campanhas') });
}

export default function Campanhas() {
  const qc = useQueryClient();
  const lista = useCampanhas();
  const [form, setForm] = useState<(Omit<Campanha, 'id' | 'ativa'> & { id?: string }) | null>(null);
  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ['campanhas'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const salvar = useMutation({
    mutationFn: () => {
      const { id, ...corpo } = form!;
      const payload = { ...corpo, valorCupom: Number(corpo.valorCupom), inicio: corpo.inicio || null, fim: corpo.fim || null };
      return id ? api(`/campanhas/${id}`, { method: 'PUT', json: payload }) : api('/campanhas', { method: 'POST', json: payload });
    },
    onSuccess: () => (setForm(null), recarregar()),
  });
  const ativar = useMutation({ mutationFn: (id: string) => api(`/campanhas/${id}/ativar`, { method: 'POST' }), onSuccess: recarregar });
  const excluir = useMutation({ mutationFn: (id: string) => api(`/campanhas/${id}`, { method: 'DELETE' }), onSuccess: recarregar });

  const soma = form?.divisao.reduce((s, d) => s + Number(d.percentual || 0), 0) ?? 0;
  const setDiv = (i: number, campo: 'rotulo' | 'percentual', v: string) =>
    setForm({ ...form!, divisao: form!.divisao.map((d, j) => (j === i ? { ...d, [campo]: campo === 'percentual' ? Number(v) : v } : d)) });

  return (
    <div className="pilha">
      <Cabecalho titulo="Campanhas" sub="Só uma campanha fica ativa por vez: é ela que aparece no app.">
        <button className="btn" onClick={() => (salvar.reset(), setForm({ ...NOVA, divisao: NOVA.divisao.map((d) => ({ ...d })) }))}>+ Nova campanha</button>
      </Cabecalho>
      <Erro erro={lista.error ?? ativar.error ?? excluir.error} />
      {lista.isLoading ? <Carregando /> : (
        <div className="grade grade-2">
          {lista.data?.map((c) => (
            <div key={c.id} className="cartao pilha" style={c.ativa ? { borderColor: 'var(--primaria)', borderWidth: 2 } : undefined}>
              <div className="linha" style={{ justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0 }}>{c.edicao}</h2>
                {c.ativa ? <span className="selo ok">Ativa no app</span> : <span className="selo">Inativa</span>}
              </div>
              <div>{c.titulo} {c.subtitulo}</div>
              <div style={{ color: 'var(--texto-2)' }}>
                Cupom de {moeda(c.valorCupom)} · {data(c.inicio)} a {data(c.fim)}
              </div>
              <div className="linha">
                {c.divisao.map((d) => <span key={d.rotulo} className="selo">{d.rotulo} {d.percentual}%</span>)}
              </div>
              <div className="linha">
                <button className="btn sec peq" onClick={() => (salvar.reset(), setForm({ ...c, inicio: c.inicio ?? '', fim: c.fim ?? '' }))}>Editar</button>
                {!c.ativa ? (
                  <button className="btn peq" onClick={() => confirm(`Ativar "${c.edicao}"? A campanha atual deixa de aparecer no app.`) && ativar.mutate(c.id)}>Ativar</button>
                ) : null}
                {!c.ativa ? (
                  <button className="btn perigo peq" onClick={() => confirm('Excluir esta campanha?') && excluir.mutate(c.id)}>Excluir</button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {form ? (
        <Modal
          titulo={form.id ? 'Editar campanha' : 'Nova campanha'}
          onFechar={() => setForm(null)}
          rodape={
            <>
              <button className="btn sec" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn" disabled={salvar.isPending || Math.abs(soma - 100) > 0.01} onClick={() => salvar.mutate()}>
                {salvar.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </>
          }
        >
          <div className="pilha">
            <Erro erro={salvar.error} />
            <div className="form-grade">
              {([
                ['edicao', 'Edição *', 'Ex.: Edição 2027'],
                ['valorCupom', 'Valor do cupom (R$) *', ''],
                ['titulo', 'Título *', 'Ex.: Semeando esperança,'],
                ['subtitulo', 'Subtítulo', 'Ex.: Distribuindo prêmios.'],
              ] as const).map(([k, l, ph]) => (
                <div key={k} className="campo">
                  <label htmlFor={`c-${k}`}>{l}</label>
                  <input id={`c-${k}`} className="input" placeholder={ph} type={k === 'valorCupom' ? 'number' : 'text'}
                    value={String(form[k] ?? '')} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </div>
              ))}
              <div className="campo largo">
                <label htmlFor="c-desc">Descrição</label>
                <textarea id="c-desc" className="input" style={{ minHeight: 70 }} value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <CampoArte id="c-arte" rotulo="Arte do cupom" valor={form.imagemCupom ?? ''} onChange={(u) => setForm((v) => (v ? { ...v, imagemCupom: u } : v))}
                ajuda='O bilhete que o ofertante baixa em "Meus cupons", como no site: a arte em pé (640 × 930) com a parte de baixo em branco, onde o sistema escreve o número, a igreja e a data.' />
              <CampoArte id="c-panfleto" rotulo="Panfleto" valor={form.imagemPanfleto ?? ''} onChange={(u) => setForm((v) => (v ? { ...v, imagemPanfleto: u } : v))}
                ajuda="Arte deitada de 1200 × 470, como no site, com o quadro branco no canto direito: cada igreja baixa o PDF com o QR Code dela nesse quadro (1 ou 6 por folha)." />
              <div className="campo">
                <label htmlFor="c-ini">Início</label>
                <input id="c-ini" type="date" className="input" value={form.inicio ?? ''} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
              </div>
              <div className="campo">
                <label htmlFor="c-fim">Fim</label>
                <input id="c-fim" type="date" className="input" value={form.fim ?? ''} onChange={(e) => setForm({ ...form, fim: e.target.value })} />
              </div>
            </div>

            <div className="cartao" style={{ boxShadow: 'none' }}>
              <div className="linha" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <h2 style={{ margin: 0 }}>Divisão de cada oferta</h2>
                <span className={`selo ${Math.abs(soma - 100) < 0.01 ? 'ok' : 'erro'}`}>Total {soma}%</span>
              </div>
              <div className="pilha" style={{ gap: 8 }}>
                {form.divisao.map((d, i) => (
                  <div key={i} className="linha">
                    <input className="input" style={{ flex: 1 }} aria-label="Destinatário" value={d.rotulo} onChange={(e) => setDiv(i, 'rotulo', e.target.value)} />
                    <input className="input" style={{ width: 90 }} aria-label="Percentual" type="number" value={d.percentual}
                      onChange={(e) => setDiv(i, 'percentual', e.target.value)} />
                    <span>%</span>
                    <button className="btn perigo peq" onClick={() => setForm({ ...form, divisao: form.divisao.filter((_, j) => j !== i) })}>Remover</button>
                  </div>
                ))}
                <div>
                  <button className="btn sec peq" onClick={() => setForm({ ...form, divisao: [...form.divisao, { rotulo: '', percentual: 0 }] })}>+ Destinatário</button>
                </div>
                <span className="ajuda" style={{ color: 'var(--texto-3)', fontSize: 12 }}>
                  O destinatário chamado “Igreja” é usado no relatório de repasses por igreja. A soma precisa dar 100%.
                </span>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/** Envio de uma arte da campanha (cupom ou panfleto) com prévia. */
function CampoArte({ id, rotulo, valor, onChange, ajuda }: { id: string; rotulo: string; valor: string; onChange: (url: string) => void; ajuda: string }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  return (
    <div className="campo largo">
      <label htmlFor={id}>{rotulo}</label>
      <div className="linha" style={{ alignItems: 'flex-start' }}>
        {valor ? <img src={valor} alt={rotulo} style={{ width: 120, maxHeight: 140, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--borda)' }} /> : null}
        <div className="pilha" style={{ gap: 6, flex: 1 }}>
          <span className="ajuda">{ajuda}</span>
          <div className="linha">
            <label className="btn sec peq">
              {enviando ? 'Enviando…' : valor ? 'Trocar' : 'Enviar'}
              <input id={id} type="file" accept="image/*" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setErro('');
                setEnviando(true);
                try {
                  onChange(await enviarImagem(f));
                } catch (err) {
                  setErro((err as Error).message);
                } finally {
                  setEnviando(false);
                }
              }} />
            </label>
            {valor ? <button type="button" className="btn sec peq" onClick={() => onChange('')}>Remover</button> : null}
          </div>
          {erro ? <span style={{ color: 'var(--erro)' }}>{erro}</span> : null}
        </div>
      </div>
    </div>
  );
}
