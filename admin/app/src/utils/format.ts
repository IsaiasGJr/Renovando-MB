/**
 * Números no formato brasileiro sem depender do Intl: no Android (Hermes) o toLocaleString
 * não formata igual ao navegador. Até "casas" decimais, sem zeros sobrando no fim.
 */
export function decimal(v: number, casas = 2) {
  const [int, dec = ''] = Math.abs(v ?? 0).toFixed(casas).split('.');
  const fim = dec.replace(/0+$/, '');
  return `${v < 0 ? '-' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${fim ? `,${fim}` : ''}`;
}
/** R$ 1.234,50 (sempre com centavos). */
export const moeda = (v: number) => {
  const [int, dec] = Math.abs(v ?? 0).toFixed(2).split('.');
  return `${(v ?? 0) < 0 ? '-' : ''}R$\u00a0${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
};
export const moedaCurta = (v: number) =>
  v >= 1000 ? `R$ ${decimal(v / 1000, 1)} mil` : `R$ ${Math.round(v)}`;
export const numero = (v: number) => decimal(v ?? 0);
/** Data sem hora ("2026-08-10") é mostrada como está: lida como UTC, voltaria um dia no fuso do Brasil. */
const soData = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
};
export const data = (iso?: string | null) => (iso ? soData(iso) ?? new Date(iso).toLocaleDateString('pt-BR') : '—');
export const dataHora = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
export const soDigitos = (s: string) => s.replace(/\D/g, '');

/** ISO → "dd/mm/aaaa hh:mm" (hora local). */
export function isoParaBr(iso?: string | null, comHora = true) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  const dia = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  return comHora ? `${dia} ${p(d.getHours())}:${p(d.getMinutes())}` : dia;
}

/** "dd/mm/aaaa[ hh:mm]" → ISO (com hora) ou "aaaa-mm-dd" (sem hora). Vazio se inválido. */
export function brParaIso(s: string, comHora = true) {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!m) return '';
  const [, d, mes, a, h = '00', min = '00'] = m;
  if (!comHora) return `${a}-${mes}-${d}`;
  const dt = new Date(Number(a), Number(mes) - 1, Number(d), Number(h), Number(min));
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString();
}

/** Máscara dd/mm/aaaa hh:mm enquanto digita. */
export function mascaraData(s: string, comHora = true) {
  const d = soDigitos(s).slice(0, comHora ? 12 : 8);
  let out = d.slice(0, 2);
  if (d.length > 2) out += `/${d.slice(2, 4)}`;
  if (d.length > 4) out += `/${d.slice(4, 8)}`;
  if (d.length > 8) out += ` ${d.slice(8, 10)}`;
  if (d.length > 10) out += `:${d.slice(10, 12)}`;
  return out;
}

export const isoDias = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
