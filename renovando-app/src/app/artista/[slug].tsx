import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api';
import { Aviso, Botao, Carregando, Cartao, Tela } from '@/components/ui';
import { cores, espaco, raio, sombra } from '@/theme';
import { Imagem } from '@/components/Imagem';
import { VisualizadorFotos } from '@/components/VisualizadorFotos';

/** Página do artista: foto, biografia, galeria e pedido de proposta já com o artista marcado. */
export default function Artista() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useQuery({ queryKey: ['artista', slug], queryFn: () => api.artista(slug) });
  const todos = useQuery({ queryKey: ['artistas'], queryFn: api.artistas });
  const a = q.data;
  const outros = (todos.data ?? []).filter((x) => x.slug !== slug).slice(0, 10);
  const [foto, setFoto] = useState<number | null>(null);
  const fotos = a ? [...(a.fotoUrl ? [a.fotoUrl] : []), ...a.galeria] : [];

  return (
    <Tela bordas={['bottom']}>
      <Stack.Screen options={{ title: a?.nome ?? 'Artista' }} />
      {q.isLoading ? <Carregando /> : null}
      {q.error ? <Aviso>{(q.error as Error).message}</Aviso> : null}
      {a ? (
        <>
          {/* Capa em retrato (as fotos dos artistas são verticais), com o nome sobre um degradê, como no site. */}
          <Pressable onPress={() => a.fotoUrl && setFoto(0)} disabled={!a.fotoUrl} accessibilityLabel={`Ver foto de ${a.nome}`}
            style={[{ borderRadius: raio.xl, overflow: 'hidden', backgroundColor: cores.primariaProfunda, aspectRatio: 4 / 5, maxHeight: 520 }, sombra(2)]}>
            {a.fotoUrl ? (
              <Imagem url={a.fotoUrl} style={StyleSheet.absoluteFill} rotulo={a.nome} posicao="top" />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="mic" size={64} color={cores.primariaSuave} />
              </View>
            )}
            <LinearGradient colors={['transparent', 'rgba(54,0,42,0.55)', 'rgba(54,0,42,0.95)']}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 90, padding: espaco.xl, gap: 4 }}>
              <Text style={{ color: cores.destaque, fontWeight: '800', fontSize: 11, letterSpacing: 1.4 }}>SHOWS GOSPEL · DISCOVERYDET</Text>
              <Text style={{ fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>{a.nome}</Text>
            </LinearGradient>
          </Pressable>
          {a.bio ? <Text style={{ color: cores.texto, fontSize: 15, lineHeight: 23 }}>{a.bio}</Text> : null}

          <Botao titulo="Solicitar proposta" icone="calendar" onPress={() => router.push({ pathname: '/shows', params: { artista: a.nome } })} />

          {a.galeria.length ? (
            <>
              <Text style={{ fontSize: 19, fontWeight: '800', color: cores.texto }}>Galeria</Text>
              <Text style={{ color: cores.textoSuave, marginTop: -espaco.sm }}>Toque numa foto para ver inteira.</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -espaco.lg }}
                contentContainerStyle={{ gap: espaco.sm, paddingHorizontal: espaco.lg }}>
                {a.galeria.map((url, i) => (
                  <Pressable key={url} onPress={() => setFoto(i + (a.fotoUrl ? 1 : 0))} accessibilityRole="imagebutton" accessibilityLabel={`Foto ${i + 1} de ${a.nome}`}
                    style={[{ borderRadius: raio.lg, overflow: 'hidden', backgroundColor: cores.primariaClara }, sombra(1)]}>
                    <Imagem url={url} style={{ width: 150, height: 200 }} posicao="top" />
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          {outros.length ? (
            <Cartao>
              <Text style={{ fontSize: 17, fontWeight: '800', color: cores.texto }}>Outros artistas</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm }}>
                {outros.map((o) => (
                  <Pressable key={o.id} onPress={() => router.replace({ pathname: '/artista/[slug]', params: { slug: o.slug ?? '' } })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: o.fotoUrl ? 4 : 12, paddingRight: 12, paddingVertical: 4, borderRadius: raio.pill, backgroundColor: cores.primariaClara }}>
                    {o.fotoUrl ? <Imagem url={o.fotoUrl} style={{ width: 30, height: 30, borderRadius: 15 }} posicao="top" /> : null}
                    <Text style={{ color: cores.primaria, fontWeight: '700' }}>{o.nome}</Text>
                  </Pressable>
                ))}
              </View>
            </Cartao>
          ) : null}
          <VisualizadorFotos fotos={fotos} inicio={foto} onFechar={() => setFoto(null)} />
        </>
      ) : null}
    </Tela>
  );
}
