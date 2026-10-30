import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GradeKpi, Kpi, Selo } from '@/components/admin';
import { Marca } from '@/components/Marca';
import { BarrasHorizontais, completarDias, GraficoDias } from '@/components/Graficos';
import { Aviso, Botao, Carregando, Cartao, s as ui } from '@/components/ui';
import { useSessao } from '@/store/sessao';
import { cores, espaco, gradienteMarca, raio, sombra } from '@/theme';
import { ROTULO_STATUS_OFERTA, useDashboard } from '@/tipos';
import { data, decimal, isoDias, moeda, numero } from '@/utils/format';

function Titulo({ children }: { children: string }) {
  return <Text style={{ fontSize: 17, fontWeight: '700', color: cores.texto, marginBottom: 4 }}>{children}</Text>;
}

export default function Inicio() {
  const nome = useSessao((s) => s.admin?.nome);
  const q = useDashboard();
  const d = q.data;

  return (
    <SafeAreaView style={ui.tela} edges={['top']}>
      <ScrollView contentContainerStyle={ui.conteudo}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={cores.primaria} />}>
        <LinearGradient colors={[...gradienteMarca]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[{ borderRadius: raio.xl, padding: espaco.xl, gap: espaco.md, overflow: 'hidden' }, sombra(2)]}>
          <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -50 }} />
          <Marca subtitulo="Administração" claro />
          <View>
            <Text style={{ color: '#EBD5E2' }}>Olá, {nome?.split(' ')[0]}</Text>
            <Text style={{ fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.4 }}>Visão geral</Text>
          </View>
        </LinearGradient>

        {q.isLoading ? <Carregando /> : null}
        {q.error ? (
          <>
            <Aviso>{(q.error as Error).message}</Aviso>
            <Botao titulo="Tentar de novo" variante="contorno" onPress={() => q.refetch()} />
          </>
        ) : null}

        {d ? (
          <>
            {d.pendencias.igrejas + d.pendencias.semeadores + d.pendencias.shows > 0 ? (
              <Cartao style={{ backgroundColor: cores.avisoClaro, borderColor: cores.avisoClaro }}>
                <Text style={{ color: cores.aviso, fontWeight: '700' }}>Aguardando sua análise</Text>
                {([
                  [d.pendencias.igrejas, 'igreja(s) para aprovar', '/igrejas'],
                  [d.pendencias.semeadores, 'semeador(es) para aprovar', '/semeadores'],
                  [d.pendencias.shows, 'pedido(s) de show novos', '/solicitacoes-show'],
                ] as const).filter(([n]) => n > 0).map(([n, texto, rota]) => (
                  <Pressable key={rota} onPress={() => router.push({ pathname: '/[recurso]', params: { recurso: rota.slice(1), status: rota === '/solicitacoes-show' ? 'nova' : 'pendente' } })}>
                    <Text style={{ color: cores.aviso, textDecorationLine: 'underline', fontSize: 15 }}>{n} {texto}</Text>
                  </Pressable>
                ))}
              </Cartao>
            ) : null}

            <GradeKpi>
              <Kpi destaque icone="wallet" rotulo="Arrecadado" valor={moeda(d.resumo.arrecadado)} detalhe={`${numero(d.resumo.ofertas)} ofertas pagas`} />
              <Kpi icone="ticket" rotulo="Cupons" valor={numero(d.resumo.cupons)} detalhe={`${numero(d.resumo.ofertantes)} ofertantes`} />
              <Kpi icone="receipt" rotulo="Ticket médio" valor={moeda(d.resumo.ticketMedio)} detalhe="por oferta paga" />
              <Kpi icone="trending-up" rotulo="Conversão do PIX" valor={`${decimal(d.resumo.conversao, 1)}%`} detalhe="PIX gerados que foram pagos" />
              <Kpi icone="business" rotulo="Igrejas ativas" valor={numero(d.igrejasAtivas)} />
            </GradeKpi>
            {d.meta > 0 ? (
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '700', color: cores.texto }}>Meta da campanha</Text>
                  <Text style={{ color: cores.textoSuave }}>{decimal(Math.min(100, (d.resumo.arrecadado / d.meta) * 100), 1)}% de {moeda(d.meta)}</Text>
                </View>
                <View style={{ height: 10, borderRadius: 999, backgroundColor: cores.primariaClara, overflow: 'hidden' }}
                  accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: d.meta, now: d.resumo.arrecadado }}>
                  <View style={{ width: `${Math.min(100, (d.resumo.arrecadado / d.meta) * 100)}%`, height: '100%', backgroundColor: cores.primaria }} />
                </View>
              </View>
            ) : null}

            <Cartao>
              <Titulo>Arrecadação · últimos 30 dias</Titulo>
              <GraficoDias dados={completarDias(d.porDia, isoDias(29), isoDias(0))} />
            </Cartao>

            <Cartao>
              <Titulo>Igrejas que mais arrecadaram</Titulo>
              <BarrasHorizontais itens={d.topIgrejas.map((i) => ({ rotulo: i.igreja, detalhe: `${i.cidade}/${i.uf}`, valor: i.valor }))} />
            </Cartao>

            <Cartao>
              <Titulo>Divisão do arrecadado</Titulo>
              <BarrasHorizontais itens={d.repasses.map((r) => ({ rotulo: r.rotulo, valor: r.valor }))} />
            </Cartao>

            <Cartao>
              <Titulo>Ofertas por situação</Titulo>
              <BarrasHorizontais formatar={numero}
                itens={d.porStatus.map((s) => ({ rotulo: ROTULO_STATUS_OFERTA[s.status] ?? s.status, valor: s.total }))} />
            </Cartao>

            <Cartao>
              <Titulo>Sorteios</Titulo>
              {d.proximosSorteios.map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.sm, paddingVertical: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: cores.texto, fontWeight: '600' }}>{p.nome}</Text>
                    <Text style={{ color: cores.textoSuave, fontSize: 13 }}>{data(p.dataSorteio)}</Text>
                  </View>
                  {p.ganhadorNumero ? <Selo status="ativa" texto={`Nº ${p.ganhadorNumero}`} /> : <Selo status="" texto="A sortear" />}
                </View>
              ))}
              <Botao titulo="Ver prêmios e sortear" variante="secundario"
                onPress={() => router.push({ pathname: '/[recurso]', params: { recurso: 'premios' } })} />
            </Cartao>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
