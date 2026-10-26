import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Cartao, Tela, s as ui } from '@/components/ui';
import { GUIAS } from '@/guias';
import { cores, espaco } from '@/theme';

/** Central de ajuda: passo a passo das tarefas do admin. */
export default function Ajuda() {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const termo = busca.trim().toLowerCase();
  const lista = useMemo(
    () => (termo ? GUIAS.filter((g) => `${g.titulo} ${g.grupo} ${g.passos.join(' ')}`.toLowerCase().includes(termo)) : GUIAS),
    [termo],
  );
  return (
    <Tela bordas={['bottom']}>
      <TextInput value={busca} onChangeText={setBusca} placeholder="Buscar (ex.: sorteio, panfleto, repasse)"
        placeholderTextColor={cores.textoSuave} style={ui.input} accessibilityLabel="Buscar na ajuda" />
      {lista.map((g) => {
        const ativo = aberto === g.titulo || !!termo;
        return (
          <Pressable key={g.titulo} onPress={() => setAberto(ativo && !termo ? null : g.titulo)} accessibilityRole="button" accessibilityState={{ expanded: ativo }}>
            <Cartao style={{ gap: espaco.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espaco.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: cores.textoSuave, fontSize: 12 }}>{g.grupo}</Text>
                  <Text style={{ fontWeight: '700', color: cores.texto, fontSize: 15 }}>{g.titulo}</Text>
                </View>
                <Ionicons name={ativo ? 'chevron-up' : 'chevron-down'} size={18} color={cores.textoSuave} />
              </View>
              {ativo ? g.passos.map((p, i) => (
                <Text key={p} style={{ color: cores.texto, lineHeight: 21 }}>{i + 1}. {p}</Text>
              )) : null}
            </Cartao>
          </Pressable>
        );
      })}
    </Tela>
  );
}
