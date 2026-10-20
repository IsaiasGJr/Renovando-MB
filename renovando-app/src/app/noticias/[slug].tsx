import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Share, Text } from 'react-native';
import { api } from '@/api';
import { minutosLeitura } from '@/components/Conteudo';
import { Aviso, Botao, Carregando, Tela } from '@/components/ui';
import { cores, raio } from '@/theme';
import { data } from '@/utils/format';
import { Imagem } from '@/components/Imagem';

export default function Noticia() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useQuery({ queryKey: ['noticia', slug], queryFn: () => api.noticia(slug) });
  const n = q.data;

  return (
    <Tela bordas={['bottom']}>
      <Stack.Screen options={{ title: 'Notícia' }} />
      {q.isLoading ? <Carregando /> : null}
      {q.error ? <Aviso>{(q.error as Error).message}</Aviso> : null}
      {n ? (
        <>
          {n.imagemUrl ? (
            <Imagem url={n.imagemUrl} style={{ width: '100%', height: 200, borderRadius: raio.lg }} />
          ) : null}
          <Text style={{ color: cores.textoSuave, fontSize: 13 }}>{data(n.publicadaEm)} · {minutosLeitura(n)} min de leitura</Text>
          <Text style={{ fontSize: 24, fontWeight: '800', color: cores.texto, lineHeight: 30 }}>{n.titulo}</Text>
          {n.resumo ? <Text style={{ fontSize: 16, color: cores.textoSuave, lineHeight: 23 }}>{n.resumo}</Text> : null}
          {n.conteudo
            .split(/\n\s*\n/)
            .filter((p) => p.trim())
            .map((p, i) => (
              <Text key={i} style={{ fontSize: 16, color: cores.texto, lineHeight: 25 }}>{p.trim()}</Text>
            ))}
          <Botao titulo="Compartilhar" variante="contorno" icone="share-social-outline"
            onPress={() => Share.share({ message: `${n.titulo}\n\n${n.resumo}` })} />
        </>
      ) : null}
    </Tela>
  );
}
