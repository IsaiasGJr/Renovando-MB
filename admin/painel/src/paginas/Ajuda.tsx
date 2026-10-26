import { useMemo, useState } from 'react';
import { Cabecalho } from '../componentes/ui';
import { GUIAS } from '../guias';

/** Central de ajuda: passo a passo das tarefas do painel. */
export default function Ajuda() {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(GUIAS[0]?.titulo ?? null);
  const termo = busca.trim().toLowerCase();
  const lista = useMemo(
    () => (termo ? GUIAS.filter((g) => `${g.titulo} ${g.grupo} ${g.passos.join(' ')}`.toLowerCase().includes(termo)) : GUIAS),
    [termo],
  );

  return (
    <div className="pilha" style={{ maxWidth: 820 }}>
      <Cabecalho titulo="Central de ajuda" sub="Passo a passo das tarefas do painel. O mesmo conteúdo está no app admin." />
      <input className="input" placeholder="Buscar (ex.: sorteio, panfleto, repasse)" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar na ajuda" />
      {lista.length === 0 ? <p className="vazio">Nada encontrado.</p> : null}
      {lista.map((g) => {
        const ativo = aberto === g.titulo || !!termo;
        return (
          <div key={g.titulo} className="cartao">
            <button onClick={() => setAberto(ativo && !termo ? null : g.titulo)} aria-expanded={ativo}
              style={{ all: 'unset', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', width: '100%', gap: 12 }}>
              <span><span className="ajuda">{g.grupo}</span><br /><strong>{g.titulo}</strong></span>
              <span aria-hidden="true">{ativo ? '−' : '+'}</span>
            </button>
            {ativo ? (
              <ol style={{ margin: '12px 0 0', paddingLeft: 20, lineHeight: 1.6 }}>
                {g.passos.map((p) => <li key={p}>{p}</li>)}
              </ol>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
