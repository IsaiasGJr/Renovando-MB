import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '@/api';
import { Cartao } from '@/components/ui';
import type { NoticiaResumo } from '@/types';
import { cores, espaco, gradienteMarca, raio, sombra, tipografia } from '@/theme';
import { data } from '@/utils/format';
import { Imagem } from '@/components/Imagem';

type Icone = ComponentProps<typeof Ionicons>['name'];

/** Perguntas frequentes em acordeão (cadastradas no admin). */
export function ListaFaq({ limite }: { limite?: number }) {
  const { data: faqs } = useQuery({ queryKey: ['faqs'], queryFn: api.faqs });
  const [aberta, setAberta] = useState<string | null>(null);
  return (
    <View style={{ gap: espaco.sm }}>
      {faqs?.slice(0, limite).map((f) => {
        const ativa = aberta === f.id;
        return (
          <Pressable key={f.id} onPress={() => setAberta(ativa ? null : f.id)} accessibilityRole="button"
            accessibilityState={{ expanded: ativa }}
            style={{ backgroundColor: cores.superficie, borderRadius: raio.md, ...sombra(1), padding: espaco.lg, gap: espaco.sm }}>
            <View style={{ flexDirection: 'row', gap: espaco.sm, alignItems: 'center' }}>
              <Text style={{ flex: 1, fontWeight: '600', color: cores.texto, fontSize: 15 }}>{f.pergunta}</Text>
              <Ionicons name={ativa ? 'chevron-up' : 'chevron-down'} size={18} color={cores.primaria} />
            </View>
            {ativa ? <Text style={{ color: cores.textoSuave, lineHeight: 21 }}>{f.resposta}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Carrossel horizontal de depoimentos. */
export function Depoimentos() {
  const { data: deps } = useQuery({ queryKey: ['depoimentos'], queryFn: api.depoimentos });
  if (!deps?.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espaco.md, paddingRight: espaco.lg }}
      style={{ marginHorizontal: -espaco.lg, paddingLeft: espaco.lg }}>
      {deps.map((d) => (
        <View key={d.id} style={{ width: 280, backgroundColor: cores.superficie, borderRadius: raio.lg, ...sombra(1), padding: espaco.lg, gap: espaco.sm }}>
          <Ionicons name="chatbubble-ellipses" size={22} color={cores.destaque} />
          <Text style={{ fontWeight: '700', color: cores.texto, fontSize: 15 }}>“{d.titulo}”</Text>
          <Text style={{ color: cores.textoSuave, lineHeight: 20 }} numberOfLines={6}>{d.texto}</Text>
          <Text style={{ color: cores.primaria, fontWeight: '600', marginTop: 'auto' }}>
            {d.autor}{d.local ? ` · ${d.local}` : ''}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

export const minutosLeitura = (n: NoticiaResumo) => Math.max(1, Math.round((n.tamanho ?? 0) / 1000));

export function CartaoNoticia({ n }: { n: NoticiaResumo }) {
  return (
    <Pressable onPress={() => router.push({ pathname: '/noticias/[slug]', params: { slug: n.slug } })}
      style={{ backgroundColor: cores.superficie, borderRadius: raio.lg, ...sombra(1), overflow: 'hidden' }}>
      {n.imagemUrl ? <Imagem url={n.imagemUrl} style={{ width: '100%', height: 150 }} /> : null}
      <View style={{ padding: espaco.lg, gap: 4 }}>
        <Text style={{ color: cores.textoSuave, fontSize: 12 }}>{data(n.publicadaEm)} · {minutosLeitura(n)} min de leitura</Text>
        <Text style={{ fontWeight: '700', color: cores.texto, fontSize: 16 }}>{n.titulo}</Text>
        {n.resumo ? <Text style={{ color: cores.textoSuave }} numberOfLines={2}>{n.resumo}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Título de seção com link "ver tudo" opcional. */
export function Secao({ titulo, acao, onAcao }: { titulo: string; acao?: string; onAcao?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -espaco.sm }}>
      <Text style={[tipografia.secao, { color: cores.texto }]}>{titulo}</Text>
      {acao ? (
        <Pressable onPress={onAcao} hitSlop={8}>
          <Text style={{ color: cores.primaria, fontWeight: '600' }}>{acao}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Item com ícone, título e texto (listas de benefícios, áreas, passos). */
export function ItemIcone({ icone, titulo, children }: { icone: Icone; titulo: string; children?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: espaco.md }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: cores.primariaClara, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icone} size={20} color={cores.primaria} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontWeight: '700', color: cores.texto, fontSize: 15 }}>{titulo}</Text>
        {children ? <Text style={{ color: cores.textoSuave, lineHeight: 20 }}>{children}</Text> : null}
      </View>
    </View>
  );
}

/** Bloco de destaque (topo das páginas institucionais). */
export function Destaque({ selo, titulo, texto, children }: { selo?: string; titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <LinearGradient colors={[...gradienteMarca]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[{ borderRadius: raio.xl, padding: espaco.xl, gap: espaco.md, overflow: 'hidden' }, sombra(2)]}>
      <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)', top: -70, right: -60 }} />
      {selo ? <Text style={{ color: cores.destaque, fontWeight: '700', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>{selo}</Text> : null}
      <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', lineHeight: 32 }}>{titulo}</Text>
      {texto ? <Text style={{ color: '#F1DCE8', fontSize: 15, lineHeight: 22 }}>{texto}</Text> : null}
      {children}
    </LinearGradient>
  );
}

export function Citacao({ texto, referencia }: { texto: string; referencia: string }) {
  return (
    <Cartao style={{ borderLeftWidth: 4, borderLeftColor: cores.destaque }}>
      <Text style={{ fontStyle: 'italic', color: cores.texto, fontSize: 16 }}>“{texto}”</Text>
      <Text style={{ color: cores.textoSuave }}>{referencia}</Text>
    </Cartao>
  );
}
