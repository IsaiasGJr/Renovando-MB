import { executar, todos } from './db.ts';

/**
 * Avisos no celular (notificações), pelo serviço gratuito da Expo.
 * Os celulares se cadastram em /api/dispositivos quando a pessoa aceita receber avisos.
 * Opcional: EXPO_ACCESS_TOKEN no .env (se "Enhanced push security" estiver ligado no projeto da Expo).
 */

export type Aviso = {
  titulo: string;
  mensagem: string;
  /** Tela do app que abre ao tocar no aviso (ex.: "/premios"). */
  rota?: string;
};

export const TOKEN_VALIDO = /^Expo(nent)?PushToken\[[\w-]+\]$/;

const URL_EXPO = 'https://exp.host/--/api/v2/push/send';

/** Envia o aviso para todos os celulares cadastrados (ou só para os destas contas). */
export async function enviarAviso(aviso: Aviso, usuarioIds?: string[]) {
  const tokens = usuarioIds
    ? usuarioIds.length
      ? todos<{ token: string }>(`SELECT token FROM dispositivos WHERE usuario_id IN (${usuarioIds.map(() => '?').join(',')})`, ...usuarioIds)
      : []
    : todos<{ token: string }>('SELECT token FROM dispositivos');
  let enviados = 0, falhas = 0;

  // A Expo aceita até 100 mensagens por chamada.
  for (let i = 0; i < tokens.length; i += 100) {
    const lote = tokens.slice(i, i + 100).map((t) => t.token);
    const mensagens = lote.map((to) => ({
      to, title: aviso.titulo, body: aviso.mensagem, sound: 'default', channelId: 'avisos', priority: 'high',
      data: aviso.rota ? { rota: aviso.rota } : {},
    }));
    try {
      const r = await fetch(URL_EXPO, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', Accept: 'application/json',
          ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(mensagens),
        signal: AbortSignal.timeout(15_000),
      });
      const resposta = (await r.json().catch(() => ({}))) as { data?: { status: string; details?: { error?: string } }[] };
      (resposta.data ?? []).forEach((t, j) => {
        if (t.status === 'ok') enviados++;
        else {
          falhas++;
          // Celular que desinstalou o app ou desligou os avisos: sai da lista.
          if (t.details?.error === 'DeviceNotRegistered') executar('DELETE FROM dispositivos WHERE token = ?', lote[j]);
        }
      });
      if (!resposta.data) falhas += lote.length;
    } catch {
      falhas += lote.length;
    }
  }
  return { dispositivos: tokens.length, enviados, falhas };
}
