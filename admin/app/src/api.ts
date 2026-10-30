import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { useSessao } from '@/store/sessao';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Endereço do SERVIDOR DO ADMIN (admin/servidor), separado da API do app:
 * 1. EXPO_PUBLIC_ADMIN_URL, se definido (produção, ex.: https://admin.seudominio.com);
 * 2. em desenvolvimento, o IP do computador que roda o Expo, na porta 4000;
 * 3. localhost.
 */
function descobrirBase() {
  if (process.env.EXPO_PUBLIC_ADMIN_URL) return process.env.EXPO_PUBLIC_ADMIN_URL.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof location !== 'undefined') return `${location.protocol}//${location.hostname}:4000`;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:4000`;
}

export const BASE_URL = descobrirBase();
export const urlImagem = (u?: string | null) => (!u ? undefined : u.startsWith('http') ? u : `${BASE_URL}${u}`);

function cabecalhos(extra: Record<string, string> = {}) {
  const token = useSessao.getState().token;
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

async function tratar<T>(r: Response): Promise<T> {
  if (r.status === 401 && useSessao.getState().token) await useSessao.getState().sair();
  if (r.status === 204) return undefined as T;
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((dados as { erro?: string }).erro ?? 'Algo deu errado. Tente de novo.');
  return dados as T;
}

export async function api<T = unknown>(caminho: string, opcoes: { method?: string; json?: unknown } = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${BASE_URL}/api${caminho}`, {
      method: opcoes.method ?? 'GET',
      headers: cabecalhos(opcoes.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      body: opcoes.json !== undefined ? JSON.stringify(opcoes.json) : undefined,
    });
  } catch {
    throw new Error(`Sem conexão com o servidor do admin (${BASE_URL}).`);
  }
  return tratar<T>(r);
}

/** Maior lado da foto enviada (o servidor também reduz, mas reduzir aqui deixa o envio rápido no 4G). */
const LADO_MAXIMO = 1600;

/** Reduz a foto no próprio aparelho antes de enviar. GIF vai como está (para não perder a animação). */
async function reduzir(imagem: { uri: string; tipo?: string | null; largura?: number; altura?: number }) {
  if (imagem.tipo === 'image/gif') return null;
  const { largura = 0, altura = 0 } = imagem;
  const contexto = ImageManipulator.manipulate(imagem.uri);
  if (Math.max(largura, altura) > LADO_MAXIMO) {
    contexto.resize(largura >= altura ? { width: LADO_MAXIMO } : { height: LADO_MAXIMO });
  }
  const pronta = await contexto.renderAsync();
  const r = await pronta.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  return { uri: r.uri, nome: 'foto.jpg', tipo: 'image/jpeg' };
}

/** Envia uma imagem escolhida no celular e devolve a URL salva no servidor. */
export async function enviarImagem(original: { uri: string; nome?: string | null; tipo?: string | null; largura?: number; altura?: number }, finalidade?: 'cupom' | 'panfleto') {
  let imagem: { uri: string; nome?: string | null; tipo?: string | null } = original;
  try {
    imagem = (await reduzir(original)) ?? original;
  } catch {
    // Se não conseguir reduzir aqui, envia a original: o servidor reduz de qualquer forma.
  }
  const fd = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(imagem.uri)).blob();
    fd.append('arquivo', blob, imagem.nome ?? 'imagem.jpg');
  } else {
    // No React Native o FormData aceita { uri, name, type } direto.
    fd.append('arquivo', { uri: imagem.uri, name: imagem.nome ?? 'imagem.jpg', type: imagem.tipo ?? 'image/jpeg' } as unknown as Blob);
  }
  const r = await fetch(`${BASE_URL}/api/upload${finalidade ? `?finalidade=${finalidade}` : ''}`, { method: 'POST', headers: cabecalhos(), body: fd });
  const { url } = await tratar<{ url: string }>(r);
  return url;
}

/**
 * Baixa um arquivo protegido pelo login do admin e abre o menu de compartilhar (WhatsApp, imprimir, Drive...).
 * No celular o download é nativo, direto para o arquivo: PDFs grandes não passam pela memória do JS.
 */
async function baixarECompartilhar(caminho: string, nome: string, tipo: string | undefined, erroPadrao: string) {
  const url = `${BASE_URL}/api${caminho}`;
  const falhou = async (r: Response) =>
    new Error((await r.json().catch(() => ({})) as { erro?: string }).erro ?? erroPadrao);
  if (Platform.OS === 'web') {
    const r = await fetch(url, { headers: cabecalhos() });
    if (!r.ok) throw await falhou(r);
    const link = URL.createObjectURL(await r.blob());
    Object.assign(document.createElement('a'), { href: link, download: nome }).click();
    URL.revokeObjectURL(link);
    return;
  }
  let arquivo: File;
  try {
    arquivo = await File.downloadFileAsync(url, new File(Paths.cache, nome.replace(/[^\w.-]/g, '_')), { headers: cabecalhos(), idempotent: true });
  } catch {
    // Pede de novo só para mostrar a mensagem do servidor.
    const r = await fetch(url, { headers: cabecalhos() });
    throw r.ok ? new Error('Não foi possível salvar o arquivo no celular.') : await falhou(r);
  }
  await Sharing.shareAsync(arquivo.uri, { mimeType: tipo, dialogTitle: nome });
}

/** Baixa um anexo do "Fale conosco" (precisa do login do admin) e abre o menu de compartilhar. */
export const baixarAnexo = (arquivo: string, nome: string) =>
  baixarECompartilhar(`/anexos/${encodeURIComponent(arquivo)}`, `${Date.now()}-${nome}`, undefined, 'Não foi possível baixar o anexo.');

/** Baixa um arquivo do admin (ex.: PDF do panfleto) e abre o menu de compartilhar (WhatsApp, imprimir, Drive...). */
export const baixarArquivo = (caminho: string, nome: string, tipo: string) =>
  baixarECompartilhar(caminho, nome, tipo, 'Não foi possível gerar o arquivo.');

/** Baixa o CSV do relatório e abre o menu de compartilhar (WhatsApp, e-mail, Drive...). */
export async function compartilharCsv(caminho: string, nome: string) {
  const r = await fetch(`${BASE_URL}/api${caminho}`, { headers: cabecalhos() });
  if (!r.ok) throw new Error('Não foi possível gerar a planilha.');
  const texto = await r.text();
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: nome }).click();
    URL.revokeObjectURL(url);
    return;
  }
  const arquivo = new File(Paths.cache, nome);
  arquivo.create({ overwrite: true });
  await arquivo.write(texto);
  await Sharing.shareAsync(arquivo.uri, { mimeType: 'text/csv', dialogTitle: 'Compartilhar relatório' });
}
