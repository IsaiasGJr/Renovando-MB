import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { baixarAnexo } from '@/api';
import { cores, raio } from '@/theme';

/** Botões para baixar os anexos de uma mensagem (abre o menu de compartilhar do celular). */
export function Anexos({ anexos }: { anexos: { arquivo: string; nome: string }[] }) {
  const [erro, setErro] = useState('');
  return (
    <View style={{ gap: 4, alignItems: 'flex-end' }}>
      {anexos.map((a) => (
        <Pressable key={a.arquivo} onPress={() => baixarAnexo(a.arquivo, a.nome).catch((e) => setErro((e as Error).message))}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: cores.primariaClara, borderRadius: raio.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Ionicons name={a.arquivo.endsWith('.pdf') ? 'document-text' : 'image'} size={14} color={cores.primaria} />
          <Text style={{ color: cores.primaria, fontWeight: '600', fontSize: 12 }} numberOfLines={1}>{a.nome}</Text>
        </Pressable>
      ))}
      {erro ? <Text style={{ color: cores.erro, fontSize: 12 }}>{erro}</Text> : null}
    </View>
  );
}
