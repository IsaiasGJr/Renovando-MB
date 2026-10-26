import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import type { Dia } from '@/components/Graficos';

export type Resumo = { arrecadado: number; ofertas: number; cupons: number; ofertantes: number; ticketMedio: number; conversao: number };
export type PorIgreja = { id: string; igreja: string; cidade: string; uf: string; valor: number; ofertas: number };

export type Dashboard = {
  meta: number;
  resumo: Resumo;
  porDia: Dia[];
  topIgrejas: PorIgreja[];
  porStatus: { status: string; total: number }[];
  repasses: { rotulo: string; valor: number }[];
  pendencias: { igrejas: number; semeadores: number; shows: number; mensagens?: number };
  igrejasAtivas: number;
  proximosSorteios: { id: string; nome: string; dataSorteio: string; ganhadorNumero: string | null }[];
};

export type Campanha = {
  id: string; edicao: string; titulo: string; subtitulo: string; descricao: string; valorCupom: number;
  divisao: { rotulo: string; percentual: number; tipo?: string }[]; inicio: string | null; fim: string | null; ativa: boolean;
  imagemCupom?: string;
  imagemPanfleto?: string;
  divisaoN2?: { rotulo: string; percentual: number; tipo?: string }[];
  parceiroId?: string | null;
  metaOfertas?: number;
};

export const ROTULO_STATUS_OFERTA: Record<string, string> = {
  paga: 'Pagas', aguardando_pagamento: 'Aguardando', expirada: 'Expiradas', cancelada: 'Canceladas',
};

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard'), refetchInterval: 60_000 });
}

export function useCampanhas() {
  return useQuery({ queryKey: ['campanhas'], queryFn: () => api<Campanha[]>('/campanhas') });
}
