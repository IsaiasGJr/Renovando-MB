import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSessao } from '@/store/sessao';
import { cores } from '@/theme';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000 } } }));
  const { carregado, token, carregar } = useSessao();

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Ao sair, limpa os dados em cache da sessão anterior.
  useEffect(() => {
    if (!token) queryClient.clear();
  }, [token, queryClient]);

  if (!carregado) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.primariaEscura }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  const logado = !!token;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={logado ? 'dark' : 'light'} />
        <Stack
          screenOptions={{
            headerTintColor: cores.primaria,
            headerTitleStyle: { color: cores.texto },
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: cores.fundo },
          }}
        >
          <Stack.Protected guard={!logado}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={logado}>
            <Stack.Screen name="(abas)" options={{ headerShown: false }} />
            <Stack.Screen name="[recurso]/index" options={{ title: '' }} />
            <Stack.Screen name="[recurso]/editar" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="campanhas/index" options={{ title: 'Campanhas' }} />
            <Stack.Screen name="campanhas/editar" options={{ title: 'Campanha', presentation: 'modal' }} />
            <Stack.Screen name="sorteio" options={{ title: 'Sorteio', presentation: 'modal' }} />
            <Stack.Screen name="ofertantes" options={{ title: 'Ofertantes' }} />
            <Stack.Screen name="auditoria" options={{ title: 'Registro de atividades' }} />
            <Stack.Screen name="avisos" options={{ title: 'Avisos no celular' }} />
            <Stack.Screen name="aprovacoes" options={{ title: 'Aprovações' }} />
            <Stack.Screen name="repasses" options={{ title: 'Repasses' }} />
            <Stack.Screen name="repasse" options={{ title: 'Repasse' }} />
            <Stack.Screen name="oferta" options={{ title: 'Oferta' }} />
            <Stack.Screen name="registrar-oferta" options={{ title: 'Registrar oferta', presentation: 'modal' }} />
            <Stack.Screen name="ajuda" options={{ title: 'Central de ajuda' }} />
          </Stack.Protected>
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
