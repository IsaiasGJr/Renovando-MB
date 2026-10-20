import { router } from 'expo-router';

/** Volta uma tela; se a tela foi aberta por link direto (sem histórico), vai para o início. */
export function voltar() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
