/**
 * Números no formato brasileiro sem depender do Intl: no Android (Hermes) o toLocaleString
 * não formata igual ao navegador. Até "casas" decimais, sem zeros sobrando no fim.
 */
export function decimal(v: number, casas = 2) {
  const [int, dec = ''] = Math.abs(v ?? 0).toFixed(casas).split('.');
  const fim = dec.replace(/0+$/, '');
  return `${v < 0 ? '-' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${fim ? `,${fim}` : ''}`;
}
/** R$ 20, R$ 1.000, R$ 12,50 (centavos só quando houver). */
export const moeda = (v: number) => {
  const [int, dec] = Math.abs(v ?? 0).toFixed(2).split('.');
  return `${(v ?? 0) < 0 ? '-' : ''}R$\u00a0${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${dec === '00' ? '' : `,${dec}`}`;
};

/** Data sem hora ("2026-08-10") é mostrada como está: lida como UTC, voltaria um dia no fuso do Brasil. */
const soData = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
};
export const data = (iso: string) =>
  soData(iso) ?? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const soDigitos = (s: string) => s.replace(/\D/g, '');

/** (63) 98424-1475 */
export function mascaraTelefone(s: string) {
  const d = soDigitos(s).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** 00.000.000/0000-00 */
export function mascaraCnpj(s: string) {
  const d = soDigitos(s).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/** 00000-000 */
export function mascaraCep(s: string) {
  const d = soDigitos(s).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Dias de calendário até a data (0 = hoje, 1 = amanhã), no fuso do celular. */
export function diasAte(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  // Data sem hora é dia do calendário: lida como UTC, viraria a noite anterior no Brasil.
  const alvo = m && iso.length === 10 ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso);
  const hoje = new Date();
  const dia = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((dia(alvo) - dia(hoje)) / 86_400_000);
}

/** 000.000.000-00 */
export function mascaraCpf(s: string) {
  return soDigitos(s)
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

/** dd/mm/aaaa → aaaa-mm-dd (vazio se a data for inválida). */
export function dataBrParaIso(s: string) {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return Number.isNaN(new Date(`${iso}T12:00:00`).getTime()) ? '' : iso;
}

export function mascaraData(s: string) {
  const d = soDigitos(s).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export const numero = (v: number) => decimal(v ?? 0);
