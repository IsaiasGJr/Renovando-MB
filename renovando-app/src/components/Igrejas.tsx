import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';

import { cores } from '@/theme';
import { Imagem } from '@/components/Imagem';

/** Logo da igreja (ou a inicial, se não tiver logo cadastrada). */
export function LogoIgreja({ nome, logoUrl, tamanho = 48 }: { nome: string; logoUrl?: string; tamanho?: number }) {
  if (logoUrl) {
    return (
      <Imagem url={logoUrl} rotulo={`Logo da ${nome}`}
        style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cores.superficie }} />
    );
  }
  const inicial = nome.replace(/^(igreja|comunidade|minist[eé]rio|assembleia)\s+(de\s+|do\s+|da\s+)?/i, '').charAt(0).toUpperCase() || nome.charAt(0);
  return (
    <View style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cores.primariaClara, alignItems: 'center', justifyContent: 'center' }}>
      {inicial ? (
        <Text style={{ color: cores.primaria, fontWeight: '900', fontSize: tamanho * 0.4 }}>{inicial}</Text>
      ) : (
        <Ionicons name="business" size={tamanho * 0.45} color={cores.primaria} />
      )}
    </View>
  );
}
