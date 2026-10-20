import { Link } from 'react-router-dom';
import { data, moeda, numero } from '../api';
import { ROTULO_STATUS_OFERTA, useDashboard } from '../consultas';
import { Building2, Percent, Receipt, Ticket, Wallet } from '../componentes/icones';
import { BarrasHorizontais, completarDias, GraficoArrecadacao } from '../componentes/Graficos';
import { Cabecalho, Carregando, Erro } from '../componentes/ui';

export default function Dashboard() {
  const { data: d, error, isLoading } = useDashboard();
  if (isLoading) return <Carregando />;
  if (!d) return <Erro erro={error} />;

  const hoje = new Date().toISOString().slice(0, 10);
  const inicio = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  const pend = d.pendencias;

  return (
    <div className="pilha">
      <Cabecalho titulo="Visão geral" sub="Campanha ativa · ofertas pagas">
        <Link className="btn sec" to="/relatorios">Ver relatórios</Link>
      </Cabecalho>

      {pend.igrejas + pend.semeadores + pend.shows + (pend.mensagens ?? 0) > 0 ? (
        <div className="alerta info linha">
          <strong>Aguardando sua análise:</strong>
          {pend.igrejas ? <Link to="/igrejas?status=pendente">{pend.igrejas} igreja(s)</Link> : null}
          {pend.semeadores ? <Link to="/semeadores">{pend.semeadores} semeador(es)</Link> : null}
          {pend.shows ? <Link to="/shows">{pend.shows} pedido(s) de show</Link> : null}
          {pend.mensagens ? <Link to="/mensagens">{pend.mensagens} mensagem(ns) nova(s)</Link> : null}
        </div>
      ) : null}

      <div className="grade grade-kpi">
        <Kpi destaque icone={Wallet} rotulo="Arrecadado" valor={moeda(d.resumo.arrecadado)} detalhe={`${numero(d.resumo.ofertas)} ofertas pagas`} />
        <Kpi icone={Ticket} rotulo="Cupons emitidos" valor={numero(d.resumo.cupons)} detalhe={`${numero(d.resumo.ofertantes)} ofertantes`} />
        <Kpi icone={Receipt} rotulo="Ticket médio" valor={moeda(d.resumo.ticketMedio)} detalhe="por oferta paga" />
        <Kpi icone={Percent} rotulo="Conversão do PIX" valor={`${d.resumo.conversao.toLocaleString('pt-BR')}%`} detalhe="ofertas geradas que foram pagas" />
        <Kpi icone={Building2} rotulo="Igrejas ativas" valor={numero(d.igrejasAtivas)} detalhe={pend.igrejas ? `${pend.igrejas} pendente(s)` : 'nenhuma pendente'} />
      </div>

      <div className="cartao">
        <h2>Arrecadação por dia · últimos 30 dias</h2>
        <GraficoArrecadacao dados={completarDias(d.porDia, inicio, hoje)} />
      </div>

      <div className="grade grade-2">
        <div className="cartao">
          <h2>Igrejas que mais arrecadaram</h2>
          <BarrasHorizontais itens={d.topIgrejas.map((i) => ({ rotulo: i.igreja, detalhe: `${i.cidade}/${i.uf}`, valor: i.valor }))} />
        </div>
        <div className="cartao">
          <h2>Divisão do arrecadado</h2>
          <BarrasHorizontais itens={d.repasses.map((r) => ({ rotulo: r.rotulo, valor: r.valor }))} />
        </div>
        <div className="cartao">
          <h2>Ofertas por situação</h2>
          <BarrasHorizontais formatar={numero}
            itens={d.porStatus.map((s) => ({ rotulo: ROTULO_STATUS_OFERTA[s.status] ?? s.status, valor: s.total }))} />
        </div>
        <div className="cartao">
          <h2>Sorteios</h2>
          <table>
            <tbody>
              {d.proximosSorteios.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>{data(p.dataSorteio)}</td>
                  <td className="num">
                    {p.ganhadorNumero ? <span className="selo ok">Nº {p.ganhadorNumero}</span> : <span className="selo">A sortear</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ rotulo, valor, detalhe, icone: Icone, destaque }: {
  rotulo: string; valor: string; detalhe?: string; icone: typeof Wallet; destaque?: boolean;
}) {
  return (
    <div className={`cartao kpi${destaque ? ' kpi-destaque' : ''}`}>
      <div className="kpi-topo">
        <div className="rotulo">{rotulo}</div>
        <span className="kpi-icone" aria-hidden="true"><Icone size={18} /></span>
      </div>
      <div className="valor">{valor}</div>
      {detalhe ? <div className="detalhe">{detalhe}</div> : null}
    </div>
  );
}
