import { Image, type ImageContentFit, type ImageContentPosition, type ImageStyle } from 'expo-image';
import { memo } from 'react';
import type { StyleProp } from 'react-native';
import { urlImagem } from '@/api';

type Props = {
  /** Caminho do banco (/uploads/...) ou URL completa. */
  url?: string;
  style?: StyleProp<ImageStyle>;
  ajuste?: ImageContentFit;
  rotulo?: string;
  /** Qual parte fica visível quando a foto é cortada. Retratos: 'top' (preserva o rosto). */
  posicao?: ImageContentPosition;
};

/**
 * Imagem com cache em memória e em disco (expo-image): abre de novo sem baixar,
 * decodifica fora da thread da interface e aparece com um fade curto.
 * As imagens enviadas nunca mudam de conteúdo (cada envio tem um nome novo), então o cache é seguro.
 */
export const Imagem = memo(function Imagem({ url, style, ajuste = 'cover', rotulo, posicao = 'center' }: Props) {
  return (
    <Image
      source={urlImagem(url)}
      style={style}
      contentFit={ajuste}
      contentPosition={posicao}
      cachePolicy="memory-disk"
      transition={150}
      recyclingKey={url}
      accessibilityLabel={rotulo}
      accessible={!!rotulo}
    />
  );
});
