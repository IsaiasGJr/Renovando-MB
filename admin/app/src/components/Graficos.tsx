import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { cores, espaco, raio } from '@/theme';
import { moeda, moedaCurta, numero } from '@/utils/format';

export type Dia = { dia: string; valor: number; ofertas: number };

/** Preenche dias sem ofertas com zero, para o eixo do tempo não pular datas. */
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

const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Escala "redonda" para o eixo Y (ex.: 0, 150, 300, 450, 600). */
function escala(max: number) {
  if (max <= 0) return { topo: 100, passo: 25 };
  const bruto = max / 4;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) ?? 10 * mag;
  return { topo: passo * 4, passo };
}

/** Barras de arrecadação por dia. Toque numa barra para ver o valor. */
export function GraficoDias({ dados }: { dados: Dia[] }) {
  const { width } = useWindowDimensions();
  const [sel, setSel] = useState<number | null>(null);
  if (!dados.length) return <Text style={{ color: cores.textoSuave, paddingVertical: espaco.lg }}>Sem ofertas pagas no período.</Text>;

  const larg = Math.min(width, 900) - espaco.lg * 4;
  const alt = 190;
  const eixoY = 48;
  const base = alt - 22;
  const area = larg - eixoY;
  const { topo, passo } = escala(Math.max(...dados.map((d) => d.valor)));
  const fatia = area / dados.length;
  const barra = Math.max(2, Math.min(24, fatia - 2));
  const y = (v: number) => base - (v / topo) * (base - 8);
  const marcas = [0, 1, 2, 3, 4].map((i) => i * passo);
  const cadaRotulo = Math.max(1, Math.ceil(dados.length / 5));
  const atual = sel != null ? dados[sel] : null;

  return (
    <View style={{ gap: espaco.sm }}>
      <View style={{ minHeight: 40, justifyContent: 'center' }}>
        {atual ? (
          <Text style={{ color: cores.texto }}>
            <Text style={{ fontWeight: '700' }}>
              {new Date(`${atual.dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
            </Text>
            {`  ${moeda(atual.valor)} · ${numero(atual.ofertas)} ${atual.ofertas === 1 ? 'oferta' : 'ofertas'}`}
          </Text>
        ) : (
          <Text style={{ color: cores.textoSuave, fontSize: 13 }}>Toque numa barra para ver o valor do dia.</Text>
        )}
      </View>
      <View style={{ width: larg, height: alt }}>
      <Svg width={larg} height={alt} accessibilityLabel="Gráfico de arrecadação por dia">
        {marcas.map((m) => (
          <Line key={m} x1={eixoY} x2={larg} y1={y(m)} y2={y(m)} stroke={m === 0 ? cores.borda : '#EEE8EC'} strokeWidth={1} />
        ))}
        {marcas.map((m) => (
          <SvgText key={`t${m}`} x={eixoY - 6} y={y(m) + 4} fontSize={10} fill={cores.textoSuave} textAnchor="end">{moedaCurta(m)}</SvgText>
        ))}
        {dados.map((d, i) => {
          const x = eixoY + i * fatia + (fatia - barra) / 2;
          const h = base - y(d.valor);
          const r = Math.min(4, barra / 2, h);
          // Barra com cantos de cima arredondados, presa na base.
          const caminho = h <= 0 ? '' :
            `M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + barra - r} Q${x + barra},${base - h} ${x + barra},${base - h + r} V${base} Z`;
          return (
            <Path key={d.dia} d={caminho} fill={sel === i ? cores.destaque : cores.primaria} />
          );
        })}
        {dados.map((d, i) => (i % cadaRotulo === 0 ? (
          <SvgText key={`x${d.dia}`} x={eixoY + i * fatia + fatia / 2} y={alt - 6} fontSize={10} fill={cores.textoSuave} textAnchor="middle">
            {diaCurto(d.dia)}
          </SvgText>
        ) : null))}
      </Svg>
      {/* Camada de toque: uma área por dia, maior que a barra */}
      <View style={{ position: 'absolute', left: eixoY, top: 0, width: area, height: base, flexDirection: 'row' }}>
        {dados.map((d, i) => (
          <Pressable key={d.dia} style={{ flex: 1 }} onPress={() => setSel(sel === i ? null : i)}
            accessibilityLabel={`${diaCurto(d.dia)}: ${moeda(d.valor)}`} />
        ))}
      </View>
      </View>
    </View>
  );
}

/** Barras horizontais com rótulo e valor escritos. */
export function BarrasHorizontais({ itens, formatar = moeda }: {
  itens: { rotulo: string; detalhe?: string; valor: number }[]; formatar?: (v: number) => string;
}) {
  if (!itens.length) return <Text style={{ color: cores.textoSuave }}>Sem dados no período.</Text>;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <View style={{ gap: espaco.md }}>
      {itens.map((i) => (
        <View key={i.rotulo} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espaco.sm }}>
            <Text style={{ color: cores.texto, flexShrink: 1 }} numberOfLines={1}>
              {i.rotulo}
              {i.detalhe ? <Text style={{ color: cores.textoSuave }}> · {i.detalhe}</Text> : null}
            </Text>
            <Text style={{ color: cores.texto, fontWeight: '700' }}>{formatar(i.valor)}</Text>
          </View>
          <View style={{ height: 8, backgroundColor: '#EEE8EC', borderRadius: raio.sm, overflow: 'hidden' }}>
            <View style={{ width: `${(i.valor / max) * 100}%`, height: '100%', backgroundColor: cores.primaria, borderRadius: 4 }} />
          </View>
        </View>
      ))}
    </View>
  );
}
