import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import type { Usuario } from '@/types';

const CHAVE = 'renovando.sessao';

// expo-secure-store não funciona na web; lá usamos localStorage só para desenvolvimento.
const armazenamento = {
  get: (k: string) =>
    Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.getItem(k) ?? null) : SecureStore.getItemAsync(k),
  set: (k: string, v: string) =>
    Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.setItem(k, v)) : SecureStore.setItemAsync(k, v),
  del: (k: string) =>
    Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.removeItem(k)) : SecureStore.deleteItemAsync(k),
};

type Sessao = { token: string; usuario: Usuario };

type AuthState = {
  carregado: boolean;
  token: string | null;
  usuario: Usuario | null;
  carregar(): Promise<void>;
  entrar(s: Sessao): Promise<void>;
  sair(): Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  carregado: false,
  token: null,
  usuario: null,

  async carregar() {
    try {
      const bruto = await armazenamento.get(CHAVE);
      if (bruto) {
        const s: Sessao = JSON.parse(bruto);
        set({ token: s.token, usuario: s.usuario });
      }
    } catch {
      // sessão corrompida ou armazenamento indisponível: segue deslogado
    } finally {
      set({ carregado: true });
    }
  },

  async entrar(s) {
    set({ token: s.token, usuario: s.usuario });
    try {
      await armazenamento.set(CHAVE, JSON.stringify(s));
    } catch {}
  },

  async sair() {
    set({ token: null, usuario: null });
    try {
      await armazenamento.del(CHAVE);
    } catch {}
  },
}));
