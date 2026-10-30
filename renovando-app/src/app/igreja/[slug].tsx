import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, Share, Text, View } from 'react-native';
import { api, BASE_URL } from '@/api';
import { LogoIgreja } from '@/components/Igrejas';
import { Aviso, Botao, Carregando, Cartao, Contador, Tela } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { useRascunhoOferta } from '@/store/oferta';
import { cores, espaco, gradienteMarca, gradienteOuro, raio, sombra } from '@/theme';
import { data, moeda } from '@/utils/format';

/**
 * Página da igreja na campanha: a igreja divulga este link (renovando://igreja/<slug>)
 * e a comunidade oferta direto para ela, sem precisar procurar na lista.
 */
export default function PaginaIgreja() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const token = useAuth((a) => a.token);
  const { quantidade, definir } = useRascunhoOferta();
  const igreja = useQuery({ queryKey: ['igreja', slug], queryFn: () => api.igreja(slug) });
  const campanha = useQuery({ queryKey: ['campanha'], queryFn: api.campanha });
  const premios = useQuery({ queryKey: ['premios'], queryFn: api.premios });

  if (igreja.isLoading || campanha.isLoading) return <Tela bordas={['bottom']}><Carregando /></Tela>;
  if (!igreja.data || !campanha.data) {
    return (
      <Tela bordas={['bottom']}>
        <Aviso>{(igreja.error as Error)?.message ?? 'Igreja não encontrada.'}</Aviso>
        <Botao titulo="Ver todas as igrejas" variante="contorno" onPress={() => router.replace('/igrejas')} />
      </Tela>
    );
  }
  const i = igreja.data;
  const c = campanha.data;
  const pctIgreja = c.divisao.find((d) => d.rotulo.toLowerCase() === 'igreja')?.percentual ?? 0;
  const futuros = (premios.data ?? []).filter((p) => new Date(p.dataSorteio) > new Date());

  function ofertar(anonima: boolean) {
    definir({ anonima, igreja: { id: i.id, nome: i.nome, cidade: i.cidade, uf: i.uf } });
    if (!anonima && !token) router.push({ pathname: '/login', params: { voltar: '/ofertar' } });
    else router.push('/ofertar');
  }

  async function compartilhar() {
    const link = `${BASE_URL}/igreja/${i.slug}`;
    await Share.share({ message: `Oferte para a ${i.nome} na campanha Renovando ${c.edicao} e concorra a prêmios: ${link}` });
  }

  return (
    <Tela bordas={['bottom']}>
      <Stack.Screen options={{ title: i.nome }} />

      <LinearGradient colors={[...gradienteMarca]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[{ borderRadius: raio.xl, padding: espaco.xl, gap: espaco.md, overflow: 'hidden' }, sombra(3)]}>
        <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.06)', top: -80, right: -70 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md }}>
          <View style={{ padding: 3, borderRadius: 40, backgroundColor: '#fff' }}>
            <LogoIgreja nome={i.nome} logoUrl={i.logoUrl} tamanho={60} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: cores.destaque, fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>{c.edicao.toUpperCase()}</Text>
            <Text style={{ color: '#EBD5E2' }}>{i.cidade}/{i.uf}</Text>
          </View>
        </View>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900', lineHeight: 31 }}>
          {i.nome} semeia esperança,{'\n'}
          <Text style={{ color: cores.destaque }}>distribuindo prêmios.</Text>
        </Text>
        {i.descricao ? <Text style={{ color: '#EBD5E2', lineHeight: 21 }}>{i.descricao}</Text> : null}
        <Text style={{ color: '#EBD5E2' }}>Defina o valor da sua oferta para a {i.nome}:</Text>

        <View style={{ backgroundColor: '#fff', borderRadius: raio.lg, padding: espaco.md, paddingHorizontal: espaco.lg, gap: espaco.sm }}>
          <Text style={{ fontSize: 34, fontWeight: '900', color: cores.primaria, letterSpacing: -0.5 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{moeda(quantidade * c.valorCupom)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco.md }}>
            <Text style={{ flex: 1, color: cores.textoSuave, fontSize: 14, fontWeight: '600' }}>{quantidade} {quantidade === 1 ? 'número' : 'números'} da sorte</Text>
            <Contador valor={quantidade} onChange={(v) => definir({ quantidade: v })} />
          </View>
        </View>

        <Pressable onPress={() => ofertar(false)} accessibilityRole="button" style={{ borderRadius: raio.md, overflow: 'hidden' }}>
          <LinearGradient colors={[...gradienteOuro]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espaco.sm }}>
            <Text style={{ color: cores.primariaProfunda, fontSize: 17, fontWeight: '900' }}>Ofertar e concorrer</Text>
            <Ionicons name="arrow-forward" size={20} color={cores.primariaProfunda} />
          </LinearGradient>
        </Pressable>
        <Pressable onPress={() => ofertar(true)} style={{ alignItems: 'center', paddingVertical: 4 }} accessibilityRole="button">
          <Text style={{ color: '#F1DCE8', fontWeight: '600' }}>Ofertar anonimamente (sem concorrer)</Text>
        </Pressable>
      </LinearGradient>

      <Cartao style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: cores.sucessoClaro, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="heart" size={22} color={cores.sucesso} />
        </View>
        <Text style={{ flex: 1, color: cores.texto, lineHeight: 20 }}>
          <Text style={{ fontWeight: '800' }}>{pctIgreja}% de cada oferta</Text> vai direto para a {i.nome}.
        </Text>
      </Cartao>

      {futuros.length ? (
        <Cartao>
          <Text style={{ fontSize: 17, fontWeight: '800', color: cores.texto }}>{moeda(c.totalPremios)} em prêmios</Text>
          {futuros.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ color: cores.texto, fontWeight: p.principal ? '800' : '500' }}>{p.nome}</Text>
              <Text style={{ color: cores.textoSuave }}>{data(p.dataSorteio)}</Text>
            </View>
          ))}
        </Cartao>
      ) : null}

      <Botao titulo="Compartilhar o link da igreja" icone="share-social-outline" variante="contorno" onPress={compartilhar} />
    </Tela>
  );
}
