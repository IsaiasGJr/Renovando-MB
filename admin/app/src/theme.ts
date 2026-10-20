import { Platform, type ViewStyle } from 'react-native';

export const cores = {
  primaria: '#6E1A5D',
  primariaEscura: '#5C0047',
  primariaProfunda: '#36002A',
  primariaClara: '#F5E8F1',
  primariaSuave: '#E9D2E2',
  destaque: '#E9A23B',
  destaqueEscuro: '#B97814',
  destaqueClaro: '#FDF1DC',
  fundo: '#F7F3F5',
  superficie: '#FFFFFF',
  texto: '#1F1A1D',
  textoSuave: '#6E6470',
  textoFraco: '#9A909C',
  borda: '#ECE4E9',
  sucesso: '#1E8E5A',
  sucessoClaro: '#E5F5EC',
  erro: '#C0392B',
  aviso: '#9A6B00',
  avisoClaro: '#FFF4D6',
};

/** Gradiente da marca: as mesmas cores da logo oficial (#7E276A → #5C0047). */
export const gradienteMarca = ['#7E276A', '#5C0047'] as const;
/** Gradiente dourado (prêmio principal). */
export const gradienteOuro = ['#F2B65A', '#D98E1F'] as const;

export const espaco = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const raio = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

/** Sombra suave (em vez de borda) para cartões e barras. */
export function sombra(nivel: 1 | 2 | 3 = 1): ViewStyle {
  const y = [0, 2, 6, 12][nivel];
  const blur = [0, 8, 16, 28][nivel];
  const op = [0, 0.06, 0.1, 0.16][nivel];
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0 ${y}px ${blur}px rgba(92, 0, 71, ${op})` } as ViewStyle,
    default: {
      shadowColor: '#5C0047',
      shadowOpacity: op,
      shadowRadius: blur / 2,
      shadowOffset: { width: 0, height: y },
      elevation: nivel * 2,
    },
  })!;
}

export const tipografia = {
  sobretitulo: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  titulo: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.4 },
  secao: { fontSize: 19, fontWeight: '800' as const, letterSpacing: -0.2 },
};
