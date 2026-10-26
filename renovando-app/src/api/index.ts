import { useQuery } from '@tanstack/react-query';
import type { Api } from './contrato';
import { httpApi } from './http';

export const api: Api = httpApi;
export { baixarCupom, baixarPanfleto, BASE_URL, urlImagem } from './http';
export type { Api };

/** Verdadeiro quando a API roda em desenvolvimento (código 123456 e pagamento simulado). */
export function useModoTeste() {
  return useQuery({ queryKey: ['modo-teste'], queryFn: api.modoTeste, staleTime: Infinity }).data ?? false;
}
