const CHAVE = 'renovando.admin.sessao';

export type Admin = { id: string; nome: string; email: string; papel: 'admin' | 'editor' };
type Sessao = { token: string; admin: Admin };

export function lerSessao(): Sessao | null {
  try {
    const s = localStorage.getItem(CHAVE);
    return s ? (JSON.parse(s) as Sessao) : null;
  } catch {
    return null;
  }
}

export function salvarSessao(s: Sessao | null) {
  try {
    if (s) localStorage.setItem(CHAVE, JSON.stringify(s));
    else localStorage.removeItem(CHAVE);
  } catch {
    // armazenamento bloqueado: a sessão dura só enquanto a aba estiver aberta
  }
}

export class ErroApi extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(caminho: string, opcoes: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...init } = opcoes;
  const headers = new Headers(init.headers);
  const s = lerSessao();
  if (s) headers.set('Authorization', `Bearer ${s.token}`);
  if (json !== undefined) headers.set('Content-Type', 'application/json');

  const r = await fetch(`/api${caminho}`, { ...init, headers, body: json !== undefined ? JSON.stringify(json) : init.body });
  if (r.status === 401 && caminho !== '/login') {
    salvarSessao(null);
    window.location.assign('/login');
  }
  if (r.status === 204) return undefined as T;
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroApi(r.status, (dados as { erro?: string }).erro ?? 'Erro inesperado.');
  return dados as T;
}

export async function enviarImagem(arquivo: File, finalidade?: 'cupom' | 'panfleto'): Promise<string> {
  const fd = new FormData();
  fd.append('arquivo', arquivo);
  const { url } = await api<{ url: string }>(`/upload${finalidade ? `?finalidade=${finalidade}` : ''}`, { method: 'POST', body: fd });
  return url;
}

/** Baixa um arquivo autenticado (ex.: CSV) e entrega ao navegador. */
export async function baixar(caminho: string, nome: string) {
  const s = lerSessao();
  const r = await fetch(`/api${caminho}`, { headers: s ? { Authorization: `Bearer ${s.token}` } : {} });
  if (!r.ok) throw new ErroApi(r.status, 'Não foi possível gerar o arquivo.');
  const url = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  a.click();
  URL.revokeObjectURL(url);
}

export const moeda = (v: number) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
/** Valor compacto para eixos de gráfico: R$ 600 · R$ 1,5 mil. */
export const moedaCurta = (v: number) =>
  v >= 1000
    ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
    : `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
export const numero = (v: number) => (v ?? 0).toLocaleString('pt-BR');
/** Data sem hora ("2026-08-10") é mostrada como está: lida como UTC, voltaria um dia no fuso do Brasil. */
const soData = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
};
export const data = (iso?: string | null) => (iso ? soData(iso) ?? new Date(iso).toLocaleDateString('pt-BR') : '—');
export const dataHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
