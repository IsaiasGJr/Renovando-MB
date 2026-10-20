import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { api } from '@/api';
import { Info, Vazio } from '@/components/admin';
import { Aviso, Carregando, Cartao, s as ui } from '@/components/ui';
import { cores, espaco } from '@/theme';
import { data, moeda, numero } from '@/utils/format';

type Ofertante = { id: string; nome: string; sobrenome: string; whatsapp: string; criadoEm: string; cupons: number; total: number };

export default function Ofertantes() {
  const [busca, setBusca] = useState('');
  const q = useQuery({
    queryKey: ['usuarios', busca],
    queryFn: () => api<Ofertante[]>(`/usuarios?busca=${encodeURIComponent(busca)}`),
  });

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(u) => u.id}
        contentContainerStyle={ui.conteudo}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: espaco.md }} />}
        ListHeaderComponent={
          <View style={{ gap: espaco.md }}>
            <TextInput value={busca} onChangeText={setBusca} placeholder="Nome ou WhatsApp completo com DDD"
              placeholderTextColor={cores.textoSuave} style={ui.input} accessibilityLabel="Buscar ofertante" />
            <Text style={{ color: cores.textoSuave, fontSize: 13 }}>
              Até 200 pessoas, ordenadas pelo total ofertado. Por segurança, o WhatsApp fica criptografado: busque pelo número completo.
            </Text>
            {q.isLoading ? <Carregando /> : null}
            {q.error ? <Aviso>{(q.error as Error).message}</Aviso> : null}
          </View>
        }
        ListEmptyComponent={q.data ? <Vazio texto="Ninguém encontrado." /> : null}
        renderItem={({ item: u }) => (
          <Cartao style={{ gap: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: cores.texto }}>{u.nome} {u.sobrenome}</Text>
            <Info rotulo="WhatsApp">
              <Pressable onPress={() => Linking.openURL(`https://wa.me/55${u.whatsapp}`)}>
                <Text style={{ color: cores.primaria, textDecorationLine: 'underline' }}>{u.whatsapp}</Text>
              </Pressable>
            </Info>
            <Info rotulo="Cupons">{numero(u.cupons)}</Info>
            <Info rotulo="Total ofertado">{moeda(u.total)}</Info>
            <Info rotulo="Cadastro">{data(u.criadoEm)}</Info>
          </Cartao>
        )}
      />
    </View>
  );
}
