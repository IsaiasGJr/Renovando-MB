import { Text, View } from 'react-native';
import { cores, espaco } from '@/theme';

/**
 * Mostra textos simples editados no admin:
 * "## Título" vira subtítulo, "- item" vira lista e linhas em branco separam parágrafos.
 */
export function TextoFormatado({ texto }: { texto: string }) {
  const blocos = texto.replace(/\r/g, '').split(/\n\s*\n/).filter((b) => b.trim());
  return (
    <View style={{ gap: espaco.md }}>
      {blocos.map((bloco, i) => {
        const linhas = bloco.split('\n').filter((l) => l.trim());
        return (
          <View key={i} style={{ gap: 6 }}>
            {linhas.map((l, j) => {
              if (l.startsWith('## ')) {
                return <Text key={j} style={{ fontSize: 18, fontWeight: '800', color: cores.texto, marginTop: i ? 6 : 0 }}>{l.slice(3)}</Text>;
              }
              if (/^[-•] /.test(l)) {
                return (
                  <View key={j} style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ color: cores.primaria, fontSize: 15 }}>•</Text>
                    <Text style={{ flex: 1, color: cores.texto, fontSize: 15, lineHeight: 22 }}>{l.slice(2)}</Text>
                  </View>
                );
              }
              return <Text key={j} style={{ color: cores.texto, fontSize: 15, lineHeight: 23 }}>{l}</Text>;
            })}
          </View>
        );
      })}
    </View>
  );
}
