import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useDashboard } from '@/tipos';
import { cores, sombra } from '@/theme';

type Icone = ComponentProps<typeof Ionicons>['name'];

function icone(nome: Icone) {
  return function IconeAba({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={nome} size={size} color={color} />;
  };
}

export default function Abas() {
  const { data } = useDashboard();
  const p = data?.pendencias;
  const pendentes = (p?.igrejas ?? 0) + (p?.semeadores ?? 0) + (p?.shows ?? 0);

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: cores.primaria,
      tabBarInactiveTintColor: cores.textoFraco,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      tabBarStyle: { borderTopWidth: 0, ...sombra(2) },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icone('stats-chart') }} />
      <Tabs.Screen name="relatorios" options={{ title: 'Relatórios', tabBarIcon: icone('document-text') }} />
      <Tabs.Screen
        name="cadastros"
        options={{
          title: 'Cadastros',
          tabBarIcon: icone('albums'),
          tabBarBadge: pendentes || undefined,
          tabBarBadgeStyle: { backgroundColor: cores.destaque, color: '#2B1A00' },
        }}
      />
      <Tabs.Screen name="conta" options={{ title: 'Conta', tabBarIcon: icone('person-circle') }} />
    </Tabs>
  );
}
