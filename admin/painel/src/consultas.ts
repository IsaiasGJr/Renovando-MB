import { useQuery } from '@tanstack/react-query';
import { api } from './api';

// Fica fora das páginas: o menu usa o dashboard (pendências) sem carregar o código dos gráficos.

export type DadosDashboard = {
  resumo: { arrecadado: number; ofertas: number; cupons: number; ofertantes: number; ticketMedio: number; conversao: number };
  porDia: { dia: string; valor: number; ofertas: number }[];
  topIgrejas: { id: string; igreja: string; cidade: string; uf: string; valor: number; ofertas: number }[];
  porStatus: { status: string; total: number }[];
  repasses: { rotulo: string; valor: number }[];
  pendencias: { igrejas: number; semeadores: number; shows: number; mensagens?: number };
  igrejasAtivas: number;
  proximosSorteios: { id: string; nome: string; dataSorteio: string; ganhadorNumero: string | null }[];
};

export const ROTULO_STATUS_OFERTA: Record<string, string> = {
  paga: 'Pagas', aguardando_pagamento: 'Aguardando pagamento', expirada: 'Expiradas', cancelada: 'Canceladas',
};

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: () => api<DadosDashboard>('/dashboard'), refetchInterval: 60_000 });
}
