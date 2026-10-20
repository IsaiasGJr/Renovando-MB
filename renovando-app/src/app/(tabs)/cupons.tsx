import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, baixarCupom } from '@/api';
import { Botao, Carregando, Tela, Titulo, s as ui } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { cores, espaco, raio, sombra } from '@/theme';
import type { Cupom } from '@/types';

const MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const dois = (n: number) => String(n).padStart(2, '0');
/** Emissão como no site: "14 de out. de 2026, 10:28". */
const emissao = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}, ${dois(d.getHours())}:${dois(d.getMinutes())}`;
};
const diaMes = (iso: string) => {
  const d = new Date(iso);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export default function Cupons() {
  const token = useAuth((a) => a.token);
  const q = useQuery({ queryKey: ['cupons', token], queryFn: () => api.meusCupons(), enabled: !!token });
  const [oferta, setOferta] = useState('todas');
  const [baixando, setBaixando] = useState<Set<string>>(new Set());

  const cupons = useMemo(() => q.data ?? [], [q.data]);
  // Ofertas que geraram cupons (para o filtro), da mais nova para a mais antiga.
  const ofertas = useMemo(() => {
    const mapa = new Map<string, { id: string; data: string; qtd: number }>();
    for (const c of cupons) {
      const o = mapa.get(c.ofertaId) ?? { id: c.ofertaId, data: c.criadoEm, qtd: 0 };
      o.qtd++;
      mapa.set(c.ofertaId, o);
    }
    return [...mapa.values()];
  }, [cupons]);
  const lista = useMemo(() => (oferta === 'todas' ? cupons : cupons.filter((c) => c.ofertaId === oferta)), [cupons, oferta]);
  const premiados = cupons.filter((c) => c.premio).length;
  const media = ofertas.length ? Math.round((cupons.length / ofertas.length) * 10) / 10 : 0;

  const baixar = useCallback(async (c: Cupom) => {
    setBaixando((b) => new Set(b).add(c.id));
    try {
      await baixarCupom(c.id, c.numero);
    } catch (e) {
      const msg = (e as Error).message;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Cupom', msg);
    } finally {
      setBaixando((b) => {
        const n = new Set(b);
        n.delete(c.id);
        return n;
      });
    }
  }, []);

  if (!token) {
    return (
      <Tela>
        <Titulo sub="Entre com seu WhatsApp para ver seus números da sorte.">Meus cupons</Titulo>
        <Botao titulo="Entrar" onPress={() => router.push({ pathname: '/login', params: { voltar: '/cupons' } })} />
      </Tela>
    );
  }

  return (
    <SafeAreaView style={ui.tela} edges={['top']}>
      {/* Lista virtualizada: só desenha os cupons visíveis (uma oferta pode gerar centenas). */}
      <FlatList
        data={lista}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <CartaoCupom cupom={item} baixando={baixando.has(item.id)} onBaixar={baixar} />}
        contentContainerStyle={ui.conteudo}
        ItemSeparatorComponent={Espaco}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={cores.primaria} />}
        ListHeaderComponent={
          <View style={{ gap: espaco.lg }}>
            <Titulo sub="Cada cupom conta uma boa história.">Meus cupons</Titulo>
            {q.isLoading ? <Carregando /> : null}
            {cupons.length ? (
              <>
                {/* Resumo, como no site */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -espaco.lg }}
                  contentContainerStyle={{ gap: espaco.md, paddingHorizontal: espaco.lg, paddingVertical: 2 }}>
                  <Resumo icone="ticket" rotulo="Total de cupons" valor={String(cupons.length)}
                    texto="Cupons recebidos nas suas ofertas." />
                  <Resumo icone="trophy" rotulo="Cupons premiados" valor={String(premiados)}
                    texto="Premiações registradas nos seus cupons." />
                  <Resumo icone="time" rotulo="Último cupom" valor={`#${cupons[0].numero}`}
                    texto={`${ofertas.length} ${ofertas.length === 1 ? 'oferta com cupons' : 'ofertas com cupons'} · média de ${media} por oferta.`} />
                </ScrollView>

                {/* Filtrar por oferta */}
                {ofertas.length > 1 ? (
                  <View style={{ gap: espaco.sm }}>
                    <Text style={est.rotulo}>Filtrar por oferta</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -espaco.lg }}
                      contentContainerStyle={{ gap: espaco.sm, paddingHorizontal: espaco.lg }}>
                      <Filtro ativo={oferta === 'todas'} texto="Todas as ofertas" onPress={() => setOferta('todas')} />
                      {ofertas.map((o) => (
                        <Filtro key={o.id} ativo={oferta === o.id} onPress={() => setOferta(o.id)}
                          texto={`Oferta de ${diaMes(o.data)} · ${o.qtd} ${o.qtd === 1 ? 'cupom' : 'cupons'}`} />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          q.data ? (
            <View style={[est.vazio, sombra(1)]}>
              <Ionicons name="ticket-outline" size={44} color={cores.primariaSuave} />
              <Text style={{ fontSize: 17, fontWeight: '800', color: cores.texto }}>Seus próximos cupons estarão aqui</Text>
              <Text style={{ color: cores.textoSuave, textAlign: 'center' }}>
                Participe das campanhas com uma oferta e acompanhe os cupons gerados para você.
              </Text>
              <Botao titulo="Fazer uma oferta" onPress={() => router.navigate('/')} />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const Espaco = () => <View style={{ height: espaco.md }} />;

function Resumo({ icone, rotulo, valor, texto }: { icone: 'ticket' | 'trophy' | 'time'; rotulo: string; valor: string; texto: string }) {
  return (
    <View style={[est.resumo, sombra(1)]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icone} size={16} color={cores.primaria} />
        <Text style={est.rotulo}>{rotulo}</Text>
      </View>
      <Text style={{ fontSize: 26, fontWeight: '900', color: cores.primariaEscura }}>{valor}</Text>
      <Text style={{ fontSize: 12, color: cores.textoSuave }}>{texto}</Text>
    </View>
  );
}

function Filtro({ ativo, texto, onPress }: { ativo: boolean; texto: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: ativo }}
      style={[est.filtro, ativo && { backgroundColor: cores.primaria, borderColor: cores.primaria }]}>
      <Text style={{ fontWeight: '700', fontSize: 13, color: ativo ? '#fff' : cores.texto }}>{texto}</Text>
    </Pressable>
  );
}

/** Cartão do cupom com as mesmas informações do site: campanha, igreja, emissão, número e situação. */
const CartaoCupom = memo(function CartaoCupom({ cupom: c, baixando, onBaixar }: { cupom: Cupom; baixando: boolean; onBaixar: (c: Cupom) => void }) {
  const ativo = c.status === 'ativo';
  return (
    <View style={[est.cartao, sombra(1)]}>
      <View style={est.faixa} />
      <View style={{ padding: espaco.lg, gap: espaco.md }}>
        <View>
          <Text style={est.rotulo}>Campanha</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: cores.texto }}>{c.campanha}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: espaco.lg }}>
          <View style={{ flex: 1 }}>
            <Text style={est.rotulo}>Igreja</Text>
            <Text style={est.valor} numberOfLines={2}>{c.igrejaNome}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={est.rotulo}>Emissão</Text>
            <Text style={est.valor}>{emissao(c.criadoEm)}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco.sm }}>
          <Text style={est.numero}>#{c.numero}</Text>
          <View style={[est.selo, { backgroundColor: ativo ? cores.primariaClara : '#F1F5F9' }]}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: ativo ? cores.primaria : '#475569' }}>{ativo ? 'Ativo' : 'Expirado'}</Text>
          </View>
          {c.premio ? (
            <View style={[est.selo, { backgroundColor: cores.destaqueClaro, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
              <Ionicons name="trophy" size={12} color={cores.destaqueEscuro} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: cores.destaqueEscuro }}>Premiado</Text>
            </View>
          ) : null}
        </View>
        {c.premio ? <Text style={{ color: cores.destaqueEscuro, fontWeight: '700' }}>Prêmio: {c.premio}</Text> : null}
      </View>
      <View style={est.rodape}>
        <Botao titulo={baixando ? 'Baixando...' : 'Baixar cupom'} icone="download-outline" variante="contorno"
          carregando={baixando} onPress={() => onBaixar(c)} />
      </View>
    </View>
  );
});

const est = StyleSheet.create({
  rotulo: { fontSize: 11, fontWeight: '800', color: cores.textoSuave, textTransform: 'uppercase', letterSpacing: 0.8 },
  valor: { fontSize: 14, fontWeight: '600', color: cores.texto, marginTop: 2 },
  numero: { fontSize: 24, fontWeight: '900', color: cores.primariaEscura, letterSpacing: 1 },
  selo: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: raio.pill },
  cartao: { backgroundColor: cores.superficie, borderRadius: raio.lg, overflow: 'hidden' },
  faixa: { height: 6, backgroundColor: cores.primaria },
  rodape: { borderTopWidth: 1, borderTopColor: cores.borda, padding: espaco.md },
  resumo: { width: 210, backgroundColor: cores.superficie, borderRadius: raio.lg, padding: espaco.lg, gap: 4 },
  filtro: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: raio.pill, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.superficie },
  vazio: { alignItems: 'center', gap: espaco.md, padding: espaco.xl, backgroundColor: cores.superficie, borderRadius: raio.lg },
});
