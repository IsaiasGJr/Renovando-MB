import { Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { LOGO_BRANCA, LOGO_COR } from '@/components/logoSvg';
import { cores } from '@/theme';

/** Logo oficial (cacho de uva). `claro` = versão branca, para fundos escuros. */
export function Simbolo({ tamanho = 40, claro = false }: { tamanho?: number; claro?: boolean }) {
  // Proporção original da logo: 55 x 76.
  return <SvgXml xml={claro ? LOGO_BRANCA : LOGO_COR} width={tamanho * 0.72} height={tamanho} accessibilityLabel="Renovando a Vinha do Senhor" />;
}

/** Logo + nome. */
export function Marca({ subtitulo, claro = false }: { subtitulo?: string; claro?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Simbolo tamanho={40} claro={claro} />
      <View>
        <Text style={{ fontSize: 18, fontWeight: '800', color: claro ? '#fff' : cores.primariaEscura, letterSpacing: -0.3 }}>Renovando</Text>
        {subtitulo ? (
          <Text style={{ fontSize: 12, fontWeight: '600', color: claro ? cores.destaque : cores.textoSuave }}>{subtitulo}</Text>
        ) : null}
      </View>
    </View>
  );
}
