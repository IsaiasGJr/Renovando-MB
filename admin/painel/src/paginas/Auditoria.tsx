import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, dataHora, numero } from '../api';
import { Cabecalho, Carregando, Erro } from '../componentes/ui';

type Registro = {
  id: string; adminNome: string; acao: string; recurso: string; registroId: string | null;
  resumo: string; detalhes: Record<string, unknown>; ip: string; criadoEm: string;
};

export const ROTULO_ACAO: Record<string, string> = {
  criar: 'Criou', editar: 'Editou', excluir: 'Excluiu', ativar: 'Ativou', sortear: 'Sorteou',
  desfazer_sorteio: 'Desfez sorteio', login: 'Entrou', login_falhou: 'Login recusado',
  exportar: 'Exportou', encerrar_sessoes: 'Saiu de todos os aparelhos',
};

export const ROTULO_RECURSO: Record<string, string> = {
  igrejas: 'Igreja', semeadores: 'Semeador', campanhas: 'Campanha', premios: 'Prêmio', noticias: 'Notícia',
  depoimentos: 'Depoimento', faqs: 'Pergunta', artistas: 'Artista', 'solicitacoes-show': 'Pedido de show',
  admins: 'Usuário do admin', sessao: 'Sessão', upload: 'Imagem', conta: 'Conta de ofertante', relatorios: 'Relatório',
};

/** Texto legível das mudanças: "chavePix: a@a.com → b@b.com". */
export function descreverDetalhes(r: Registro) {
  if (r.acao !== 'editar') return '';
  return Object.entries(r.detalhes)
    .map(([campo, v]) => {
      const { de, para } = (v ?? {}) as { de?: unknown; para?: unknown };
      const fmt = (x: unknown) => (x == null || x === '' ? '(vazio)' : typeof x === 'object' ? JSON.stringify(x) : String(x));
      return `${campo}: ${fmt(de)} → ${fmt(para)}`;
    })
    .join(' · ');
}

const ACOES = Object.entries(ROTULO_ACAO);
const RECURSOS = Object.entries(ROTULO_RECURSO);

export default function Auditoria() {
  const [recurso, setRecurso] = useState('');
  const [acao, setAcao] = useState('');
  const [pagina, setPagina] = useState(1);
  const qs = new URLSearchParams({ ...(recurso ? { recurso } : {}), ...(acao ? { acao } : {}), pagina: String(pagina) }).toString();
  const q = useQuery({
    queryKey: ['auditoria', qs],
    queryFn: () => api<{ total: number; pagina: number; porPagina: number; linhas: Registro[] }>(`/auditoria?${qs}`),
  });

  return (
    <div className="pilha">
      <Cabecalho titulo="Registro de atividades" sub="Quem fez o quê no admin: cadastros, alterações (inclusive de chave PIX), sorteios e logins." />
      <div className="filtros">
        <div className="campo">
          <label htmlFor="a-rec">Área</label>
          <select id="a-rec" className="input" value={recurso} onChange={(e) => (setRecurso(e.target.value), setPagina(1))}>
            <option value="">Todas</option>
            {RECURSOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="a-acao">Ação</label>
          <select id="a-acao" className="input" value={acao} onChange={(e) => (setAcao(e.target.value), setPagina(1))}>
            <option value="">Todas</option>
            {ACOES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="cartao">
        <Erro erro={q.error} />
        {q.isLoading ? <Carregando /> : (
          <div className="tabela-wrap">
            <table className="cartoes">
              <thead>
                <tr><th>Quando</th><th>Quem</th><th>Ação</th><th>O quê</th><th>Detalhes</th></tr>
              </thead>
              <tbody>
                {q.data?.linhas.length === 0 ? <tr><td colSpan={5} className="vazio">Nada registrado.</td></tr> : null}
                {q.data?.linhas.map((r) => (
                  <tr key={r.id}>
                    <td data-rotulo="Quando"><span className="celula">{dataHora(r.criadoEm)}</span></td>
                    <td data-titulo>{r.adminNome}</td>
                    <td data-rotulo="Ação">
                      <span className="celula">
                        <span className={`selo ${r.acao === 'login_falhou' || r.acao === 'excluir' ? 'erro' : r.acao === 'editar' ? 'aviso' : 'ok'}`}>
                          {ROTULO_ACAO[r.acao] ?? r.acao}
                        </span>
                      </span>
                    </td>
                    <td data-rotulo="O quê"><span className="celula">{ROTULO_RECURSO[r.recurso] ?? r.recurso}{r.resumo ? `: ${r.resumo}` : ''}</span></td>
                    <td data-rotulo="Detalhes">
                      <span className="celula" style={{ fontSize: 12, color: 'var(--texto-2)' }}>
                        {descreverDetalhes(r) || '—'}
                        {r.ip ? <div style={{ color: 'var(--texto-3)' }}>IP {r.ip}</div> : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {q.data ? (
          <div className="paginacao">
            <span>{numero(q.data.total)} registro(s) · página {q.data.pagina} de {Math.max(1, Math.ceil(q.data.total / q.data.porPagina))}</span>
            <div className="linha">
              <button className="btn sec peq" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
              <button className="btn sec peq" disabled={pagina * q.data.porPagina >= q.data.total} onClick={() => setPagina(pagina + 1)}>Próxima</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
