import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, data, moeda } from '../api';
import { CrudPagina } from '../componentes/CrudPagina';
import { Erro, Modal } from '../componentes/ui';
import { useCampanhas } from './Campanhas';

type Premio = {
  id: string; campanhaId: string; nome: string; imagemUrl: string; valorEstimado: number; principal: boolean;
  dataSorteio: string; ganhadorNumero: string | null; ganhadorNome: string | null; ganhadorCidade: string | null;
};

export default function Premios() {
  const campanhas = useCampanhas();
  const [escolhida, setCampanhaId] = useState('');
  const [sorteando, setSorteando] = useState<{ premio: Premio; recarregar: () => void } | null>(null);
  // Sem escolha do usuário, mostra a campanha ativa (ou a mais recente).
  const campanhaId = escolhida || (campanhas.data?.find((c) => c.ativa) ?? campanhas.data?.[0])?.id || '';

  const resumo = useQuery({
    queryKey: ['sorteios-resumo', campanhaId],
    queryFn: () => api<{ total: number; pendentes: number; distribuidos: number; valorTotal: number; valorDistribuido: number; proximo: string | null }>('/sorteios/resumo'),
  });
  const desfazer = useMutation({ mutationFn: (id: string) => api(`/premios/${id}/desfazer-sorteio`, { method: 'POST' }) });

  if (!campanhaId) return null;

  return (
    <>
      <CrudPagina<Premio>
        key={campanhaId}
        recurso="premios"
        titulo="Prêmios e sorteios"
        sub="Os prêmios da campanha ativa aparecem no app, com data e ganhador."
        rotuloItem="prêmio"
        parametros={{ campanhaId }}
        ajustar={(p) => ({ ...p, campanhaId })}
        topo={
          <>
          {resumo.data ? (
            <div className="grade grade-kpi">
              <div className="cartao kpi"><div className="rotulo">Sorteios</div><div className="valor">{resumo.data.total}</div><div className="detalhe">{moeda(resumo.data.valorTotal)} em prêmios</div></div>
              <div className="cartao kpi"><div className="rotulo">Pendentes</div><div className="valor">{resumo.data.pendentes}</div><div className="detalhe">{resumo.data.proximo ? `próximo em ${data(resumo.data.proximo)}` : 'nenhum'}</div></div>
              <div className="cartao kpi"><div className="rotulo">Distribuídos</div><div className="valor">{resumo.data.distribuidos}</div><div className="detalhe">{moeda(resumo.data.valorDistribuido)}</div></div>
            </div>
          ) : null}
          <div className="filtros">
            <div className="campo">
              <label htmlFor="p-camp">Campanha</label>
              <select id="p-camp" className="input" value={campanhaId} onChange={(e) => setCampanhaId(e.target.value)}>
                {campanhas.data?.map((c) => <option key={c.id} value={c.id}>{c.edicao}{c.ativa ? ' (ativa)' : ''}</option>)}
              </select>
            </div>
          </div>
          </>
        }
        campos={[
          { nome: 'nome', rotulo: 'Nome do prêmio', obrigatorio: true },
          { nome: 'dataSorteio', rotulo: 'Data e hora do sorteio', tipo: 'datahora', obrigatorio: true },
          { nome: 'valorEstimado', rotulo: 'Valor estimado (R$)', tipo: 'numero', padrao: 0 },
          { nome: 'ordem', rotulo: 'Ordem de exibição', tipo: 'numero', padrao: 0 },
          { nome: 'principal', rotulo: 'Prêmio principal (destaque no app)', tipo: 'checkbox' },
          { nome: 'imagemUrl', rotulo: 'Imagem', tipo: 'imagem' },
          { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea' },
        ]}
        colunas={[
          { titulo: '', render: (p) => (p.imagemUrl ? <img className="miniatura" src={p.imagemUrl} alt="" /> : null) },
          { titulo: 'Prêmio', render: (p) => <>{p.nome} {p.principal ? <span className="selo aviso">Principal</span> : null}</> },
          { titulo: 'Sorteio', render: (p) => data(p.dataSorteio) },
          { titulo: 'Valor', num: true, render: (p) => moeda(p.valorEstimado) },
          {
            titulo: 'Ganhador',
            render: (p) => (p.ganhadorNumero
              ? <span className="selo ok">Nº {p.ganhadorNumero} · {p.ganhadorNome} · {p.ganhadorCidade}</span>
              : <span className="selo">A sortear</span>),
          },
        ]}
        acoes={(p, recarregar) =>
          p.ganhadorNumero ? (
            <button className="btn sec peq"
              onClick={() => confirm('Desfazer o resultado deste sorteio?') && desfazer.mutate(p.id, { onSuccess: recarregar })}>
              Desfazer sorteio
            </button>
          ) : (
            <button className="btn peq" onClick={() => setSorteando({ premio: p, recarregar })}>Sortear</button>
          )
        }
      />
      {sorteando ? <ModalSorteio {...sorteando} onFechar={() => setSorteando(null)} /> : null}
    </>
  );
}

function ModalSorteio({ premio, recarregar, onFechar }: { premio: Premio; recarregar: () => void; onFechar: () => void }) {
  const [numero, setNumero] = useState('');
  const sortear = useMutation({
    mutationFn: (n?: string) => api<Premio>(`/premios/${premio.id}/sortear`, { method: 'POST', json: n ? { numero: n } : {} }),
    onSuccess: recarregar,
  });
  const r = sortear.data;

  return (
    <Modal titulo={`Sortear: ${premio.nome}`} onFechar={onFechar}
      rodape={<button className="btn sec" onClick={onFechar}>{r ? 'Concluir' : 'Cancelar'}</button>}>
      {r ? (
        <div className="pilha" style={{ alignItems: 'center', textAlign: 'center', padding: 16 }}>
          <div style={{ color: 'var(--texto-2)' }}>Número sorteado</div>
          <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--primaria)', letterSpacing: 4 }}>{r.ganhadorNumero}</div>
          <div style={{ fontSize: 18 }}>{r.ganhadorNome} · {r.ganhadorCidade}</div>
          <div className="alerta info">Entre em contato com o ganhador pelo WhatsApp cadastrado (veja em Relatórios ou Ofertantes).</div>
        </div>
      ) : (
        <div className="pilha">
          <Erro erro={sortear.error} />
          <div className="cartao" style={{ boxShadow: 'none' }}>
            <h2>Informar o número sorteado</h2>
            <p style={{ color: 'var(--texto-2)', marginTop: 0 }}>
              Use quando o resultado vem de uma fonte externa auditável (ex.: extração da Loteria Federal, como costuma exigir o regulamento).
            </p>
            <div className="linha">
              <input className="input" style={{ width: 160 }} placeholder="000000" inputMode="numeric" maxLength={6}
                value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))} aria-label="Número sorteado" />
              <button className="btn" disabled={!numero || sortear.isPending} onClick={() => sortear.mutate(numero)}>Confirmar número</button>
            </div>
          </div>
          <div className="cartao" style={{ boxShadow: 'none' }}>
            <h2>Sorteio pelo sistema</h2>
            <p style={{ color: 'var(--texto-2)', marginTop: 0 }}>Escolhe aleatoriamente um cupom pago desta campanha que ainda não ganhou.</p>
            <button className="btn sec" disabled={sortear.isPending}
              onClick={() => confirm('Realizar o sorteio agora? O resultado aparece no app imediatamente.') && sortear.mutate(undefined)}>
              Sortear aleatoriamente
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
