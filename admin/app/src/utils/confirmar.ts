import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';

/** Pergunta "sim ou não" (Alert no celular, confirm na web). */
export function confirmar(titulo: string, mensagem?: string, textoSim = 'Confirmar', perigo = false): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(mensagem ? `${titulo}\n\n${mensagem}` : titulo));
  return new Promise((resolve) =>
    Alert.alert(titulo, mensagem, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: textoSim, style: perigo ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}

/** Volta uma tela; se não houver histórico (link direto), vai para o início. */
export function voltar() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
