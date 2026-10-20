import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '@/api';
import { Aviso, Botao, Campo, Cartao, Tela } from '@/components/ui';
import { cores, espaco } from '@/theme';
import { confirmar, voltar } from '@/utils/confirmar';
import { soDigitos } from '@/utils/format';

type Resultado = { ganhadorNumero: string; ganhadorNome: string; ganhadorCidade: string };

export default function Sorteio() {
  const { id, nome } = useLocalSearchParams<{ id: string; nome?: string }>();
  const qc = useQueryClient();
  const [numero, setNumero] = useState('');
  const sortear = useMutation({
    mutationFn: (n?: string) => api<Resultado>(`/premios/${id}/sortear`, { method: 'POST', json: n ? { numero: n } : {} }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['premios'] }), qc.invalidateQueries({ queryKey: ['dashboard'] })),
  });
  const r = sortear.data;

  return (
    <Tela bordas={['bottom']}>
      <Stack.Screen options={{ title: nome ? `Sortear: ${nome}` : 'Sorteio' }} />
      {r ? (
        <View style={{ alignItems: 'center', gap: espaco.md, paddingTop: espaco.xl }}>
          <Ionicons name="trophy" size={56} color={cores.destaque} />
          <Text style={{ color: cores.textoSuave }}>Número sorteado</Text>
          <Text style={{ fontSize: 48, fontWeight: '800', color: cores.primaria, letterSpacing: 4 }}>{r.ganhadorNumero}</Text>
          <Text style={{ fontSize: 18, color: cores.texto, textAlign: 'center' }}>{r.ganhadorNome} · {r.ganhadorCidade}</Text>
          <Aviso>O resultado já aparece no app. Entre em contato com o ganhador pelo WhatsApp (veja em Relatórios ou Ofertantes).</Aviso>
          <Botao titulo="Concluir" onPress={voltar} style={{ alignSelf: 'stretch' }} />
        </View>
      ) : (
        <>
          {sortear.error ? <Aviso>{(sortear.error as Error).message}</Aviso> : null}
          <Cartao>
            <Text style={{ fontSize: 16, fontWeight: '700', color: cores.texto }}>Informar o número sorteado</Text>
            <Text style={{ color: cores.textoSuave, lineHeight: 20 }}>
              Use quando o resultado vem de uma fonte externa auditável, como a extração da Loteria Federal.
            </Text>
            <Campo rotulo="Número" value={numero} keyboardType="number-pad" maxLength={6} placeholder="000000"
              onChangeText={(t) => setNumero(soDigitos(t))} style={{ fontSize: 24, letterSpacing: 6, textAlign: 'center' }} />
            <Botao titulo="Confirmar número" desabilitado={!numero} carregando={sortear.isPending && !!sortear.variables}
              onPress={() => sortear.mutate(numero)} />
          </Cartao>
          <Cartao>
            <Text style={{ fontSize: 16, fontWeight: '700', color: cores.texto }}>Sorteio pelo sistema</Text>
            <Text style={{ color: cores.textoSuave, lineHeight: 20 }}>
              Escolhe aleatoriamente um cupom pago desta campanha que ainda não ganhou.
            </Text>
            <Botao titulo="Sortear aleatoriamente" variante="contorno" icone="shuffle"
              carregando={sortear.isPending && !sortear.variables}
              onPress={async () => (await confirmar('Realizar o sorteio agora?', 'O resultado aparece no app imediatamente.', 'Sortear')) && sortear.mutate(undefined)} />
          </Cartao>
        </>
      )}
    </Tela>
  );
}
