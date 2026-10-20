import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';

const CHAVE = 'renovando.admin.sessao';

export type Admin = { id: string; nome: string; email: string; papel: 'admin' | 'editor' };
type Dados = { token: string; admin: Admin };

// Na web (só para testes) não existe secure-store; usa localStorage.
const guardar = {
  get: (k: string) =>
    Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.getItem(k) ?? null) : SecureStore.getItemAsync(k),
  set: (k: string, v: string) =>
    Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.setItem(k, v)) : SecureStore.setItemAsync(k, v),
  del: (k: string) =>
    Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.removeItem(k)) : SecureStore.deleteItemAsync(k),
};

type Estado = {
  carregado: boolean;
  token: string | null;
  admin: Admin | null;
  carregar(): Promise<void>;
  entrar(d: Dados): Promise<void>;
  sair(): Promise<void>;
};

export const useSessao = create<Estado>((set) => ({
  carregado: false,
  token: null,
  admin: null,

  async carregar() {
    try {
      const bruto = await guardar.get(CHAVE);
      if (bruto) {
        const d: Dados = JSON.parse(bruto);
        set({ token: d.token, admin: d.admin });
      }
    } catch {
      // sessão inválida: segue deslogado
    } finally {
      set({ carregado: true });
    }
  },

  async entrar(d) {
    set({ token: d.token, admin: d.admin });
    try {
      await guardar.set(CHAVE, JSON.stringify(d));
    } catch {}
  },

  async sair() {
    set({ token: null, admin: null });
    try {
      await guardar.del(CHAVE);
    } catch {}
  },
}));

export const useEhAdmin = () => useSessao((s) => s.admin?.papel === 'admin');
