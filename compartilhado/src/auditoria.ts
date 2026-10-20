import { inserir } from './db.ts';
import { novoId } from './util.ts';

export type Acao =
  | 'criar' | 'editar' | 'excluir' | 'ativar' | 'sortear' | 'desfazer_sorteio'
  | 'login' | 'login_falhou' | 'exportar' | 'encerrar_sessoes';

/** Campos que nunca vão para o registro (mesmo que mudem). */
const OCULTOS = new Set(['senha', 'senhaHash']);

/** Diferença entre o antes e o depois, só dos campos enviados. */
export function diferenca(antes: Record<string, unknown> | undefined, depois: Record<string, unknown>) {
  const mudou: Record<string, { de: unknown; para: unknown }> = {};
  for (const [k, v] of Object.entries(depois)) {
    if (OCULTOS.has(k)) {
      mudou[k] = { de: '***', para: '***' };
      continue;
    }
    const anterior = antes?.[k];
    const igual = anterior === v || (typeof anterior === 'number' && typeof v === 'boolean' && !!anterior === v);
    if (!igual) mudou[k] = { de: anterior ?? null, para: v ?? null };
  }
  return mudou;
}

/** Grava uma ação no registro de auditoria. Nunca derruba a requisição se falhar. */
export function registrar(p: {
  admin?: { id: string; nome: string } | null;
  /** Nome exibido quando a ação não foi feita por um usuário do admin (ex.: o próprio ofertante). */
  autor?: string;
  acao: Acao;
  recurso: string;
  registroId?: string | null;
  resumo?: string;
  detalhes?: unknown;
  ip?: string;
}) {
  try {
    inserir('auditoria', {
      id: novoId(),
      adminId: p.admin?.id ?? null,
      adminNome: p.admin?.nome ?? p.autor ?? '—',
      acao: p.acao,
      recurso: p.recurso,
      registroId: p.registroId ?? null,
      resumo: (p.resumo ?? '').slice(0, 300),
      detalhes: JSON.stringify(p.detalhes ?? {}),
      ip: p.ip ?? '',
    });
  } catch (e) {
    console.error('[auditoria] falha ao registrar', e);
  }
}
