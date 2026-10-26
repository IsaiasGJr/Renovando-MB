import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, dataHora } from '../api';
import { Cabecalho, Carregando, Erro, Modal } from '../componentes/ui';

type IgrejaPendente = {
  id: string; nomeFantasia: string; razaoSocial: string; cnpj: string; cidade: string; uf: string;
  pastorNome: string; pastorWhatsapp: string; criadoEm: string; protocolo: string; semeador: string;
};
type SemeadorPendente = { id: string; nome: string; sobrenome: string; whatsapp: string; codigo: string; criadoEm: string; nivel: 1 | 2; indicadoPor: string };
type Dados = { igrejas: IgrejaPendente[]; semeadores: SemeadorPendente[] };
type Recusa = { tipo: 'igrejas' | 'semeadores'; id: string; nome: string };

/** Cadastros feitos pelo app (igrejas e semeadores) esperando análise, num lugar só. */
export default function Aprovacoes() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['aprovacoes'], queryFn: () => api<Dados>('/aprovacoes') });
  const [recusa, setRecusa] = useState<Recusa | null>(null);
  const [motivo, setMotivo] = useState('');

  const decidir = useMutation({
    mutationFn: (p: { tipo: 'igrejas' | 'semeadores'; id: string; acao: 'aprovar' | 'rejeitar'; motivo?: string }) =>
      api(`/aprovacoes/${p.tipo}/${p.id}`, { method: 'POST', json: { acao: p.acao, motivo: p.motivo ?? '' } }),
    onSuccess: () => {
      setRecusa(null);
      setMotivo('');
      qc.invalidateQueries({ queryKey: ['aprovacoes'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const botoes = (tipo: 'igrejas' | 'semeadores', id: string, nome: string) => (
    <div className="linha" style={{ justifyContent: 'flex-end' }}>
      <button className="btn peq" disabled={decidir.isPending} onClick={() => decidir.mutate({ tipo, id, acao: 'aprovar' })}>Aprovar</button>
      <button className="btn sec peq perigo" disabled={decidir.isPending} onClick={() => setRecusa({ tipo, id, nome })}>Recusar</button>
    </div>
  );

  return (
    <div className="pilha">
      <Cabecalho titulo="Aprovações" sub="Cadastros de igrejas e semeadores feitos pelo app, esperando análise. Quem se cadastrou recebe um aviso no celular." />
      <Erro erro={q.error ?? decidir.error} />
      {q.isLoading ? <Carregando /> : null}

      {q.data ? (
        <>
          <div className="cartao">
            <h2>Igrejas pendentes ({q.data.igrejas.length})</h2>
            {q.data.igrejas.length === 0 ? <p className="vazio">Nenhuma igreja pendente no momento.</p> : (
              <div className="tabela-wrap">
                <table className="cartoes">
                  <thead><tr><th>Igreja</th><th>Pastor</th><th>Indicada por</th><th>Cadastro</th><th /></tr></thead>
                  <tbody>
                    {q.data.igrejas.map((i) => (
                      <tr key={i.id}>
                        <td data-titulo><strong>{i.nomeFantasia}</strong>
                          <div style={{ color: 'var(--texto-3)', fontSize: 12 }}>{i.razaoSocial}{i.cnpj ? ` · CNPJ ${i.cnpj}` : ''} · {i.cidade}/{i.uf}</div></td>
                        <td data-rotulo="Pastor">{i.pastorNome}<div style={{ color: 'var(--texto-3)', fontSize: 12 }}>{i.pastorWhatsapp}</div></td>
                        <td data-rotulo="Indicada por">{i.semeador || '—'}</td>
                        <td data-rotulo="Cadastro">{dataHora(i.criadoEm)}<div style={{ color: 'var(--texto-3)', fontSize: 12 }}>{i.protocolo}</div></td>
                        <td className="acoes">{botoes('igrejas', i.id, i.nomeFantasia)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="cartao">
            <h2>Semeadores pendentes ({q.data.semeadores.length})</h2>
            {q.data.semeadores.length === 0 ? <p className="vazio">Nenhum semeador pendente no momento.</p> : (
              <div className="tabela-wrap">
                <table className="cartoes">
                  <thead><tr><th>Semeador</th><th>WhatsApp</th><th>Nível</th><th>Cadastro</th><th /></tr></thead>
                  <tbody>
                    {q.data.semeadores.map((s) => (
                      <tr key={s.id}>
                        <td data-titulo><strong>{s.nome} {s.sobrenome}</strong><div style={{ color: 'var(--texto-3)', fontSize: 12 }}>Código {s.codigo}</div></td>
                        <td data-rotulo="WhatsApp">{s.whatsapp}</td>
                        <td data-rotulo="Nível">{s.nivel === 2 ? `N2 (rede de ${s.indicadoPor})` : 'N1'}</td>
                        <td data-rotulo="Cadastro">{dataHora(s.criadoEm)}</td>
                        <td className="acoes">{botoes('semeadores', s.id, `${s.nome} ${s.sobrenome}`)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      {recusa ? (
        <Modal titulo={`Recusar: ${recusa.nome}`} onFechar={() => setRecusa(null)}
          rodape={<>
            <button className="btn sec" onClick={() => setRecusa(null)}>Cancelar</button>
            <button className="btn perigo" disabled={decidir.isPending}
              onClick={() => decidir.mutate({ tipo: recusa.tipo, id: recusa.id, acao: 'rejeitar', motivo })}>Recusar cadastro</button>
          </>}>
          <div className="campo">
            <label htmlFor="motivo">Motivo (opcional)</label>
            <textarea id="motivo" className="input" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: não conseguimos confirmar os dados da igreja" />
            <span className="ajuda">O motivo vai no aviso para quem se cadastrou e fica guardado no cadastro.</span>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
