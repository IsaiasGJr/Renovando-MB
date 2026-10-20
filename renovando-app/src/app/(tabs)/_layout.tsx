import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { cores, sombra } from '@/theme';

type Icone = ComponentProps<typeof Ionicons>['name'];

function icone(nome: Icone) {
  return function IconeAba({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={nome} size={size} color={color} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.primaria,
        tabBarInactiveTintColor: cores.textoFraco,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: { borderTopWidth: 0, ...sombra(2) },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icone('home') }} />
      <Tabs.Screen name="premios" options={{ title: 'Prêmios', tabBarIcon: icone('gift') }} />
      <Tabs.Screen name="igrejas" options={{ title: 'Igrejas', tabBarIcon: icone('business') }} />
      <Tabs.Screen name="cupons" options={{ title: 'Meus cupons', tabBarIcon: icone('ticket') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Mais', tabBarIcon: icone('menu') }} />
    </Tabs>
  );
}
