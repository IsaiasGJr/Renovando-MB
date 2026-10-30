import { router } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, compartilharCsv } from '@/api';
import { Chips, GradeKpi, Info, Kpi, Selo, Vazio } from '@/components/admin';
import { BarrasHorizontais, completarDias, GraficoDias } from '@/components/Graficos';
import { Aviso, Botao, Campo, Carregando, Cartao, s as ui } from '@/components/ui';
import { cores, espaco, raio } from '@/theme';
import { ROTULO_STATUS_OFERTA, useCampanhas, type Dashboard, type PorIgreja } from '@/tipos';
import { brParaIso, dataHora, isoDias, isoParaBr, mascaraData, moeda, numero } from '@/utils/format';

type Oferta = {
  id: string; criadaEm: string; status: string; quantidade: number; valor: number;
  igreja: string; cidade: string; ofertante: string; whatsapp: string;
};
type Relatorio = Pick<Dashboard, 'resumo' | 'porDia' | 'repasses'> & {
  porIgreja: PorIgreja[]; total: number; pagina: number; porPagina: number; ofertas: Oferta[];
};
type RepasseIgreja = { igreja: string; cidade: string; chavePix: string; arrecadado: number; repasse: number; ofertas: number };

const PERIODOS = [
  { valor: '7', rotulo: '7 dias' }, { valor: '30', rotulo: '30 dias' }, { valor: '90', rotulo: '90 dias' },
  { valor: 'tudo', rotulo: 'Tudo' }, { valor: 'outro', rotulo: 'Outro período' },
] as const;
type Periodo = (typeof PERIODOS)[number]['valor'];

export default function Relatorios() {
  const [aba, setAba] = useState<'ofertas' | 'igrejas'>('ofertas');
  const [periodo, setPeriodo] = useState<Periodo>('30');
  const [deTexto, setDeTexto] = useState(isoParaBr(isoDias(29), false));
  const [ateTexto, setAteTexto] = useState(isoParaBr(isoDias(0), false));
  const [campanhaId, setCampanhaId] = useState('');
  const [igrejaId, setIgrejaId] = useState('');
  const [status, setStatus] = useState('');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [erroCsv, setErroCsv] = useState('');
  const [gerandoCsv, setGerandoCsv] = useState(false);

  const campanhas = useCampanhas();
  const igrejas = useQuery({ queryKey: ['igrejas', ''], queryFn: () => api<{ id: string; nomeFantasia: string }[]>('/igrejas') });

  let de = '';
  let ate = '';
  if (periodo === 'outro') {
    de = brParaIso(deTexto, false);
    ate = brParaIso(ateTexto, false);
  } else if (periodo !== 'tudo') {
    de = isoDias(Number(periodo) - 1);
    ate = isoDias(0);
  }
  const filtros = { campanhaId, igrejaId, status: aba === 'ofertas' ? status : '', de, ate };
  const qs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString();

  const rel = useInfiniteQuery({
    queryKey: ['relatorio', qs],
    queryFn: ({ pageParam }) => api<Relatorio>(`/relatorios/ofertas?${qs}&pagina=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (ult) => (ult.pagina * ult.porPagina < ult.total ? ult.pagina + 1 : undefined),
    enabled: aba === 'ofertas',
  });
  const porIgreja = useQuery({
    queryKey: ['relatorio-igrejas', qs],
    queryFn: () => api<RepasseIgreja[]>(`/relatorios/igrejas?${qs}`),
    enabled: aba === 'igrejas',
  });

  const primeira = rel.data?.pages[0];
  const ofertas = rel.data?.pages.flatMap((p) => p.ofertas) ?? [];
  const qtdFiltros = [campanhaId, igrejaId, status].filter(Boolean).length;

  async function exportar() {
    setErroCsv('');
    setGerandoCsv(true);
    try {
      await compartilharCsv(`/relatorios/ofertas.csv?${qs}`, 'ofertas.csv');
    } catch (e) {
      setErroCsv((e as Error).message);
    } finally {
      setGerandoCsv(false);
    }
  }

  const cabecalho = (
    <View style={{ gap: espaco.md }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: cores.texto }}>Relatórios</Text>

      <View style={{ flexDirection: 'row', backgroundColor: '#EEE8EC', borderRadius: raio.md, padding: 3 }}>
        {([['ofertas', 'Ofertas'], ['igrejas', 'Repasses por igreja']] as const).map(([v, r]) => (
          <Pressable key={v} onPress={() => setAba(v)} style={{
            flex: 1, paddingVertical: 9, borderRadius: raio.sm, alignItems: 'center',
            backgroundColor: aba === v ? cores.superficie : 'transparent',
          }}>
            <Text style={{ fontWeight: '700', color: aba === v ? cores.primaria : cores.textoSuave }}>{r}</Text>
          </Pressable>
        ))}
      </View>

      <Chips opcoes={[...PERIODOS]} valor={periodo} onChange={setPeriodo} />
      {periodo === 'outro' ? (
        <View style={{ flexDirection: 'row', gap: espaco.sm }}>
          <View style={{ flex: 1 }}>
            <Campo rotulo="De" value={deTexto} keyboardType="number-pad" placeholder="dd/mm/aaaa" onChangeText={(t) => setDeTexto(mascaraData(t, false))} />
          </View>
          <View style={{ flex: 1 }}>
            <Campo rotulo="Até" value={ateTexto} keyboardType="number-pad" placeholder="dd/mm/aaaa" onChangeText={(t) => setAteTexto(mascaraData(t, false))} />
          </View>
        </View>
      ) : null}

      <Pressable onPress={() => setFiltrosAbertos(!filtrosAbertos)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: cores.primaria, fontWeight: '600' }}>
          {filtrosAbertos ? 'Esconder filtros' : 'Mais filtros'}{qtdFiltros ? ` (${qtdFiltros})` : ''}
        </Text>
        {qtdFiltros ? (
          <Pressable onPress={() => (setCampanhaId(''), setIgrejaId(''), setStatus(''))}>
            <Text style={{ color: cores.textoSuave }}>Limpar</Text>
          </Pressable>
        ) : null}
      </Pressable>
      {filtrosAbertos ? (
        <Cartao>
          <Text style={{ fontWeight: '600', color: cores.texto }}>Campanha</Text>
          <Chips opcoes={[{ valor: '', rotulo: 'Todas' }, ...(campanhas.data ?? []).map((c) => ({ valor: c.id, rotulo: c.edicao }))]}
            valor={campanhaId} onChange={setCampanhaId} />
          <Text style={{ fontWeight: '600', color: cores.texto, marginTop: espaco.sm }}>Igreja</Text>
          <Chips opcoes={[{ valor: '', rotulo: 'Todas' }, ...(igrejas.data ?? []).map((i) => ({ valor: i.id, rotulo: i.nomeFantasia }))]}
            valor={igrejaId} onChange={setIgrejaId} />
          {aba === 'ofertas' ? (
            <>
              <Text style={{ fontWeight: '600', color: cores.texto, marginTop: espaco.sm }}>Situação</Text>
              <Chips opcoes={[{ valor: '', rotulo: 'Todas' }, ...Object.entries(ROTULO_STATUS_OFERTA).map(([valor, rotulo]) => ({ valor, rotulo }))]}
                valor={status} onChange={setStatus} />
            </>
          ) : null}
        </Cartao>
      ) : null}

      {periodo === 'outro' && (!de || !ate) ? <Aviso>Digite as duas datas no formato dd/mm/aaaa.</Aviso> : null}
      {erroCsv ? <Aviso>{erroCsv}</Aviso> : null}
      <Botao titulo="Exportar planilha (CSV)" icone="share-outline" variante="contorno" carregando={gerandoCsv} onPress={exportar} />

      {aba === 'ofertas' && primeira ? (
        <>
          <GradeKpi>
            <Kpi rotulo="Arrecadado" valor={moeda(primeira.resumo.arrecadado)} />
            <Kpi rotulo="Ofertas pagas" valor={numero(primeira.resumo.ofertas)} />
            <Kpi rotulo="Cupons" valor={numero(primeira.resumo.cupons)} />
            <Kpi rotulo="Ticket médio" valor={moeda(primeira.resumo.ticketMedio)} />
          </GradeKpi>
          <Cartao>
            <Text style={{ fontSize: 17, fontWeight: '700', color: cores.texto }}>Arrecadação por dia</Text>
            <GraficoDias dados={completarDias(primeira.porDia, de || undefined, ate || undefined)} />
          </Cartao>
          <Cartao>
            <Text style={{ fontSize: 17, fontWeight: '700', color: cores.texto }}>Por igreja</Text>
            <BarrasHorizontais itens={primeira.porIgreja.map((i) => ({ rotulo: i.igreja, detalhe: `${i.cidade}/${i.uf}`, valor: i.valor }))} />
          </Cartao>
          <Cartao>
            <Text style={{ fontSize: 17, fontWeight: '700', color: cores.texto }}>Divisão (repasses)</Text>
            <BarrasHorizontais itens={primeira.repasses.map((r) => ({ rotulo: r.rotulo, valor: r.valor }))} />
          </Cartao>
          <Text style={{ fontSize: 17, fontWeight: '700', color: cores.texto }}>Ofertas ({numero(primeira.total)})</Text>
        </>
      ) : null}
      {aba === 'ofertas' && rel.isLoading ? <Carregando /> : null}
      {aba === 'ofertas' && rel.error ? <Aviso>{(rel.error as Error).message}</Aviso> : null}
      {aba === 'igrejas' && porIgreja.isLoading ? <Carregando /> : null}
      {aba === 'igrejas' && porIgreja.error ? <Aviso>{(porIgreja.error as Error).message}</Aviso> : null}
      {aba === 'igrejas' && porIgreja.data ? (
        <Text style={{ color: cores.textoSuave }}>Quanto cada igreja tem a receber no período (ofertas pagas).</Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={ui.tela} edges={['top']}>
      {aba === 'ofertas' ? (
        <FlatList
          data={ofertas}
          keyExtractor={(o) => o.id}
          contentContainerStyle={ui.conteudo}
          ListHeaderComponent={cabecalho}
          ListEmptyComponent={primeira ? <Vazio texto="Nenhuma oferta com esses filtros." /> : undefined}
          onEndReached={() => rel.hasNextPage && !rel.isFetchingNextPage && rel.fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={rel.isFetchingNextPage ? <ActivityIndicator color={cores.primaria} /> : undefined}
          renderItem={({ item: o }) => (
            <Pressable onPress={() => router.push({ pathname: '/oferta', params: { id: o.id } })} accessibilityRole="button" accessibilityHint="Ver cupons e divisão">
            <Cartao style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espaco.sm }}>
                <Text style={{ fontWeight: '700', color: cores.texto, fontSize: 15, flexShrink: 1 }}>{o.ofertante}</Text>
                <Text style={{ fontWeight: '800', color: cores.texto, fontSize: 15 }}>{moeda(o.valor)}</Text>
              </View>
              <Info rotulo="Igreja">{`${o.igreja} · ${o.cidade}`}</Info>
              <Info rotulo="Data">{dataHora(o.criadaEm)}</Info>
              {o.whatsapp ? <Info rotulo="WhatsApp">{o.whatsapp}</Info> : null}
              <Info rotulo="Cupons">{String(o.quantidade)}</Info>
              <Info rotulo="Situação"><Selo status={o.status} /></Info>
            </Cartao>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={porIgreja.data ?? []}
          keyExtractor={(l) => l.igreja + l.cidade}
          contentContainerStyle={ui.conteudo}
          ListHeaderComponent={cabecalho}
          ListEmptyComponent={porIgreja.data ? <Vazio texto="Sem ofertas pagas no período." /> : undefined}
          renderItem={({ item: l }) => (
            <Cartao style={{ gap: 6 }}>
              <Text style={{ fontWeight: '700', color: cores.texto, fontSize: 15 }}>{l.igreja}</Text>
              <Info rotulo="Cidade">{l.cidade}</Info>
              <Info rotulo="Chave PIX">{l.chavePix || '—'}</Info>
              <Info rotulo="Ofertas">{numero(l.ofertas)}</Info>
              <Info rotulo="Arrecadado">{moeda(l.arrecadado)}</Info>
              <Info rotulo="Repasse à igreja">
                <Text style={{ fontWeight: '800', color: cores.primaria, fontSize: 16 }}>{moeda(l.repasse)}</Text>
              </Info>
            </Cartao>
          )}
        />
      )}
    </SafeAreaView>
  );
}
