import { create } from 'zustand';
import type { Igreja } from '@/types';

/** Rascunho da oferta enquanto o usuário passa pelas telas do fluxo. */
type RascunhoOferta = {
  quantidade: number;
  anonima: boolean;
  igreja: Igreja | null;
  definir(p: Partial<Pick<RascunhoOferta, 'quantidade' | 'anonima' | 'igreja'>>): void;
  limpar(): void;
};

export const useRascunhoOferta = create<RascunhoOferta>((set) => ({
  quantidade: 1,
  anonima: false,
  igreja: null,
  definir: (p) => set(p),
  limpar: () => set({ quantidade: 1, anonima: false, igreja: null }),
}));
