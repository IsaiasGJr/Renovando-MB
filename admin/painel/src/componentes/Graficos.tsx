import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { moeda, moedaCurta, numero } from '../api';

type Dia = { dia: string; valor: number; ofertas: number };

/** Preenche os dias sem ofertas com zero, para o eixo do tempo não "pular" datas. */
export function completarDias(dados: Dia[], de?: string, ate?: string): Dia[] {
  if (!dados.length && !de) return [];
  const inicio = new Date(`${de ?? dados[0].dia}T12:00:00`);
  const fim = new Date(`${ate ?? dados[dados.length - 1]?.dia ?? de}T12:00:00`);
  const mapa = new Map(dados.map((d) => [d.dia, d]));
  const out: Dia[] = [];
  for (let d = inicio; d <= fim && out.length < 400; d = new Date(d.getTime() + 86_400_000)) {
    const chave = d.toISOString().slice(0, 10);
    out.push(mapa.get(chave) ?? { dia: chave, valor: 0, ofertas: 0 });
  }
  return out;
}

const diaCurto = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

function Dica({ active, payload }: { active?: boolean; payload?: { payload: Dia }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="dica">
      <strong>{new Date(`${d.dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</strong>
      {moeda(d.valor)} · {numero(d.ofertas)} {d.ofertas === 1 ? 'oferta' : 'ofertas'}
    </div>
  );
}

/** Arrecadação por dia (uma série: dispensa legenda, o título do cartão nomeia). */
export function GraficoArrecadacao({ dados }: { dados: Dia[] }) {
  if (!dados.length) return <div className="vazio">Sem ofertas pagas no período.</div>;
  return (
    <div className="grafico" role="img" aria-label="Arrecadação por dia">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--grade)" />
          <XAxis dataKey="dia" tickFormatter={diaCurto} tick={{ fill: 'var(--texto-3)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--borda)' }} tickLine={false} minTickGap={24} />
          <YAxis tickFormatter={moedaCurta} tick={{ fill: 'var(--texto-3)', fontSize: 12 }}
            axisLine={false} tickLine={false} width={60} />
          <Tooltip content={<Dica />} cursor={{ fill: 'var(--primaria-clara)' }} />
          <Bar dataKey="valor" fill="var(--primaria)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras horizontais com rótulo e valor escritos (comparação entre poucas categorias). */
export function BarrasHorizontais({
  itens,
  formatar = moeda,
}: {
  itens: { rotulo: string; detalhe?: string; valor: number }[];
  formatar?: (v: number) => string;
}) {
  if (!itens.length) return <div className="vazio">Sem dados no período.</div>;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <div className="legenda-barras">
      {itens.map((i) => (
        <div key={i.rotulo} className="item" title={`${i.rotulo}: ${formatar(i.valor)}`}>
          <span>
            {i.rotulo}
            {i.detalhe ? <span style={{ color: 'var(--texto-3)' }}> · {i.detalhe}</span> : null}
          </span>
          <span className="valor">{formatar(i.valor)}</span>
          <div className="trilha"><div className="preenchido" style={{ width: `${(i.valor / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
