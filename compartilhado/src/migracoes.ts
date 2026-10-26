import { join } from 'node:path';
import { cifrar, decifrar, estaCifrado, indice } from './cripto.ts';
import { db, executar, PASTA_DADOS, todos, transacao } from './db.ts';
import { completarLancamentos, regraN2DeExemplo } from './repasses.ts';
import { slugUnico } from './util.ts';

/** Colunas com dados pessoais que ficam cifradas no banco. */
const COLUNAS_CIFRADAS: [tabela: string, coluna: string][] = [
  ['usuarios', 'whatsapp'],
  ['semeadores', 'whatsapp'],
  ['semeadores', 'cpf'],
  ['igrejas', 'pastor_whatsapp'],
  ['solicitacoes_show', 'whatsapp'],
  ['solicitacoes_show', 'email'],
  ['igrejas', 'chave_pix'],
  ['semeadores', 'chave_pix'],
  ['parceiros', 'whatsapp'],
  ['parceiros', 'chave_pix'],
  ['admins', 'whatsapp'],
];

const ehMarcador = (v: string) => v.startsWith('excluido:');

/**
 * Cifra CPF e WhatsApp que ainda estejam abertos no banco (bancos criados antes da criptografia).
 * Idempotente: roda em toda inicialização e só mexe no que falta.
 */
export function migrarCriptografia() {
  const pendentes = COLUNAS_CIFRADAS.reduce((n, [t, c]) => {
    const r = db
      .prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE ${c} <> '' AND ${c} NOT LIKE 'v1:%' AND ${c} NOT LIKE 'excluido:%'`)
      .get() as { n: number };
    return n + r.n;
  }, 0);
  const semIndice = (db.prepare('SELECT COUNT(*) AS n FROM usuarios WHERE whatsapp_indice IS NULL').get() as { n: number }).n;
  if (!pendentes && !semIndice) return;

  // Cópia de segurança antes de alterar (contém dados ABERTOS: apague depois de conferir).
  if (pendentes) {
    const arquivo = join(PASTA_DADOS, `backup-antes-da-criptografia-${Date.now()}.db`);
    db.exec(`VACUUM INTO '${arquivo.replace(/'/g, "''")}'`);
    console.warn(`[cripto] Backup criado em ${arquivo}. Ele tem dados SEM criptografia: apague depois de conferir que está tudo certo.`);
  }

  transacao(() => {
    for (const [tabela, coluna] of COLUNAS_CIFRADAS) {
      const linhas = todos<{ id: string; valor: string }>(
        `SELECT id, ${coluna} AS valor FROM ${tabela} WHERE ${coluna} <> '' AND ${coluna} NOT LIKE 'v1:%' AND ${coluna} NOT LIKE 'excluido:%'`,
      );
      for (const l of linhas) {
        if (tabela === 'usuarios') {
          executar('UPDATE usuarios SET whatsapp = ?, whatsapp_indice = ? WHERE id = ?', cifrar(l.valor), indice(l.valor), l.id);
        } else {
          executar(`UPDATE ${tabela} SET ${coluna} = ? WHERE id = ?`, cifrar(l.valor), l.id);
        }
      }
    }
    // Contas excluídas: o índice vira o próprio marcador (não é dado pessoal).
    executar("UPDATE usuarios SET whatsapp_indice = whatsapp WHERE whatsapp_indice IS NULL AND whatsapp LIKE 'excluido:%'");
    // Códigos de login antigos estavam guardados pelo número aberto: descarta (duram só 10 minutos).
    executar('DELETE FROM otps WHERE length(whatsapp) <> 64');
  });

  const restantes = todos<{ v: string }>("SELECT whatsapp AS v FROM usuarios WHERE whatsapp NOT LIKE 'v1:%'").filter(
    (l) => !estaCifrado(l.v) && !ehMarcador(l.v),
  ).length;
  console.log(`[cripto] Migração concluída: ${pendentes} valor(es) cifrado(s)${restantes ? `, ${restantes} pendente(s)!` : ''}.`);
}

/**
 * Preenche dados que passaram a existir depois: endereço curto (slug) de igrejas e artistas,
 * e índices de busca do WhatsApp de semeadores e pastores (usados nos painéis).
 * Idempotente.
 */
export function completarDadosNovos() {
  transacao(() => {
    // Regra "com N2" de exemplo para campanhas que ainda não têm (a equipe revisa no admin).
    for (const c of todos<{ id: string; divisaoJson: string }>("SELECT id, divisao_json FROM campanhas WHERE divisao_n2_json = ''")) {
      executar('UPDATE campanhas SET divisao_n2_json = ? WHERE id = ?', JSON.stringify(regraN2DeExemplo(JSON.parse(c.divisaoJson))), c.id);
    }
    // Lançamentos de repasse que faltam (ofertas pagas antes desta versão).
    completarLancamentos();
    for (const tabela of ['igrejas', 'artistas'] as const) {
      const nomeCol = tabela === 'igrejas' ? 'nome_fantasia' : 'nome';
      const linhas = todos<{ id: string; nome: string }>(`SELECT id, ${nomeCol} AS nome FROM ${tabela} WHERE slug IS NULL OR slug = ''`);
      for (const l of linhas) {
        const s = slugUnico((x) => !!db.prepare(`SELECT 1 FROM ${tabela} WHERE slug = ?`).get(x), l.nome);
        executar(`UPDATE ${tabela} SET slug = ? WHERE id = ?`, s, l.id);
      }
    }
    for (const l of todos<{ id: string; valor: string }>("SELECT id, pastor_whatsapp AS valor FROM igrejas WHERE pastor_whatsapp_indice IS NULL AND pastor_whatsapp <> ''")) {
      const fone = decifrar(l.valor).replace(/\D/g, '');
      if (fone) executar('UPDATE igrejas SET pastor_whatsapp_indice = ? WHERE id = ?', indice(fone), l.id);
    }
    for (const l of todos<{ id: string; valor: string }>("SELECT id, whatsapp AS valor FROM semeadores WHERE whatsapp_indice IS NULL AND whatsapp <> ''")) {
      const fone = decifrar(l.valor).replace(/\D/g, '');
      if (fone) executar('UPDATE semeadores SET whatsapp_indice = ? WHERE id = ?', indice(fone), l.id);
    }
  });
}
