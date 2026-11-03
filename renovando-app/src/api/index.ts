import { useQuery } from '@tanstack/react-query';
import type { Api } from './contrato';
import { httpApi } from './http';

export const api: Api = httpApi;
export { baixarCupom, baixarPanfleto, BASE_URL, urlImagem } from './http';
export type { Api };

const useModo = () => useQuery({ queryKey: ['modo-api'], queryFn: api.modo, staleTime: Infinity }).data;

/** Verdadeiro quando a API roda em desenvolvimento (código de login 123456). */
export const useModoTeste = () => useModo()?.modoTeste ?? false;

/** Verdadeiro quando o pagamento é simulado (desenvolvimento ou homologação): mostra o botão "Simular pagamento". */
export const usePagamentoSimulado = () => useModo()?.pagamentoSimulado ?? false;
