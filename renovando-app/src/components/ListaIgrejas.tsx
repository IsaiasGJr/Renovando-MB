import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { api } from '@/api';
import { Carregando, s as ui } from '@/components/ui';
import type { Igreja } from '@/types';
import { router } from 'expo-router';
import { LogoIgreja } from '@/components/Igrejas';
import { cores, espaco, raio, sombra } from '@/theme';

/** Minúsculas e sem acento: "São" encontra "sao". */
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Busca + lista de igrejas ativas. Com `onSelecionar`, vira um seletor. */
export function ListaIgrejas({
  selecionada,
  onSelecionar,
}: {
  selecionada?: string;
  onSelecionar?: (i: Igreja) => void;
}) {
  const [busca, setBusca] = useState('');
  // Baixa a lista uma vez (a mesma do início) e filtra aqui: digitar não faz nenhuma chamada à API.
  const { data: todas, isLoading } = useQuery({ queryKey: ['igrejas', ''], queryFn: () => api.igrejas('') });
  const termo = useDeferredValue(normalizar(busca.trim()));
  const indexadas = useMemo(() => todas?.map((i) => ({ i, texto: normalizar(`${i.nome} ${i.cidade} ${i.uf}`) })), [todas]);
  const data = useMemo(
    () => (termo ? indexadas?.filter((x) => x.texto.includes(termo)) : indexadas)?.map((x) => x.i),
    [indexadas, termo],
  );

  return (
    <View style={{ gap: espaco.sm }}>
      <View style={{ justifyContent: 'center' }}>
        <Ionicons name="search" size={18} color={cores.textoSuave} style={{ position: 'absolute', left: 12, zIndex: 1 }} />
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por nome ou cidade"
          placeholderTextColor={cores.textoSuave}
          style={[ui.input, { paddingLeft: 38 }]}
        />
      </View>
      {isLoading ? <Carregando /> : null}
      {data?.length === 0 ? (
        <Text style={{ color: cores.textoSuave, textAlign: 'center', padding: espaco.lg }}>
          Nenhuma igreja encontrada.
        </Text>
      ) : null}
      {data?.map((i) => {
        const ativa = i.id === selecionada;
        return (
          <Pressable
            key={i.id}
            onPress={() => (onSelecionar ? onSelecionar(i) : i.slug && router.push({ pathname: '/igreja/[slug]', params: { slug: i.slug } }))}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: espaco.md,
              padding: espaco.md,
              borderRadius: raio.md,
              backgroundColor: cores.superficie,
              borderWidth: ativa ? 2 : 0,
              borderColor: ativa ? cores.primaria : 'transparent',
              ...sombra(1),
            }}
          >
            <LogoIgreja nome={i.nome} logoUrl={i.logoUrl} tamanho={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', color: cores.texto }}>{i.nome}</Text>
              <Text style={{ color: cores.textoSuave, fontSize: 13 }}>
                {i.cidade}/{i.uf}
              </Text>
            </View>
            {onSelecionar ? (
              <Ionicons
                name={ativa ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={ativa ? cores.primaria : cores.borda}
              />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={cores.textoFraco} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
