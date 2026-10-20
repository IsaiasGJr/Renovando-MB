import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cores, espaco, gradienteMarca, raio, sombra } from '@/theme';

type Icone = ComponentProps<typeof Ionicons>['name'];

const COR_STATUS: Record<string, 'ok' | 'aviso' | 'erro'> = {
  ativa: 'ok', ativo: 'ok', paga: 'ok', publicada: 'ok', fechada: 'ok',
  pendente: 'aviso', aguardando_pagamento: 'aviso', nova: 'aviso', em_contato: 'aviso', rascunho: 'aviso',
  rejeitada: 'erro', rejeitado: 'erro', expirada: 'erro', cancelada: 'erro', descartada: 'erro',
};
const ROTULO_STATUS: Record<string, string> = {
  aguardando_pagamento: 'Aguardando', em_contato: 'Em contato', nova: 'Novo',
};

/** Selo de situação: sempre com texto, a cor só reforça. */
export function Selo({ status, texto }: { status: string; texto?: string }) {
  const tipo = COR_STATUS[status];
  const fundo = tipo === 'ok' ? cores.sucessoClaro : tipo === 'aviso' ? cores.avisoClaro : tipo === 'erro' ? '#FDECEB' : '#EEE8EC';
  const cor = tipo === 'ok' ? cores.sucesso : tipo === 'aviso' ? cores.aviso : tipo === 'erro' ? cores.erro : cores.textoSuave;
  const rotulo = texto ?? ROTULO_STATUS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <View style={{ backgroundColor: fundo, borderRadius: raio.pill, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: cor, fontSize: 12, fontWeight: '700' }}>{rotulo}</Text>
    </View>
  );
}

/** Fileira rolável de opções (filtros). */
export function Chips<T extends string>({ opcoes, valor, onChange }: {
  opcoes: { valor: T; rotulo: string }[]; valor: T; onChange: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espaco.xs }}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <Pressable key={o.valor} onPress={() => onChange(o.valor)} accessibilityRole="button" accessibilityState={{ selected: ativo }}
            style={{
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: raio.pill, borderWidth: 1,
              borderColor: ativo ? cores.primaria : cores.borda, backgroundColor: ativo ? cores.primaria : cores.superficie,
            }}>
            <Text style={{ color: ativo ? '#fff' : cores.texto, fontWeight: '600', fontSize: 14 }}>{o.rotulo}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Kpi({ rotulo, valor, detalhe, icone, destaque }: {
  rotulo: string; valor: string; detalhe?: string; icone?: Icone; destaque?: boolean;
}) {
  const conteudo = (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <Text style={{ color: destaque ? '#EBD5E2' : cores.textoSuave, fontSize: 12, flexShrink: 1 }}>{rotulo}</Text>
        {icone ? (
          <View style={{
            width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
            backgroundColor: destaque ? 'rgba(255,255,255,0.15)' : cores.primariaClara,
          }}>
            <Ionicons name={icone} size={16} color={destaque ? cores.destaque : cores.primaria} />
          </View>
        ) : null}
      </View>
      <Text style={{ color: destaque ? '#fff' : cores.texto, fontSize: 20, fontWeight: '900', marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      {detalhe ? <Text style={{ color: destaque ? '#EBD5E2' : cores.textoSuave, fontSize: 11 }} numberOfLines={2}>{detalhe}</Text> : null}
    </>
  );
  const base = { flexGrow: 1, flexBasis: '45%' as const, borderRadius: raio.lg, padding: espaco.md, gap: 2, ...sombra(1) };
  return destaque ? (
    <LinearGradient colors={[...gradienteMarca]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={base}>{conteudo}</LinearGradient>
  ) : (
    <View style={[base, { backgroundColor: cores.superficie }]}>{conteudo}</View>
  );
}

export function GradeKpi({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm }}>{children}</View>;
}

/** Linha "rótulo ........ valor" dentro de um cartão de lista. */
export function Info({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espaco.md }}>
      <Text style={{ color: cores.textoSuave, fontSize: 13 }}>{rotulo}</Text>
      <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>
        {typeof children === 'string' || typeof children === 'number'
          ? <Text style={{ color: cores.texto, fontSize: 14, textAlign: 'right' }}>{children}</Text>
          : children}
      </View>
    </View>
  );
}

export function Vazio({ texto, icone = 'file-tray-outline' }: { texto: string; icone?: Icone }) {
  return (
    <View style={{ alignItems: 'center', padding: espaco.xxl, gap: espaco.sm }}>
      <Ionicons name={icone} size={40} color={cores.borda} />
      <Text style={{ color: cores.textoSuave, textAlign: 'center' }}>{texto}</Text>
    </View>
  );
}

/** Botão flutuante "+" no canto da tela. */
export function BotaoNovo({ onPress, rotulo }: { onPress: () => void; rotulo: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={rotulo}
      style={({ pressed }) => ({
        position: 'absolute', right: espaco.lg, bottom: espaco.lg, flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: cores.primaria, paddingHorizontal: 18, height: 52, borderRadius: 26, opacity: pressed ? 0.85 : 1,
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5,
      })}>
      <Ionicons name="add" size={22} color="#fff" />
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{rotulo}</Text>
    </Pressable>
  );
}

/** Item de menu com ícone, texto, contador e seta. */
export function ItemMenu({ icone, texto, contador, onPress }: { icone: Icone; texto: string; contador?: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: espaco.md, paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name={icone} size={21} color={cores.primaria} />
      <Text style={{ flex: 1, color: cores.texto, fontSize: 16 }}>{texto}</Text>
      {contador ? (
        <View style={{ backgroundColor: cores.destaque, borderRadius: raio.pill, minWidth: 22, paddingHorizontal: 7, paddingVertical: 2, alignItems: 'center' }}>
          <Text style={{ color: '#2B1A00', fontWeight: '800', fontSize: 12 }}>{contador}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={cores.textoSuave} />
    </Pressable>
  );
}
