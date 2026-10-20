import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { api } from '@/api';
import { TextoFormatado } from '@/components/TextoFormatado';
import { Aviso, Carregando, Cartao, Tela, Titulo } from '@/components/ui';
import { cores } from '@/theme';
import { data } from '@/utils/format';

/** Política de Privacidade e Termos de Uso (textos editáveis no admin). */
export default function PaginaLegal() {
  const { slug } = useLocalSearchParams<{ slug: 'privacidade' | 'termos' }>();
  const q = useQuery({ queryKey: ['pagina', slug], queryFn: () => api.pagina(slug) });
  const titulo = slug === 'termos' ? 'Termos de Uso' : 'Política de Privacidade';

  return (
    <Tela bordas={['bottom']}>
      <Stack.Screen options={{ title: titulo }} />
      {q.isLoading ? <Carregando /> : null}
      {q.error ? <Aviso>{(q.error as Error).message}</Aviso> : null}
      {q.data ? (
        <>
          <Titulo>{q.data.titulo}</Titulo>
          <Text style={{ color: cores.textoSuave, fontSize: 13 }}>Atualizado em {data(q.data.atualizadoEm)}</Text>
          <Cartao>
            <TextoFormatado texto={q.data.conteudo} />
          </Cartao>
        </>
      ) : null}
    </Tela>
  );
}
