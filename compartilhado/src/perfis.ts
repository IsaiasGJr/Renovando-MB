/**
 * Perfis de acesso ao painel pelo WhatsApp (como no site): a mesma pessoa pode ser da equipe,
 * pastor de uma igreja, semeador (N1/N2) e parceiro. Depois do código, ela escolhe com qual entrar.
 */
import { todos, um } from './db.ts';

export type TipoPerfil = 'equipe' | 'pastor' | 'semeador' | 'parceiro';
export type Perfil = { tipo: TipoPerfil; rotulo: string; detalhe: string; id: string; precisaTotp?: boolean };
/** Cadastro ainda em análise (ou recusado): a pessoa vê a situação em vez do painel. */
export type Situacao = { tipo: 'pastor' | 'semeador'; nome: string; status: 'pendente' | 'rejeitado'; motivo: string };

export function perfisDoWhatsapp(whatsappIndice: string) {
  const perfis: Perfil[] = [];
  const situacoes: Situacao[] = [];

  const equipe = um<{ id: string; nome: string; papel: string; totpAtivo: number }>(
    'SELECT id, nome, papel, totp_ativo FROM admins WHERE whatsapp_indice = ? AND ativo = 1', whatsappIndice,
  );
  if (equipe) {
    perfis.push({
      tipo: 'equipe', id: equipe.id, rotulo: equipe.papel === 'admin' ? 'Administrador' : 'Editor (equipe)',
      detalhe: equipe.nome, precisaTotp: !!equipe.totpAtivo,
    });
  }

  const igrejas = todos<{ id: string; nomeFantasia: string; status: string; observacao: string }>(
    'SELECT id, nome_fantasia, status, observacao FROM igrejas WHERE pastor_whatsapp_indice = ? ORDER BY nome_fantasia', whatsappIndice,
  );
  const ativas = igrejas.filter((i) => i.status === 'ativa');
  if (ativas.length) {
    perfis.push({ tipo: 'pastor', id: whatsappIndice, rotulo: 'Pastor', detalhe: ativas.map((i) => i.nomeFantasia).join(', ') });
  }
  for (const i of igrejas) {
    if (i.status === 'pendente' || i.status === 'rejeitada') {
      situacoes.push({ tipo: 'pastor', nome: i.nomeFantasia, status: i.status === 'pendente' ? 'pendente' : 'rejeitado', motivo: i.observacao });
    }
  }

  const s = um<{ id: string; nome: string; sobrenome: string; status: string; paiId: string | null; observacao: string }>(
    'SELECT id, nome, sobrenome, status, pai_id, observacao FROM semeadores WHERE whatsapp_indice = ?', whatsappIndice,
  );
  if (s?.status === 'ativo') {
    perfis.push({ tipo: 'semeador', id: s.id, rotulo: s.paiId ? 'Semeador N2' : 'Semeador N1', detalhe: `${s.nome} ${s.sobrenome}`.trim() });
  } else if (s && (s.status === 'pendente' || s.status === 'rejeitado')) {
    situacoes.push({ tipo: 'semeador', nome: `${s.nome} ${s.sobrenome}`.trim(), status: s.status, motivo: s.observacao });
  }

  const p = um<{ id: string; nome: string }>('SELECT id, nome FROM parceiros WHERE whatsapp_indice = ? AND ativo = 1', whatsappIndice);
  if (p) perfis.push({ tipo: 'parceiro', id: p.id, rotulo: 'Parceiro', detalhe: p.nome });

  return { perfis, situacoes };
}
