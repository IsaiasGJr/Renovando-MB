import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { BASE_URL } from '@/api';
import { useAuth } from '@/store/auth';

/**
 * Avisos no celular (resultado e lembrete do sorteio, novidades).
 *
 * O Expo Go NÃO suporta notificações (desde o SDK 53): só carregar o "expo-notifications" lá já dá erro
 * e o app não abre. Por isso o módulo é carregado só quando o app roda instalado de verdade
 * (build do EAS) e nunca na web nem no Expo Go.
 */
export const avisosDisponiveis =
  Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

type Modulo = typeof import('expo-notifications');
let modulo: Promise<Modulo> | null = null;
function notificacoes(): Promise<Modulo> | null {
  if (!avisosDisponiveis) return null;
  if (!modulo) {
    modulo = import('expo-notifications').then((N) => {
      // Mostra o aviso mesmo com o app aberto.
      N.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
      });
      return N;
    });
  }
  return modulo;
}

export type ResultadoAvisos = 'ativado' | 'negado' | 'indisponivel';

/** Os avisos já estão permitidos neste celular? */
export async function avisosPermitidos() {
  const N = await notificacoes();
  if (!N) return null;
  return (await N.getPermissionsAsync()).status === 'granted';
}

/**
 * Cadastra este celular para receber os avisos.
 * `pedir: false` só renova o cadastro se a pessoa já tiver aceitado antes (não mostra pergunta).
 */
export async function ativarAvisos({ pedir }: { pedir: boolean }): Promise<ResultadoAvisos> {
  if (!Device.isDevice) return 'indisponivel';
  try {
    const N = await notificacoes();
    if (!N) return 'indisponivel';
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('avisos', {
        name: 'Avisos do sorteio',
        importance: N.AndroidImportance.HIGH,
        lightColor: '#6E1A5D',
      });
    }
    let { status } = await N.getPermissionsAsync();
    if (status !== 'granted') {
      if (!pedir) return 'negado';
      status = (await N.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return 'negado';

    // O token precisa do id do projeto na Expo (criado com "eas init": extra.eas.projectId).
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return 'indisponivel';
    const { data: token } = await N.getExpoPushTokenAsync({ projectId });

    const sessao = useAuth.getState().token;
    await fetch(`${BASE_URL}/api/dispositivos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(sessao ? { Authorization: `Bearer ${sessao}` } : {}) },
      body: JSON.stringify({ token, plataforma: Platform.OS }),
    });
    return 'ativado';
  } catch {
    return 'indisponivel';
  }
}

/**
 * Chama `abrir(rota)` quando a pessoa toca num aviso (inclusive o que abriu o app).
 * Retorna a função que cancela.
 */
export function aoTocarNoAviso(abrir: (rota: string) => void) {
  let cancelar = () => {};
  let ativo = true;
  const N = notificacoes();
  if (!N) return cancelar;
  void N.then((m) => {
    if (!ativo) return;
    const tratar = (r: { notification: { request: { content: { data?: Record<string, unknown> } } } } | null) => {
      const rota = r?.notification.request.content.data?.rota;
      // Só caminhos internos do app.
      if (typeof rota === 'string' && rota.startsWith('/') && !rota.startsWith('//')) abrir(rota);
    };
    void m.getLastNotificationResponseAsync().then(tratar);
    const assinatura = m.addNotificationResponseReceivedListener(tratar);
    cancelar = () => assinatura.remove();
  });
  return () => {
    ativo = false;
    cancelar();
  };
}
