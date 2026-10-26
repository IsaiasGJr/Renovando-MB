/**
 * Planilhas CSV (como o Excel salva): separador ";" (padrão no Brasil) ou ",", aspas e BOM.
 * Primeira linha = nomes das colunas (sem acento e minúsculas para comparar).
 */
import { celulaCsv } from './seguranca.ts';

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, '_');

export function lerCsv(texto: string): Record<string, string>[] {
  const t = texto.replace(/^﻿/, '');
  const primeira = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ';' : ',';
  const linhas: string[][] = [];
  let campo = '', linha: string[] = [], aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') (campo += '"', i++);
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) (linha.push(campo), campo = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += c;
  }
  if (campo || linha.length) (linha.push(campo), linhas.push(linha));
  const [cabecalho, ...resto] = linhas.filter((l) => l.some((x) => x.trim()));
  if (!cabecalho) return [];
  const nomes = cabecalho.map(normalizar);
  return resto.map((l) => Object.fromEntries(nomes.map((n, k) => [n, (l[k] ?? '').trim().replace(/^'(?=[=+\-@])/, '')])));
}

/** Monta um CSV (separador ";") com proteção contra fórmulas. */
export const montarCsv = (colunas: string[], linhas: Record<string, unknown>[]) =>
  `﻿${[colunas.join(';'), ...linhas.map((l) => colunas.map((c) => celulaCsv(l[c])).join(';'))].join('\n')}`;
