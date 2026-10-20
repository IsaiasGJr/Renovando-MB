import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { BASE_URL } from '@/api';
import { useAuth } from '@/store/auth';

// Mostra o aviso mesmo com o app aberto.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export type ResultadoAvisos = 'ativado' | 'negado' | 'indisponivel';

/**
 * Cadastra este celular para receber os avisos (resultado e lembrete do sorteio, novidades).
 * `pedir: false` só renova o cadastro se a pessoa já tiver aceitado antes (não mostra pergunta).
 */
export async function ativarAvisos({ pedir }: { pedir: boolean }): Promise<ResultadoAvisos> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'indisponivel';
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('avisos', {
        name: 'Avisos do sorteio',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#6E1A5D',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      if (!pedir) return 'negado';
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return 'negado';

    // O token precisa do id do projeto na Expo (definido ao gerar o app com EAS: extra.eas.projectId).
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return 'indisponivel';
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

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

/** Rota do app que o aviso pede para abrir (só caminhos internos). */
export function rotaDoAviso(resposta: Notifications.NotificationResponse | null) {
  const rota = resposta?.notification.request.content.data?.rota;
  return typeof rota === 'string' && rota.startsWith('/') && !rota.startsWith('//') ? rota : null;
}
