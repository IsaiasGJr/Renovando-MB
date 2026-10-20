import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Carregando } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { cores } from '@/theme';

export default function RootLayout() {
  // Conteúdo do app muda pouco: guarda por 1 min sem buscar de novo ao trocar de tela,
  // e mantém em memória por 10 min (voltar para uma tela é instantâneo).
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: 10 * 60_000, retry: 1 } } }),
  );
  const carregado = useAuth((a) => a.carregado);
  const carregar = useAuth((a) => a.carregar);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        {!carregado ? (
          <Carregando />
        ) : (
          <Stack
            screenOptions={{
              headerTintColor: cores.primaria,
              headerTitleStyle: { color: cores.texto },
              headerBackButtonDisplayMode: 'minimal',
              contentStyle: { backgroundColor: cores.fundo },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ title: 'Entrar', presentation: 'modal' }} />
            <Stack.Screen name="ofertar/index" options={{ title: 'Sua oferta' }} />
            <Stack.Screen name="ofertar/[id]" options={{ title: 'Pagamento via PIX', headerBackVisible: false }} />
            <Stack.Screen name="cadastro-igreja" options={{ title: 'Cadastrar igreja' }} />
            <Stack.Screen name="noticias/index" options={{ title: 'Novidades' }} />
            <Stack.Screen name="noticias/[slug]" options={{ title: 'Notícia' }} />
            <Stack.Screen name="faq" options={{ title: 'Perguntas frequentes' }} />
            <Stack.Screen name="projeto" options={{ title: 'O projeto' }} />
            <Stack.Screen name="palmas-para-jesus" options={{ title: 'Palmas para Jesus' }} />
            <Stack.Screen name="traga-sua-igreja" options={{ title: 'Traga sua igreja' }} />
            <Stack.Screen name="seja-semeador" options={{ title: 'Seja um semeador' }} />
            <Stack.Screen name="shows" options={{ title: 'Shows gospel' }} />
            <Stack.Screen name="depoimentos" options={{ title: 'Depoimentos' }} />
            <Stack.Screen name="igreja/[slug]" options={{ title: 'Igreja' }} />
            <Stack.Screen name="artista/[slug]" options={{ title: 'Artista' }} />
            <Stack.Screen name="contato" options={{ title: 'Fale conosco' }} />
            <Stack.Screen name="painel" options={{ title: 'Meu painel' }} />
            <Stack.Screen name="pagina/[slug]" options={{ title: '' }} />
            <Stack.Screen name="excluir-conta" options={{ title: 'Excluir conta' }} />
          </Stack>
        )}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
