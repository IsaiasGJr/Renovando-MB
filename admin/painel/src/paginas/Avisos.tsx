import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api, dataHora, numero } from '../api';
import { Cabecalho, Carregando, Erro } from '../componentes/ui';

type Resumo = {
  dispositivos: number;
  comLogin: number;
  enviados: { adminNome: string; resumo: string; criadoEm: string; detalhes: { mensagem?: string; enviados?: number; falhas?: number } }[];
};

const ROTAS: [string, string][] = [
  ['/', 'Início'], ['/premios', 'Prêmios'], ['/cupons', 'Meus cupons'], ['/igrejas', 'Igrejas'],
  ['/noticias', 'Novidades'], ['/shows', 'Shows gospel'], ['/palmas-para-jesus', 'Palmas para Jesus'],
];

/** Envio de avisos para o celular de todos que ativaram os avisos no app. */
export default function Avisos() {
  const qc = useQueryClient();
  const resumo = useQuery({ queryKey: ['avisos'], queryFn: () => api<Resumo>('/avisos') });
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [rota, setRota] = useState('/');

  const enviar = useMutation({
    mutationFn: () => api<{ enviados: number; falhas: number }>('/avisos', { method: 'POST', json: { titulo, mensagem, rota } }),
    onSuccess: () => {
      setTitulo('');
      setMensagem('');
      qc.invalidateQueries({ queryKey: ['avisos'] });
    },
  });

  function aoEnviar(e: FormEvent) {
    e.preventDefault();
    const total = resumo.data?.dispositivos ?? 0;
    if (window.confirm(`Enviar este aviso para ${numero(total)} celular(es)? Não dá para desfazer.`)) enviar.mutate();
  }

  return (
    <div className="pilha">
      <Cabecalho titulo="Avisos no celular"
        sub="Chegam como notificação para quem ativou os avisos no app. O lembrete na véspera e o resultado de cada sorteio já são enviados automaticamente." />
      <Erro erro={resumo.error} />
      {resumo.isLoading ? <Carregando /> : null}
      {resumo.data ? (
        <div className="grade grade-2">
          <div className="cartao kpi"><div className="rotulo">Celulares com avisos ativos</div><div className="valor">{numero(resumo.data.dispositivos)}</div></div>
          <div className="cartao kpi"><div className="rotulo">Desses, com conta</div><div className="valor">{numero(resumo.data.comLogin)}</div></div>
        </div>
      ) : null}

      <form className="cartao pilha" onSubmit={aoEnviar}>
        <h2 style={{ margin: 0 }}>Novo aviso</h2>
        <Erro erro={enviar.error} />
        {enviar.data ? <div className="alerta ok">Enviado para {numero(enviar.data.enviados)} celular(es){enviar.data.falhas ? ` (${enviar.data.falhas} não receberam)` : ''}.</div> : null}
        <div className="campo">
          <label htmlFor="av-titulo">Título * <span className="ajuda">({titulo.length}/65)</span></label>
          <input id="av-titulo" className="input" maxLength={65} required minLength={3} value={titulo} onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Última semana para concorrer ao iPhone!" />
        </div>
        <div className="campo">
          <label htmlFor="av-msg">Mensagem * <span className="ajuda">({mensagem.length}/240)</span></label>
          <textarea id="av-msg" className="input" maxLength={240} required minLength={5} style={{ minHeight: 80 }} value={mensagem}
            onChange={(e) => setMensagem(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="av-rota">Ao tocar, abre</label>
          <select id="av-rota" className="input" value={rota} onChange={(e) => setRota(e.target.value)}>
            {ROTAS.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
        </div>
        <div className="linha">
          <button className="btn" disabled={enviar.isPending || !resumo.data?.dispositivos}>
            {enviar.isPending ? 'Enviando…' : 'Enviar aviso'}
          </button>
          <span className="ajuda">Máximo de 5 avisos por hora.</span>
        </div>
      </form>

      {resumo.data?.enviados.length ? (
        <div className="cartao pilha">
          <h2 style={{ margin: 0 }}>Últimos avisos enviados</h2>
          {resumo.data.enviados.map((a) => (
            <div key={a.criadoEm} style={{ borderTop: '1px solid var(--borda)', paddingTop: 10 }}>
              <strong>{a.resumo}</strong>
              <div>{a.detalhes.mensagem}</div>
              <div className="ajuda">{dataHora(a.criadoEm)} · {a.adminNome} · {numero(a.detalhes.enviados ?? 0)} recebido(s)</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
