import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { cores, espaco, raio, sombra, tipografia } from '@/theme';

export function Tela({
  children,
  bordas = ['top'],
  rolar = true,
  rodape,
}: {
  children: ReactNode;
  bordas?: Edge[];
  rolar?: boolean;
  rodape?: ReactNode;
}) {
  return (
    <SafeAreaView style={s.tela} edges={bordas}>
      {rolar ? (
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[s.conteudo, { flex: 1 }]}>{children}</View>
      )}
      {rodape ? <View style={s.rodape}>{rodape}</View> : null}
    </SafeAreaView>
  );
}

type Variante = 'primario' | 'secundario' | 'contorno' | 'texto';

export function Botao({
  titulo,
  onPress,
  variante = 'primario',
  carregando,
  desabilitado,
  icone,
  corTexto: corTextoProp,
  style,
}: {
  titulo: string;
  onPress?: () => void;
  variante?: Variante;
  carregando?: boolean;
  desabilitado?: boolean;
  icone?: ComponentProps<typeof Ionicons>['name'];
  corTexto?: string;
  style?: ViewStyle;
}) {
  const inativo = desabilitado || carregando;
  const corTexto = corTextoProp ?? (variante === 'primario' ? '#fff' : cores.primaria);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inativo}
      style={({ pressed }) => [
        s.botao,
        s[`botao_${variante}`],
        variante === 'primario' && !inativo ? sombra(1) : null,
        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
        inativo && { opacity: 0.45 },
        style,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={corTexto} />
      ) : (
        <>
          {icone ? <Ionicons name={icone} size={18} color={corTexto} /> : null}
          <Text style={[s.botaoTexto, { color: corTexto }]}>{titulo}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Campo({
  rotulo,
  erro,
  ajuda,
  ...props
}: TextInputProps & { rotulo: string; erro?: string; ajuda?: string }) {
  return (
    <View style={{ gap: espaco.xs }}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <TextInput
        placeholderTextColor={cores.textoSuave}
        {...props}
        style={[s.input, erro ? { borderColor: cores.erro } : null, props.style]}
      />
      {erro ? <Text style={s.erro}>{erro}</Text> : ajuda ? <Text style={s.ajuda}>{ajuda}</Text> : null}
    </View>
  );
}

export function Cartao({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.cartao, style]}>{children}</View>;
}

export function Titulo({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <View style={{ gap: espaco.xs }}>
      <Text style={s.titulo}>{children}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );
}

export function Contador({
  valor,
  onChange,
  min = 1,
  max = 500,
}: {
  valor: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <View style={s.contador}>
      <Pressable
        accessibilityLabel="Diminuir"
        style={s.contadorBotao}
        onPress={() => onChange(Math.max(min, valor - 1))}
        disabled={valor <= min}
      >
        <Ionicons name="remove" size={22} color={valor <= min ? cores.borda : cores.primaria} />
      </Pressable>
      <Text style={s.contadorValor}>{valor}</Text>
      <Pressable
        accessibilityLabel="Aumentar"
        style={s.contadorBotao}
        onPress={() => onChange(Math.min(max, valor + 1))}
        disabled={valor >= max}
      >
        <Ionicons name="add" size={22} color={cores.primaria} />
      </Pressable>
    </View>
  );
}

export function Aviso({ children, tipo = 'aviso' }: { children: ReactNode; tipo?: 'aviso' | 'sucesso' }) {
  const fundo = tipo === 'sucesso' ? cores.sucessoClaro : cores.avisoClaro;
  const cor = tipo === 'sucesso' ? cores.sucesso : cores.aviso;
  return (
    <View style={[s.aviso, { backgroundColor: fundo }]}>
      <Ionicons name={tipo === 'sucesso' ? 'checkmark-circle' : 'information-circle'} size={18} color={cor} />
      <Text style={{ color: cor, flex: 1, fontSize: 13, lineHeight: 18 }}>{children}</Text>
    </View>
  );
}

export function Carregando() {
  return (
    <View style={{ padding: espaco.xxl, alignItems: 'center' }}>
      <ActivityIndicator color={cores.primaria} />
    </View>
  );
}

export const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.lg, paddingBottom: espaco.xxl },
  rodape: {
    padding: espaco.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  botao: {
    minHeight: 52,
    borderRadius: raio.md,
    paddingHorizontal: espaco.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.sm,
  },
  botao_primario: { backgroundColor: cores.primaria },
  botao_secundario: { backgroundColor: cores.primariaClara },
  botao_contorno: { borderWidth: 1.5, borderColor: cores.primariaSuave, backgroundColor: cores.superficie },
  botao_texto: { minHeight: 40 },
  botaoTexto: { fontSize: 16, fontWeight: '700', letterSpacing: 0.1 },
  rotulo: { fontSize: 14, fontWeight: '600', color: cores.texto },
  input: {
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: cores.borda,
    borderRadius: raio.md,
    paddingHorizontal: espaco.md,
    fontSize: 16,
    backgroundColor: cores.superficie,
    color: cores.texto,
  },
  erro: { color: cores.erro, fontSize: 13 },
  ajuda: { color: cores.textoSuave, fontSize: 13 },
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: raio.lg,
    padding: espaco.lg + 2,
    gap: espaco.sm,
    ...sombra(1),
  },
  titulo: { ...tipografia.titulo, color: cores.texto },
  sub: { fontSize: 15, color: cores.textoSuave, lineHeight: 21 },
  contador: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: raio.pill,
    backgroundColor: cores.primariaClara,
    padding: 4,
  },
  contadorBotao: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.superficie,
  },
  contadorValor: { minWidth: 44, textAlign: 'center', fontSize: 20, fontWeight: '700', color: cores.texto },
  aviso: {
    flexDirection: 'row',
    gap: espaco.sm,
    padding: espaco.md,
    borderRadius: raio.md,
    alignItems: 'flex-start',
  },
});
