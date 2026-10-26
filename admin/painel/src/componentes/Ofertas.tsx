import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, baixar, dataHora, moeda } from '../api';
import { Carregando, Erro, Modal, Selo } from './ui';

type Detalhe = {
  id: string; criadaEm: string; pagaEm: string | null; status: string; quantidade: number; valor: number; anonima: boolean;
  origem: string; observacao: string; registradaPor: string; igreja: string; cidade: string; campanha: string; ofertante: string; whatsapp: string;
  cupons: { numero: string; criadoEm: string }[];
  divisao: { papel: string; percentual: number; valor: number; status: string; beneficiarioTipo: string; beneficiario: string }[];
};

/** Detalhe de uma oferta: cupons gerados e para onde vai cada parte do dinheiro. */
export function DetalheOferta({ id, onFechar }: { id: string; onFechar: () => void }) {
  const q = useQuery({ queryKey: ['oferta', id], queryFn: () => api<Detalhe>(`/ofertas/${id}`) });
  const [erroCsv, setErroCsv] = useState<unknown>(null);
  const o = q.data;
  return (
    <Modal titulo="Oferta" onFechar={onFechar}>
      <div className="pilha">
        <Erro erro={q.error ?? erroCsv} />
        {!o ? <Carregando /> : (
          <>
            <div className="form-grade">
              <div><div className="ajuda">Valor</div><strong>{moeda(o.valor)}</strong> <Selo status={o.status} /></div>
              <div><div className="ajuda">Ofertante</div>{o.ofertante}{o.whatsapp ? <div className="ajuda">{o.whatsapp}</div> : null}</div>
              <div><div className="ajuda">Igreja</div>{o.igreja}<div className="ajuda">{o.cidade}</div></div>
              <div><div className="ajuda">Campanha</div>{o.campanha}</div>
              <div><div className="ajuda">Criada em</div>{dataHora(o.criadaEm)}</div>
              <div><div className="ajuda">Paga em</div>{o.pagaEm ? dataHora(o.pagaEm) : '—'}</div>
            </div>
            {o.origem === 'manual' ? (
              <div className="alerta info">Registrada à mão por {o.registradaPor}: {o.observacao}</div>
            ) : null}

            <div>
              <h3>Para onde vai o dinheiro</h3>
              {o.divisao.length === 0 ? <p className="ajuda">Esta oferta ainda não foi paga.</p> : (
                <table className="cartoes">
                  <thead><tr><th>Parte</th><th>Quem recebe</th><th className="num">Valor</th><th>Repasse</th></tr></thead>
                  <tbody>
                    {o.divisao.map((d, i) => (
                      <tr key={i}>
                        <td data-titulo>{d.papel} ({d.percentual}%)</td>
                        <td data-rotulo="Quem recebe">{d.beneficiario ?? '—'}</td>
                        <td className="num" data-rotulo="Valor">{moeda(d.valor)}</td>
                        <td data-rotulo="Repasse"><Selo status={d.status === 'pago' ? 'paga' : 'pendente'} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <div className="linha" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>Cupons ({o.cupons.length})</h3>
                {o.cupons.length ? (
                  <button className="btn sec peq" onClick={() => baixar(`/ofertas/${o.id}/cupons.csv`, `cupons-oferta-${o.id.slice(0, 8)}.csv`).catch(setErroCsv)}>
                    Baixar planilha
                  </button>
                ) : null}
              </div>
              {o.cupons.length === 0 ? <p className="ajuda">{o.anonima ? 'Oferta anônima: não gera números da sorte.' : 'Esta oferta ainda não gerou cupons.'}</p> : (
                <div className="linha" style={{ flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {o.cupons.map((c) => <code key={c.numero} style={{ padding: '2px 6px', borderRadius: 6, background: 'var(--primaria-clara)' }}>#{c.numero}</code>)}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

type Igreja = { id: string; nomeFantasia: string; cidade: string; uf: string; status: string };

/** Registrar uma oferta recebida fora do app (ex.: dinheiro no culto). Entra como paga e gera os números. */
export function RegistrarOferta({ onFechar, onPronto }: { onFechar: () => void; onPronto: () => void }) {
  const igrejas = useQuery({ queryKey: ['igrejas', 'ativas'], queryFn: () => api<Igreja[]>('/igrejas?status=ativa') });
  const [f, setF] = useState({ igrejaId: '', quantidade: 1, anonima: false, nome: '', sobrenome: '', whatsapp: '', observacao: '' });
  const salvar = useMutation({
    mutationFn: () => api<{ valor: number; numeros: string[] }>('/ofertas/manual', { method: 'POST', json: { ...f, quantidade: Number(f.quantidade) } }),
    onSuccess: onPronto,
  });
  const set = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }));

  return (
    <Modal titulo="Registrar oferta recebida fora do app" onFechar={onFechar}
      rodape={salvar.data ? <button className="btn" onClick={onFechar}>Fechar</button> : <>
        <button className="btn sec" onClick={onFechar}>Cancelar</button>
        <button className="btn" disabled={salvar.isPending || !f.igrejaId}
          onClick={() => confirm('Esta oferta entra como PAGA e gera os números da sorte e os repasses. Confirmar?') && salvar.mutate()}>
          Registrar
        </button>
      </>}>
      <div className="pilha">
        <Erro erro={salvar.error} />
        {salvar.data ? (
          <div className="alerta ok">
            Oferta de {moeda(salvar.data.valor)} registrada.{salvar.data.numeros.length ? ` Números da sorte: ${salvar.data.numeros.map((n) => `#${n}`).join(', ')}.` : ''}
            {f.whatsapp ? ' A pessoa vê os números no app, entrando com este WhatsApp.' : ''}
          </div>
        ) : (
          <div className="form-grade">
            <div className="campo largo">
              <label htmlFor="o-ig">Igreja *</label>
              <select id="o-ig" className="input" value={f.igrejaId} onChange={(e) => set({ igrejaId: e.target.value })}>
                <option value="">Escolha a igreja</option>
                {igrejas.data?.map((i) => <option key={i.id} value={i.id}>{i.nomeFantasia} ({i.cidade}/{i.uf})</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="o-q">Cupons (quantidade) *</label>
              <input id="o-q" className="input" type="number" min={1} max={500} value={f.quantidade} onChange={(e) => set({ quantidade: Number(e.target.value) })} />
            </div>
            <div className="campo">
              <label className="check"><input type="checkbox" checked={f.anonima} onChange={(e) => set({ anonima: e.target.checked })} /> Anônima (não concorre)</label>
            </div>
            {!f.anonima ? (
              <>
                <div className="campo"><label htmlFor="o-n">Nome</label><input id="o-n" className="input" value={f.nome} onChange={(e) => set({ nome: e.target.value })} /></div>
                <div className="campo"><label htmlFor="o-s">Sobrenome</label><input id="o-s" className="input" value={f.sobrenome} onChange={(e) => set({ sobrenome: e.target.value })} /></div>
                <div className="campo largo">
                  <label htmlFor="o-w">WhatsApp de quem ofertou *</label>
                  <input id="o-w" className="input" inputMode="tel" placeholder="(63) 99999-9999" value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} />
                  <span className="ajuda">É com este número que a pessoa vê os cupons no app.</span>
                </div>
              </>
            ) : null}
            <div className="campo largo">
              <label htmlFor="o-obs">Como a oferta foi recebida *</label>
              <input id="o-obs" className="input" maxLength={300} value={f.observacao} onChange={(e) => set({ observacao: e.target.value })}
                placeholder="Ex.: dinheiro entregue no culto de domingo, recibo nº 123" />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
