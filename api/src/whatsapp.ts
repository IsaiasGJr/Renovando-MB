import { ErroHttp } from '../../compartilhado/src/util.ts';

/**
 * Envio do código de login pela WhatsApp Cloud API (Meta).
 *
 * Precisa de um modelo de mensagem da categoria AUTENTICAÇÃO aprovado no WhatsApp Manager
 * (ex.: "codigo_login", em português), com o botão "Copiar código". Configuração no .env da API:
 *   WHATSAPP_TOKEN        token de acesso permanente (usuário do sistema no Meta Business)
 *   WHATSAPP_NUMERO_ID    "Phone number ID" do número que envia
 *   WHATSAPP_MODELO       nome do modelo aprovado (padrão: codigo_login)
 *   WHATSAPP_IDIOMA       idioma do modelo (padrão: pt_BR)
 *   WHATSAPP_BOTAO=0      só se o modelo NÃO tiver o botão "Copiar código"
 */
// Lido na hora do uso (o .env é carregado por env.ts, que pode vir depois deste arquivo).
const lerConfig = () => ({
  token: process.env.WHATSAPP_TOKEN ?? '',
  numeroId: process.env.WHATSAPP_NUMERO_ID ?? '',
  modelo: process.env.WHATSAPP_MODELO ?? 'codigo_login',
  idioma: process.env.WHATSAPP_IDIOMA ?? 'pt_BR',
  botao: process.env.WHATSAPP_BOTAO !== '0',
  versao: process.env.WHATSAPP_API_VERSAO ?? 'v21.0',
});

export const whatsappConfigurado = () => {
  const c = lerConfig();
  return !!(c.token && c.numeroId);
};

/** Envia o código. `fone` com DDD e só dígitos (11 dígitos, Brasil). */
export async function enviarCodigoWhatsapp(fone: string, codigo: string) {
  const config = lerConfig();
  if (!whatsappConfigurado()) {
    throw new ErroHttp(503, 'O envio do código pelo WhatsApp ainda não está configurado. Tente mais tarde.');
  }
  const componentes: unknown[] = [{ type: 'body', parameters: [{ type: 'text', text: codigo }] }];
  // Modelos de autenticação têm o botão "Copiar código", que também recebe o código.
  if (config.botao) componentes.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: codigo }] });

  let r: Response;
  try {
    r = await fetch(`https://graph.facebook.com/${config.versao}/${config.numeroId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: `55${fone}`,
        type: 'template',
        template: { name: config.modelo, language: { code: config.idioma }, components: componentes },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ErroHttp(502, 'Não conseguimos enviar o código agora. Tente de novo em instantes.');
  }
  if (!r.ok) {
    // Registra o motivo para a equipe (sem o número nem o código).
    const erro = (await r.json().catch(() => ({}))) as { error?: { code?: number; message?: string } };
    console.error(`[whatsapp] falha ao enviar código: HTTP ${r.status} ${erro.error?.code ?? ''} ${erro.error?.message ?? ''}`);
    // 131026: número sem WhatsApp ou que não pode receber mensagens.
    if (erro.error?.code === 131026) throw new ErroHttp(400, 'Este número não recebe mensagens do WhatsApp. Confira o número.');
    throw new ErroHttp(502, 'Não conseguimos enviar o código agora. Tente de novo em instantes.');
  }
}
