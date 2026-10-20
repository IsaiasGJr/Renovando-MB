import { useQuery } from '@tanstack/react-query';
import { Text } from 'react-native';
import { api } from '@/api';
import { CartaoNoticia } from '@/components/Conteudo';
import { Aviso, Carregando, Tela } from '@/components/ui';
import { cores } from '@/theme';

export default function Noticias() {
  const q = useQuery({ queryKey: ['noticias'], queryFn: api.noticias });
  return (
    <Tela bordas={['bottom']}>
      <Text style={{ color: cores.textoSuave }}>Fique por dentro das atualizações do projeto.</Text>
      {q.isLoading ? <Carregando /> : null}
      {q.error ? <Aviso>{(q.error as Error).message}</Aviso> : null}
      {q.data?.length === 0 ? <Text style={{ color: cores.textoSuave }}>Nenhuma notícia publicada ainda.</Text> : null}
      {q.data?.map((n) => <CartaoNoticia key={n.id} n={n} />)}
    </Tela>
  );
}
