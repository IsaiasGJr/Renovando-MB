import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { api } from '@/api';
import { CartaoNoticia, Depoimentos, ListaFaq, Secao } from '@/components/Conteudo';
import { Marca } from '@/components/Marca';
import { Aviso, Botao, Carregando, Cartao, Contador, Tela } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { useRascunhoOferta } from '@/store/oferta';
import type { Banner, Premio } from '@/types';
import { cores, espaco, gradienteMarca, gradienteOuro, raio, sombra, tipografia } from '@/theme';
import { data, diasAte, moeda } from '@/utils/format';
import { Imagem } from '@/components/Imagem';

type Icone = ComponentProps<typeof Ionicons>['name'];

const PASSOS: [Icone, string, string][] = [
  ['hand-left', 'Escolha como ofertar', 'Concorra aos prêmios ou oferte anonimamente.'],
  ['cash', 'Oferte a partir de R$ 20', 'Cada R$ 20 vira 1 número da sorte.'],
  ['business', 'Fortaleça sua igreja', 'A maior parte volta para a igreja escolhida.'],
  ['videocam', 'Assista ao sorteio ao vivo', 'Você recebe um aviso no app.'],
];

const VANTAGENS: [Icone, string, string][] = [
  ['heart', 'Ação de fé', 'Cupons de R$ 20 num movimento nacional que fortalece igrejas e projetos sociais.'],
  ['trophy', 'Grandes prêmios', 'Além de abençoar sua comunidade, você concorre a carro, PIX e celulares.'],
  ['earth', 'Impacto real', 'Cada oferta financia obras, eventos evangelísticos, ações sociais e a missão local.'],
];

/** Abre o destino do banner: rota do app (/shows) ou site externo (https://...). */
function abrirLink(link: string) {
  if (!link) return;
  if (link.startsWith('/')) router.push(link as never);
  else Linking.openURL(link);
}

/** Banners rotativos do topo (cadastrados no admin). */
function Banners({ banners }: { banners: Banner[] }) {
  const { width } = useWindowDimensions();
  const largura = Math.min(width, 700) - espaco.lg * 2;
  const [atual, setAtual] = useState(0);
  if (!banners.length) return null;
  return (
    <View style={{ gap: espaco.sm }}>
      {/* No celular o carrossel "encaixa" banner a banner; na web o encaixe do navegador ignora a margem. */}
      <ScrollView horizontal snapToInterval={Platform.OS === 'web' ? undefined : largura + espaco.md} decelerationRate="fast" showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -espaco.lg }} contentContainerStyle={{ paddingHorizontal: espaco.lg, gap: espaco.md }}
        onMomentumScrollEnd={(e) => setAtual(Math.round(e.nativeEvent.contentOffset.x / (largura + espaco.md)))}
        onScroll={(e) => setAtual(Math.round(e.nativeEvent.contentOffset.x / (largura + espaco.md)))} scrollEventThrottle={64}>
        {banners.map((b, i) => (
          <Pressable key={b.id} onPress={() => abrirLink(b.link)} accessibilityRole={b.link ? 'link' : undefined} accessibilityLabel={b.titulo}
            style={[{ width: largura, height: 150, borderRadius: raio.lg, overflow: 'hidden' }, sombra(2)]}>
            {b.imagemUrl ? (
              <Imagem url={b.imagemUrl} style={StyleSheet.absoluteFill} />
            ) : (
              <LinearGradient colors={i % 2 ? [...gradienteOuro] : [...gradienteMarca]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(30,0,22,0.65)']} style={StyleSheet.absoluteFill} />
            <View style={{ flex: 1, justifyContent: 'flex-end', padding: espaco.lg, gap: 2 }}>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>{b.titulo}</Text>
              {b.subtitulo ? <Text style={{ color: '#F5E8F1', fontSize: 13 }} numberOfLines={2}>{b.subtitulo}</Text> : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {banners.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }} accessibilityElementsHidden>
          {banners.map((b, i) => (
            <View key={b.id} style={{ width: i === atual ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === atual ? cores.primaria : cores.primariaSuave }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const iconePremio = (p: Premio): Icone =>
  p.principal ? 'car-sport' : p.nome.toLowerCase().includes('pix') ? 'cash' : p.nome.toLowerCase().includes('iphone') ? 'phone-portrait' : 'gift';

function FaltamDias({ iso }: { iso: string }) {
  const d = diasAte(iso);
  return (
    <View style={{ backgroundColor: cores.destaqueClaro, borderRadius: raio.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: cores.destaqueEscuro, fontWeight: '800', fontSize: 12 }}>
        {d <= 0 ? 'Hoje' : d === 1 ? 'Amanhã' : `Faltam ${d} dias`}
      </Text>
    </View>
  );
}

export default function Inicio() {
  const { token, usuario } = useAuth();
  const { quantidade, definir } = useRascunhoOferta();
  const campanha = useQuery({ queryKey: ['campanha'], queryFn: api.campanha });
  const premios = useQuery({ queryKey: ['premios'], queryFn: api.premios });
  const noticias = useQuery({ queryKey: ['noticias'], queryFn: api.noticias });
  const banners = useQuery({ queryKey: ['banners'], queryFn: api.banners });
  const igrejas = useQuery({ queryKey: ['igrejas', ''], queryFn: () => api.igrejas('') });
  // Carrossel: até 20 igrejas que têm logo (sem logo, o cartão ficaria vazio).
  const comLogo = useMemo(() => (igrejas.data ?? []).filter((i) => i.logoUrl).slice(0, 20), [igrejas.data]);

  if (!campanha.data) {
    return (
      <Tela>
        {campanha.error ? (
          <>
            <Aviso>{(campanha.error as Error).message}</Aviso>
            <Botao titulo="Tentar de novo" variante="contorno" onPress={() => campanha.refetch()} />
          </>
        ) : (
          <Carregando />
        )}
      </Tela>
    );
  }
  const c = campanha.data;
  const futuros = premios.data?.filter((p) => new Date(p.dataSorteio) > new Date()) ?? [];
  const proximo = futuros[0];
  const principal = premios.data?.find((p) => p.principal);
  const outros = premios.data?.filter((p) => !p.principal) ?? [];

  function ofertar(anonima: boolean) {
    definir({ anonima });
    if (!anonima && !token) router.push({ pathname: '/login', params: { voltar: '/ofertar' } });
    else router.push('/ofertar');
  }

  return (
    <Tela>
      {/* Topo com a marca */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Marca subtitulo="a Vinha do Senhor" />
        <Pressable
          onPress={() => router.push(token ? '/cupons' : { pathname: '/login', params: { voltar: '/cupons' } })}
          style={[st.avatar, sombra(1)]}
          accessibilityLabel={usuario ? 'Meus cupons' : 'Entrar'}
        >
          {usuario ? (
            <Text style={{ color: cores.primaria, fontWeight: '800', fontSize: 16 }}>{usuario.nome.charAt(0).toUpperCase()}</Text>
          ) : (
            <Ionicons name="person" size={20} color={cores.primaria} />
          )}
        </Pressable>
      </View>

      <Banners banners={banners.data ?? []} />

      {/* Destaque da campanha */}
      <LinearGradient colors={[...gradienteMarca]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.hero, sombra(3)]}>
        <View style={st.bolha1} />
        <View style={st.bolha2} />
        <View style={st.selo}>
          <Ionicons name="sparkles" size={12} color={cores.primariaProfunda} />
          <Text style={st.seloTexto}>{c.edicao}</Text>
        </View>
        <Text style={st.heroTitulo}>
          {c.titulo}
          {'\n'}
          <Text style={{ color: cores.destaque }}>{c.subtitulo}</Text>
        </Text>
        <Text style={st.heroSub}>Escolha o valor da sua oferta e concorra:</Text>

        <View style={st.seletor}>
          <View style={{ flex: 1 }}>
            <Text style={st.valor}>{moeda(quantidade * c.valorCupom)}</Text>
            <Text style={st.numeros}>
              {quantidade} {quantidade === 1 ? 'número' : 'números'} da sorte
            </Text>
          </View>
          <Contador valor={quantidade} onChange={(v) => definir({ quantidade: v })} />
        </View>

        <Pressable onPress={() => ofertar(false)} accessibilityRole="button"
          style={({ pressed }) => [{ borderRadius: raio.md, overflow: 'hidden', transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <LinearGradient colors={[...gradienteOuro]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.cta}>
            <Text style={st.ctaTexto}>Ofertar e concorrer</Text>
            <Ionicons name="arrow-forward" size={20} color={cores.primariaProfunda} />
          </LinearGradient>
        </Pressable>
        <Pressable onPress={() => ofertar(true)} style={{ alignItems: 'center', paddingVertical: 4 }} accessibilityRole="button">
          <Text style={{ color: '#F1DCE8', fontWeight: '600', fontSize: 15 }}>Prefere ofertar anonimamente?</Text>
        </Pressable>
      </LinearGradient>

      {/* Próximo sorteio */}
      {proximo ? (
        <Cartao style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md }}>
          <View style={[st.iconeRedondo, { backgroundColor: cores.primariaClara }]}>
            <Ionicons name="calendar" size={22} color={cores.primaria} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.rotuloPeq}>Próximo sorteio · {data(proximo.dataSorteio)}</Text>
            <Text style={st.forte}>{proximo.nome}</Text>
          </View>
          <FaltamDias iso={proximo.dataSorteio} />
        </Cartao>
      ) : null}

      {/* Prêmios */}
      <Secao titulo={`${moeda(c.totalPremios)} em prêmios`} acao="Ver todos" onAcao={() => router.navigate('/premios')} />
      {principal ? (
        <Pressable onPress={() => router.navigate('/premios')}>
          <LinearGradient colors={[...gradienteOuro]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.principal, sombra(2)]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[tipografia.sobretitulo, { color: cores.primariaProfunda, opacity: 0.75 }]}>Prêmio principal</Text>
              <Text style={{ fontSize: 24, fontWeight: '900', color: cores.primariaProfunda, letterSpacing: -0.4 }}>{principal.nome}</Text>
              <Text style={{ color: cores.primariaProfunda, fontWeight: '600' }}>Sorteio em {data(principal.dataSorteio)}</Text>
            </View>
            {principal.imagemUrl ? (
              <Imagem url={principal.imagemUrl} style={{ width: 88, height: 88, borderRadius: raio.md }} />
            ) : (
              <View style={st.iconePrincipal}>
                <Ionicons name={iconePremio(principal)} size={44} color={cores.primariaProfunda} />
              </View>
            )}
          </LinearGradient>
        </Pressable>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -espaco.lg }} contentContainerStyle={{ gap: espaco.md, paddingHorizontal: espaco.lg, paddingVertical: 4 }}>
        {outros.map((p) => {
          const sorteado = new Date(p.dataSorteio) <= new Date();
          return (
            <View key={p.id} style={[st.premioMini, sombra(1)]}>
              <View style={[st.iconeRedondo, { backgroundColor: sorteado ? '#EEE8EC' : cores.primariaClara }]}>
                <Ionicons name={iconePremio(p)} size={22} color={sorteado ? cores.textoFraco : cores.primaria} />
              </View>
              <Text style={[st.forte, { marginTop: espaco.sm }]} numberOfLines={1}>{p.nome}</Text>
              <Text style={st.rotuloPeq}>{data(p.dataSorteio)}</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', marginTop: 4, color: sorteado ? cores.sucesso : cores.destaqueEscuro }}>
                {sorteado ? (p.ganhador ? `Nº ${p.ganhador.numero}` : 'Sorteado') : 'A sortear'}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Por que participar */}
      <Secao titulo="Por que participar?" />
      <View style={{ gap: espaco.md }}>
        {VANTAGENS.map(([icone, titulo, texto], i) => (
          <View key={titulo} style={[{ flexDirection: 'row', alignItems: 'center', gap: espaco.md, backgroundColor: cores.superficie, borderRadius: raio.lg, padding: espaco.lg }, sombra(1)]}>
            <LinearGradient colors={i === 1 ? [...gradienteOuro] : [...gradienteMarca]} style={{ width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={icone} size={24} color={i === 1 ? cores.primariaProfunda : cores.destaque} />
            </LinearGradient>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={st.forte}>{titulo}</Text>
              <Text style={st.rotuloPeq}>{texto}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Igrejas envolvidas: como no site, só o total e um carrossel de logos (a lista completa fica na aba Igrejas). */}
      {igrejas.data?.length ? (
        <>
          <Secao titulo="Igrejas envolvidas" />
          <Text style={[st.rotuloPeq, { marginTop: -espaco.xs }]}>
            Já são mais de {Math.floor(igrejas.data.length / 5) * 5 || igrejas.data.length} igrejas credenciadas em todo o país.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -espaco.lg }}
            contentContainerStyle={{ gap: espaco.md, paddingHorizontal: espaco.lg, paddingVertical: 4 }}>
            {comLogo.map((i) => (
              <Pressable key={i.id} onPress={() => i.slug && router.push({ pathname: '/igreja/[slug]', params: { slug: i.slug } })}
                accessibilityRole="button" accessibilityLabel={i.nome}
                style={[{ width: 96, height: 96, borderRadius: raio.lg, backgroundColor: cores.superficie, padding: espaco.sm, alignItems: 'center', justifyContent: 'center' }, sombra(1)]}>
                <Imagem url={i.logoUrl} ajuste="contain" style={{ width: 80, height: 80 }} rotulo={i.nome} />
              </Pressable>
            ))}
          </ScrollView>
          <Botao titulo="Ver todas as igrejas" variante="contorno" icone="business-outline" onPress={() => router.navigate('/igrejas')} />
        </>
      ) : null}

      {/* Como funciona */}
      <Secao titulo="Como funciona" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md }}>
        {PASSOS.map(([icone, titulo, texto], i) => (
          <View key={titulo} style={[st.passo, sombra(1)]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={[st.iconeRedondo, { backgroundColor: cores.primariaClara, width: 40, height: 40 }]}>
                <Ionicons name={icone} size={19} color={cores.primaria} />
              </View>
              <Text style={{ fontSize: 26, fontWeight: '900', color: cores.primariaSuave }}>{i + 1}</Text>
            </View>
            <Text style={[st.forte, { marginTop: espaco.sm }]}>{titulo}</Text>
            <Text style={st.rotuloPeq}>{texto}</Text>
          </View>
        ))}
      </View>

      {/* Divisão */}
      <Cartao>
        <Text style={[tipografia.secao, { color: cores.texto, marginBottom: 4 }]}>Para onde vai sua oferta</Text>
        {c.divisao.map((d, i) => (
          <View key={d.rotulo} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: cores.texto, fontWeight: i === 0 ? '700' : '500' }}>{d.rotulo}</Text>
              <Text style={st.forte}>{d.percentual}%</Text>
            </View>
            <View style={st.barraFundo}>
              <View style={[st.barra, { width: `${d.percentual}%`, opacity: i === 0 ? 1 : 0.55 }]} />
            </View>
          </View>
        ))}
      </Cartao>

      {/* Igreja */}
      <Pressable onPress={() => router.push('/traga-sua-igreja')}>
        <LinearGradient colors={['#FBEFF6', '#F3E1EC']} style={[st.chamada]}>
          <View style={[st.iconeRedondo, { backgroundColor: cores.superficie }]}>
            <Ionicons name="business" size={22} color={cores.primaria} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.forte}>Sua igreja ainda não participa?</Text>
            <Text style={st.rotuloPeq}>Cadastre e receba a maior parte das ofertas no PIX da congregação.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={cores.primaria} />
        </LinearGradient>
      </Pressable>

      <Pressable onPress={() => router.push('/palmas-para-jesus')}>
        <Cartao style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md }}>
          <View style={[st.iconeRedondo, { backgroundColor: cores.sucessoClaro }]}>
            <Ionicons name="leaf" size={22} color={cores.sucesso} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.rotuloPeq}>Fundo social</Text>
            <Text style={st.forte}>Conheça o Palmas para Jesus</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={cores.textoFraco} />
        </Cartao>
      </Pressable>

      <Pressable onPress={() => router.push('/shows')} accessibilityRole="button" accessibilityLabel="Contratar shows gospel">
        <LinearGradient colors={[...gradienteMarca]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.chamada, sombra(2)]}>
          <View style={[st.iconeRedondo, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
            <Ionicons name="musical-notes" size={22} color={cores.destaque} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.forte, { color: '#fff' }]}>Contrate shows gospel</Text>
            <Text style={[st.rotuloPeq, { color: '#EBD5E2' }]}>Artistas para sua igreja, congresso ou evento. Peça uma proposta.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={cores.destaque} />
        </LinearGradient>
      </Pressable>

      <Secao titulo="Depoimentos" acao="Ver todos" onAcao={() => router.push('/depoimentos')} />
      <Depoimentos />

      {noticias.data?.length ? (
        <>
          <Secao titulo="Novidades" acao="Ver todas" onAcao={() => router.push('/noticias')} />
          {noticias.data.slice(0, 3).map((n) => <CartaoNoticia key={n.id} n={n} />)}
        </>
      ) : null}

      <Secao titulo="Perguntas frequentes" acao="Ver todas" onAcao={() => router.push('/faq')} />
      <ListaFaq limite={3} />
    </Tela>
  );
}

const st = StyleSheet.create({
  avatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: cores.superficie, alignItems: 'center', justifyContent: 'center',
  },
  hero: { borderRadius: raio.xl, padding: espaco.xl, gap: espaco.md, overflow: 'hidden' },
  bolha1: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.06)', top: -80, right: -70 },
  bolha2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(233,162,59,0.10)', bottom: -50, left: -40 },
  selo: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: cores.destaque,
    borderRadius: raio.pill, paddingHorizontal: 10, paddingVertical: 4,
  },
  seloTexto: { color: cores.primariaProfunda, fontWeight: '800', fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' },
  heroTitulo: { color: '#fff', fontSize: 30, fontWeight: '900', lineHeight: 35, letterSpacing: -0.6 },
  heroSub: { color: '#EBD5E2', fontSize: 15 },
  seletor: {
    backgroundColor: cores.superficie, borderRadius: raio.lg, padding: espaco.md, paddingLeft: espaco.lg,
    flexDirection: 'row', alignItems: 'center', gap: espaco.md,
  },
  valor: { fontSize: 28, fontWeight: '900', color: cores.primaria, letterSpacing: -0.5 },
  numeros: { color: cores.textoSuave, fontSize: 13 },
  cta: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espaco.sm, borderRadius: raio.md },
  ctaTexto: { color: cores.primariaProfunda, fontSize: 17, fontWeight: '900', letterSpacing: 0.1 },
  iconeRedondo: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  principal: { borderRadius: raio.xl, padding: espaco.xl, flexDirection: 'row', alignItems: 'center', gap: espaco.md },
  iconePrincipal: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  premioMini: { width: 148, backgroundColor: cores.superficie, borderRadius: raio.lg, padding: espaco.lg },
  passo: { flexGrow: 1, flexBasis: '45%', backgroundColor: cores.superficie, borderRadius: raio.lg, padding: espaco.lg, gap: 2 },
  chamada: { borderRadius: raio.lg, padding: espaco.lg, flexDirection: 'row', alignItems: 'center', gap: espaco.md },
  forte: { fontWeight: '800', color: cores.texto, fontSize: 15 },
  rotuloPeq: { color: cores.textoSuave, fontSize: 13, lineHeight: 18 },
  barraFundo: { height: 10, borderRadius: 5, backgroundColor: cores.primariaClara, overflow: 'hidden' },
  barra: { height: 10, borderRadius: 5, backgroundColor: cores.primaria },
});
