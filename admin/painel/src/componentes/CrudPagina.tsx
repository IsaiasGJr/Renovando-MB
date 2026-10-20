import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { api } from '../api';
import { Formulario, paraPayload, valoresIniciais, type CampoDef, type Valores } from './Formulario';
import { Cabecalho, Carregando, Erro, Modal } from './ui';

export type Coluna<T> = { titulo: string; render: (linha: T) => ReactNode; num?: boolean };

type Props<T> = {
  recurso: string;
  titulo: string;
  sub?: string;
  rotuloItem: string;
  /** Usa "Nova" em vez de "Novo" (ex.: nova igreja). */
  feminino?: boolean;
  campos: CampoDef[];
  colunas: Coluna<T>[];
  filtroStatus?: { valor: string; rotulo: string }[];
  statusInicial?: string;
  parametros?: Record<string, string>;
  acoes?: (linha: T, recarregar: () => void) => ReactNode;
  podeCriar?: boolean;
  podeExcluir?: boolean;
  topo?: ReactNode;
  /** Ajusta o payload antes de enviar (ex.: incluir a campanha selecionada). */
  ajustar?: (payload: Valores) => Valores;
};

export function CrudPagina<T extends { id: string }>(p: Props<T>) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(p.statusInicial ?? '');
  const [editando, setEditando] = useState<T | 'novo' | null>(null);
  const [valores, setValores] = useState<Valores>({});

  const params = new URLSearchParams({ ...(p.parametros ?? {}), ...(status ? { status } : {}) }).toString();
  const chave = [p.recurso, params];
  const lista = useQuery({ queryKey: chave, queryFn: () => api<T[]>(`/${p.recurso}${params ? `?${params}` : ''}`) });
  const recarregar = () => qc.invalidateQueries({ queryKey: [p.recurso] });
  // No celular, a primeira coluna com título vira o título do cartão.
  const iTitulo = p.colunas.findIndex((c) => c.titulo);

  const salvar = useMutation({
    mutationFn: () => {
      const existente = editando !== 'novo' && editando ? editando : null;
      let payload = paraPayload(p.campos, valores, !!existente);
      if (p.ajustar) payload = p.ajustar(payload);
      return existente
        ? api(`/${p.recurso}/${existente.id}`, { method: 'PUT', json: payload })
        : api(`/${p.recurso}`, { method: 'POST', json: payload });
    },
    onSuccess: () => {
      setEditando(null);
      recarregar();
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const excluir = useMutation({
    mutationFn: (id: string) => api(`/${p.recurso}/${id}`, { method: 'DELETE' }),
    onSuccess: recarregar,
  });

  function abrir(registro: T | 'novo') {
    salvar.reset();
    setValores(valoresIniciais(p.campos, registro === 'novo' ? undefined : (registro as unknown as Valores)));
    setEditando(registro);
  }

  return (
    <>
      <Cabecalho titulo={p.titulo} sub={p.sub}>
        {p.podeCriar !== false ? <button className="btn" onClick={() => abrir('novo')}>+ {p.feminino ? 'Nova' : 'Novo'} {p.rotuloItem}</button> : null}
      </Cabecalho>

      {p.topo}

      {p.filtroStatus ? (
        <div className="filtros">
          <div className="campo">
            <label htmlFor="filtro-status">Status</label>
            <select id="filtro-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              {p.filtroStatus.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
            </select>
          </div>
        </div>
      ) : null}

      <div className="cartao">
        <Erro erro={lista.error ?? excluir.error} />
        {lista.isLoading ? <Carregando /> : (
          <div className="tabela-wrap">
            <table className="cartoes">
              <thead>
                <tr>
                  {p.colunas.map((c, i) => <th key={c.titulo || i} className={c.num ? 'num' : undefined}>{c.titulo}</th>)}
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.data?.length === 0 ? (
                  <tr><td colSpan={p.colunas.length + 1} className="vazio">Nenhum registro.</td></tr>
                ) : null}
                {lista.data?.map((linha) => (
                  <tr key={linha.id}>
                    {p.colunas.map((c, i) => (
                      <td key={c.titulo || i} className={c.num ? 'num' : undefined}
                        data-titulo={i === iTitulo ? '' : undefined}
                        data-rotulo={i !== iTitulo && c.titulo ? c.titulo : undefined}>
                        <span className="celula">{c.render(linha)}</span>
                      </td>
                    ))}
                    <td className="acoes">
                      <div className="linha" style={{ justifyContent: 'flex-end' }}>
                        {p.acoes?.(linha, recarregar)}
                        <button className="btn sec peq" onClick={() => abrir(linha)}>Editar</button>
                        {p.podeExcluir !== false ? (
                          <button className="btn perigo peq"
                            onClick={() => confirm(`Excluir ${p.feminino ? 'esta' : 'este'} ${p.rotuloItem}? Essa ação não pode ser desfeita.`) && excluir.mutate(linha.id)}>
                            Excluir
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editando ? (
        <Modal
          titulo={editando === 'novo' ? `${p.feminino ? 'Nova' : 'Novo'} ${p.rotuloItem}` : `Editar ${p.rotuloItem}`}
          onFechar={() => setEditando(null)}
          rodape={
            <>
              <button className="btn sec" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
                {salvar.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </>
          }
        >
          <div className="pilha">
            <Erro erro={salvar.error} />
            <Formulario campos={p.campos} valores={valores} onChange={setValores} editando={editando !== 'novo'} />
          </div>
        </Modal>
      ) : null}
    </>
  );
}
