import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuth } from '@/store/auth';
import type { Anexo } from '@/types';
import type { Api } from './contrato';

/**
 * Endereço da API:
 * 1. EXPO_PUBLIC_API_URL, se definido (produção);
 * 2. em desenvolvimento, o mesmo IP do computador que roda o Expo, na porta 3333
 *    (assim funciona no celular com Expo Go sem configurar nada);
 * 3. localhost como último recurso.
 */
function descobrirBase() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof location !== 'undefined') return `${location.protocol}//${location.hostname}:3333`;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:3333`;
}

export const BASE_URL = descobrirBase();

/** Imagens enviadas pelo admin vêm como "/uploads/…". */
export const urlImagem = (u?: string) => (!u ? undefined : u.startsWith('http') ? u : `${BASE_URL}${u}`);

async function req<T>(caminho: string, init: { method?: string; corpo?: unknown } = {}): Promise<T> {
  const token = useAuth.getState().token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.corpo !== undefined) headers['Content-Type'] = 'application/json';

  let r: Response;
  try {
    r = await fetch(`${BASE_URL}/api${caminho}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.corpo !== undefined ? JSON.stringify(init.corpo) : undefined,
    });
  } catch {
    throw new Error('Sem conexão com o servidor. Verifique sua internet e tente de novo.');
  }
  if (r.status === 401 && token) await useAuth.getState().sair();
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((dados as { erro?: string }).erro ?? 'Algo deu errado. Tente de novo.');
  return dados as T;
}

const enc = encodeURIComponent;

export const httpApi: Api = {
  modoTeste: () => req<{ modoTeste: boolean }>('/saude').then((r) => r.modoTeste),

  campanha: () => req('/campanha'),
  premios: () => req('/premios'),
  igrejas: (busca = '') => req(`/igrejas?busca=${enc(busca)}`),
  noticias: () => req('/noticias'),
  noticia: (slug) => req(`/noticias/${enc(slug)}`),
  depoimentos: () => req('/depoimentos'),
  faqs: () => req('/faqs'),
  artistas: () => req('/artistas'),
  artista: (slug) => req(`/artistas/${enc(slug)}`),
  igreja: (slug) => req(`/igrejas/${enc(slug)}`),
  banners: () => req('/banners'),
  parceiros: () => req('/parceiros'),
  galeria: (grupo) => req(`/galeria?grupo=${enc(grupo)}`),
  pagina: (slug) => req(`/paginas/${slug}`),
  enviarAnexo: async (a) => {
    const fd = new FormData();
    if (Platform.OS === 'web') fd.append('arquivo', await (await fetch(a.uri)).blob(), a.nome);
    else fd.append('arquivo', { uri: a.uri, name: a.nome, type: a.tipo } as unknown as Blob);
    let r: Response;
    try {
      r = await fetch(`${BASE_URL}/api/contato/anexos`, { method: 'POST', body: fd });
    } catch {
      throw new Error('Sem conexão com o servidor. Verifique sua internet e tente de novo.');
    }
    const dados = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((dados as { erro?: string }).erro ?? 'Não foi possível enviar o arquivo.');
    return dados as Anexo;
  },
  enviarContato: (m) => req('/contato', { method: 'POST', corpo: m }).then(() => undefined),
  painel: () => req('/me/painel'),

  enviarCodigo: (whatsapp) => req('/auth/codigo', { method: 'POST', corpo: { whatsapp } }).then(() => undefined),
  verificarCodigo: (p) => req('/auth/verificar', { method: 'POST', corpo: p }),

  criarOferta: (p) => req('/ofertas', { method: 'POST', corpo: p }),
  oferta: (id) => req(`/ofertas/${enc(id)}`),
  simularPagamento: (id) => req(`/dev/ofertas/${enc(id)}/pagar`, { method: 'POST' }).then(() => undefined),
  meusCupons: () => req('/me/cupons'),
  sairDeTodos: () => req('/me/sair-de-todos', { method: 'POST' }).then(() => undefined),
  excluirConta: () => req('/me', { method: 'DELETE', corpo: { confirmacao: 'EXCLUIR' } }).then(() => undefined),

  cadastrarIgreja: (d) => req('/igrejas', { method: 'POST', corpo: d }),
  cadastrarSemeador: (d) => req('/semeadores', { method: 'POST', corpo: d }),
  solicitarShow: (d) => req('/shows/solicitacoes', { method: 'POST', corpo: d }).then(() => undefined),
};

/**
 * Baixa um arquivo da conta (bilhete do cupom, panfleto da igreja...) e abre o menu de compartilhar
 * do celular (salvar, imprimir, mandar no WhatsApp...). Na web, baixa o arquivo.
 */
export async function baixarArquivo(caminho: string, nome: string, tipo: string) {
  const token = useAuth.getState().token;
  let r: Response;
  try {
    r = await fetch(`${BASE_URL}/api${caminho}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new Error('Sem conexão com o servidor. Verifique sua internet e tente de novo.');
  }
  if (!r.ok) {
    const erro = (await r.json().catch(() => ({}))) as { erro?: string };
    throw new Error(erro.erro ?? 'Não foi possível baixar o arquivo. Tente novamente.');
  }
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(await r.blob());
    Object.assign(document.createElement('a'), { href: url, download: nome }).click();
    URL.revokeObjectURL(url);
    return;
  }
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const destino = new File(Paths.cache, nome);
  destino.create({ overwrite: true });
  destino.write(new Uint8Array(await r.arrayBuffer()));
  await Sharing.shareAsync(destino.uri, { mimeType: tipo, dialogTitle: nome });
}

/** "Baixar cupom", como no site: o bilhete da campanha com o número e os dados do cupom. */
export const baixarCupom = (cupomId: string, numero: string) =>
  baixarArquivo(`/me/cupons/${encodeURIComponent(cupomId)}/imagem`, `cupom-${numero}.jpg`, 'image/jpeg');

/** Panfleto da igreja com o QR Code dela (PDF A4, 1 ou 6 por folha). */
export const baixarPanfleto = (igrejaId: string, slug: string, porPagina: 1 | 6) =>
  baixarArquivo(`/me/igrejas/${encodeURIComponent(igrejaId)}/panfleto?porPagina=${porPagina}`, `panfleto-${slug}-${porPagina}-por-pagina.pdf`, 'application/pdf');
