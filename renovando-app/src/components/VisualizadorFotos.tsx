import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StatusBar, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Imagem } from '@/components/Imagem';

/** Fotos em tela cheia, inteiras (sem corte), passando para o lado. */
export function VisualizadorFotos({ fotos, inicio, onFechar }: { fotos: string[]; inicio: number | null; onFechar: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [atual, setAtual] = useState(0);
  const aberto = inicio !== null;

  return (
    <Modal visible={aberto} animationType="fade" onRequestClose={onFechar} onShow={() => setAtual(inicio ?? 0)} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {aberto ? (
          <FlatList
            data={fotos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={inicio}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={(e) => setAtual(Math.round(e.nativeEvent.contentOffset.x / width))}
            keyExtractor={(u) => u}
            renderItem={({ item }) => <Imagem url={item} ajuste="contain" style={{ width, height }} />}
          />
        ) : null}
        <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{atual + 1} / {fotos.length}</Text>
          <Pressable onPress={onFechar} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={12}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
