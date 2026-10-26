/**
 * Sessão de quem entra pelo WhatsApp com perfil de pastor, semeador ou parceiro.
 * Fica separada da sessão da equipe (outra chave, outro token): uma nunca vale pela outra.
 */
import { ErroApi } from '../api';

const CHAVE = 'renovando.painel.perfil';
export type TipoPerfil = 'pastor' | 'semeador' | 'parceiro';
export type SessaoPerfil = { token: string; perfil: { tipo: TipoPerfil; rotulo: string; nome: string } };

export function lerSessaoPerfil(): SessaoPerfil | null {
  try {
    const s = localStorage.getItem(CHAVE);
    return s ? (JSON.parse(s) as SessaoPerfil) : null;
  } catch {
    return null;
  }
}

export function salvarSessaoPerfil(s: SessaoPerfil | null) {
  try {
    if (s) localStorage.setItem(CHAVE, JSON.stringify(s));
    else localStorage.removeItem(CHAVE);
  } catch {
    // armazenamento bloqueado: a sessão dura só enquanto a aba estiver aberta
  }
}

/** Chamada à área do perfil (/api/perfil/...). Sessão vencida volta para a entrada. */
export async function apiPerfil<T = unknown>(caminho: string, opcoes: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...init } = opcoes;
  const headers = new Headers(init.headers);
  const s = lerSessaoPerfil();
  if (s) headers.set('Authorization', `Bearer ${s.token}`);
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  const r = await fetch(`/api/perfil${caminho}`, { ...init, headers, body: json !== undefined ? JSON.stringify(json) : init.body });
  if (r.status === 401) {
    salvarSessaoPerfil(null);
    window.location.assign('/login');
  }
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroApi(r.status, (dados as { erro?: string }).erro ?? 'Erro inesperado.');
  return dados as T;
}

/** Baixa um arquivo da área do perfil (ex.: panfleto em PDF). */
export async function baixarPerfil(caminho: string, nome: string) {
  const s = lerSessaoPerfil();
  const r = await fetch(`/api/perfil${caminho}`, { headers: s ? { Authorization: `Bearer ${s.token}` } : {} });
  if (!r.ok) throw new ErroApi(r.status, 'Não foi possível gerar o arquivo.');
  const url = URL.createObjectURL(await r.blob());
  Object.assign(document.createElement('a'), { href: url, download: nome }).click();
  URL.revokeObjectURL(url);
}
