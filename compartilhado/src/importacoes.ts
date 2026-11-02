/**
 * Importação por planilha (só administradores): WhatsApp dos pastores e chaves PIX das igrejas,
 * semeadores (N1 e N2) e parceiros. Sempre dá para CONFERIR antes (simular): nada é gravado até confirmar.
 * Célula vazia = não muda nada. Dados pessoais e chaves PIX são gravados cifrados.
 */
import { cifrar, indice } from './cripto.ts';
import { executar, inserir, todos, transacao, um } from './db.ts';
import { montarCsv } from './csv.ts';
import { campanhaAtiva, novoNumero } from './dominio.ts';
import { regraDaIgreja } from './repasses.ts';
import { novoId, soDigitos } from './util.ts';
import { randomInt } from 'node:crypto';

export type TipoImportacao = 'igrejas' | 'semeadores' | 'parceiros' | 'ofertas';
export type ResultadoLinha = { linha: number; referencia: string; acao: 'atualizar' | 'criar' | 'ignorar' | 'erro'; detalhe: string };

const TIPOS_PIX = ['cnpj', 'cpf', 'email', 'telefone', 'aleatoria'];
const tipoPix = (v: string) => {
  const t = v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return t === 'celular' || t === 'phone' ? 'telefone' : t === 'random' || t === 'evp' ? 'aleatoria' : t;
};

/** Modelo para baixar. O de igrejas já vem com as igrejas cadastradas (sem os dados sensíveis). */
export function modeloCsv(tipo: TipoImportacao) {
  if (tipo === 'igrejas') {
    const linhas = todos<{ slug: string; nomeFantasia: string; cidade: string; uf: string; pastorNome: string; temWhats: number; temPix: number }>(
      `SELECT slug, nome_fantasia, cidade, uf, pastor_nome, (pastor_whatsapp <> '') AS tem_whats, (chave_pix <> '') AS tem_pix
         FROM igrejas WHERE status IN ('ativa', 'pendente') ORDER BY nome_fantasia`,
    ).map((i) => ({
      endereco: i.slug, igreja: i.nomeFantasia, cidade: `${i.cidade}/${i.uf}`, pastor_nome: i.pastorNome,
      pastor_whatsapp: '', tipo_chave_pix: '', chave_pix: '',
      situacao_atual: `${i.temWhats ? 'tem WhatsApp' : 'SEM WhatsApp do pastor'}; ${i.temPix ? 'tem PIX' : 'SEM chave PIX'}`,
    }));
    return montarCsv(['endereco', 'igreja', 'cidade', 'pastor_nome', 'pastor_whatsapp', 'tipo_chave_pix', 'chave_pix', 'situacao_atual'], linhas);
  }
  if (tipo === 'semeadores') {
    return montarCsv(['nome', 'sobrenome', 'whatsapp', 'cpf', 'chave_pix', 'codigo_n1'], [
      { nome: 'Exemplo (apague esta linha)', sobrenome: 'Semeador N1', whatsapp: '63999990000', cpf: '00000000000', chave_pix: 'email@exemplo.com', codigo_n1: '' },
      { nome: 'Exemplo (apague esta linha)', sobrenome: 'Semeador N2', whatsapp: '63999990001', cpf: '00000000000', chave_pix: 'email2@exemplo.com', codigo_n1: '63999990000 (WhatsApp ou código do N1)' },
    ]);
  }
  if (tipo === 'ofertas') {
    return montarCsv(['id_origem', 'data', 'whatsapp', 'nome', 'sobrenome', 'igreja', 'quantidade', 'valor', 'numeros', 'anonima'], [
      { id_origem: 'EXEMPLO-1 (apague esta linha)', data: '15/09/2026 19:30', whatsapp: '63999990000', nome: 'Maria', sobrenome: 'Silva', igreja: 'igreja-comunhao', quantidade: '3', valor: '60,00', numeros: '000123 000124 000125', anonima: 'nao' },
      { id_origem: 'EXEMPLO-2 (apague esta linha)', data: '16/09/2026', whatsapp: '', nome: '', sobrenome: '', igreja: 'igreja-comunhao', quantidade: '1', valor: '20,00', numeros: '', anonima: 'sim' },
    ]);
  }
  return montarCsv(['parceiro', 'whatsapp', 'tipo_chave_pix', 'chave_pix'],
    todos<{ nome: string }>('SELECT nome FROM parceiros ORDER BY ordem, nome').map((p) => ({ parceiro: p.nome, whatsapp: '', tipo_chave_pix: '', chave_pix: '' })));
}

/** Confere (e, com `aplicar`, grava) uma planilha. Tudo numa transação: ou entra tudo, ou nada. */
export function importar(tipo: TipoImportacao, linhas: Record<string, string>[], aplicar: boolean) {
  const resultado: ResultadoLinha[] = [];
  const executarTudo = () => {
    if (tipo === 'igrejas') importarIgrejas(linhas, resultado, false);
    else if (tipo === 'semeadores') importarSemeadores(linhas, resultado, false);
    else if (tipo === 'ofertas') importarOfertas(linhas, resultado, false);
    else importarParceiros(linhas, resultado, false);
  };
  const conta = (a: ResultadoLinha['acao']) => resultado.filter((r) => r.acao === a).length;
  const resumo = (aplicado: boolean) => ({ linhas: resultado, criar: conta('criar'), atualizar: conta('atualizar'), ignorar: conta('ignorar'), erros: conta('erro'), aplicado });
  // Planilha com erro nunca é gravada: primeiro confere tudo; só grava se estiver 100% certa.
  executarTudo();
  if (!aplicar || conta('erro') > 0) return resumo(false);
  resultado.length = 0;
  transacao(() => {
    if (tipo === 'igrejas') importarIgrejas(linhas, resultado, true);
    else if (tipo === 'semeadores') importarSemeadores(linhas, resultado, true);
    else if (tipo === 'ofertas') importarOfertas(linhas, resultado, true);
    else importarParceiros(linhas, resultado, true);
  });
  return resumo(true);
}

function validarPix(tipo: string, chave: string, erros: string[]) {
  if (!chave && !tipo) return null;
  const t = tipoPix(tipo);
  if (!TIPOS_PIX.includes(t)) erros.push(`tipo de chave PIX inválido ("${tipo}"): use cnpj, cpf, email, telefone ou aleatoria`);
  if (chave.length < 5) erros.push('chave PIX muito curta');
  return { tipo: t, chave };
}
const validarFone = (v: string, erros: string[], rotulo = 'WhatsApp') => {
  if (!v) return null;
  const f = soDigitos(v).replace(/^55(?=\d{11}$)/, '');
  if (f.length !== 11) erros.push(`${rotulo} precisa ter DDD + número (11 dígitos): "${v}"`);
  return f;
};

function importarIgrejas(linhas: Record<string, string>[], r: ResultadoLinha[], aplicar: boolean) {
  linhas.forEach((l, k) => {
    const n = k + 2; // linha da planilha (1 = cabeçalho)
    const slug = l.endereco || l.slug || '';
    const ig = slug ? um<{ id: string; nomeFantasia: string }>('SELECT id, nome_fantasia FROM igrejas WHERE slug = ?', slug) : undefined;
    if (!ig) return void r.push({ linha: n, referencia: l.igreja || slug || '(vazio)', acao: 'erro', detalhe: 'igreja não encontrada pela coluna "endereco"' });
    const erros: string[] = [];
    const fone = validarFone(l.pastor_whatsapp ?? '', erros, 'WhatsApp do pastor');
    const pix = validarPix(l.tipo_chave_pix ?? '', l.chave_pix ?? '', erros);
    const nome = (l.pastor_nome ?? '').trim();
    if (erros.length) return void r.push({ linha: n, referencia: ig.nomeFantasia, acao: 'erro', detalhe: erros.join('; ') });
    const muda: string[] = [];
    const sets: string[] = [];
    const vals: (string | null)[] = [];
    if (fone) {
      muda.push('WhatsApp do pastor');
      sets.push('pastor_whatsapp = ?', 'pastor_whatsapp_indice = ?');
      vals.push(cifrar(fone), indice(fone));
    }
    if (nome) (muda.push('nome do pastor'), sets.push('pastor_nome = ?'), vals.push(nome));
    if (pix) (muda.push('chave PIX'), sets.push('tipo_chave_pix = ?', 'chave_pix = ?'), vals.push(pix.tipo, cifrar(pix.chave)));
    if (!sets.length) return void r.push({ linha: n, referencia: ig.nomeFantasia, acao: 'ignorar', detalhe: 'nada para mudar' });
    if (aplicar) executar(`UPDATE igrejas SET ${sets.join(', ')} WHERE id = ?`, ...vals, ig.id);
    r.push({ linha: n, referencia: ig.nomeFantasia, acao: 'atualizar', detalhe: muda.join(', ') });
  });
}

function importarSemeadores(linhas: Record<string, string>[], r: ResultadoLinha[], aplicar: boolean) {
  // N1 (sem código de N1) primeiro, para os N2 da mesma planilha acharem o código do N1.
  const ordem = linhas.map((l, k) => ({ l, n: k + 2 })).sort((a, b) => Number(!!a.l.codigo_n1) - Number(!!b.l.codigo_n1));
  const n1DaPlanilha = new Map<string, string | null>(); // WhatsApp do N1 da planilha → id (ao gravar)
  const nosDados = new Set<string>();
  for (const { l, n } of ordem) {
    const ref = `${l.nome ?? ''} ${l.sobrenome ?? ''}`.trim() || '(vazio)';
    if (/exemplo/i.test(l.nome ?? '')) { r.push({ linha: n, referencia: ref, acao: 'ignorar', detalhe: 'linha de exemplo' }); continue; }
    const erros: string[] = [];
    if ((l.nome ?? '').length < 2 || (l.sobrenome ?? '').length < 2) erros.push('nome e sobrenome são obrigatórios');
    const fone = validarFone(l.whatsapp ?? '', erros);
    if (!fone) erros.push('WhatsApp é obrigatório');
    const cpf = soDigitos(l.cpf ?? '');
    if (cpf.length !== 11) erros.push('CPF precisa ter 11 dígitos');
    if ((l.chave_pix ?? '').length < 5) erros.push('chave PIX é obrigatória');
    // N1 da rede: pelo código dele, ou pelo WhatsApp dele (inclusive de um N1 nesta mesma planilha).
    let paiId: string | null = null;
    let paiNaPlanilha = false;
    const codN1 = (l.codigo_n1 ?? '').trim().toUpperCase();
    if (codN1) {
      const foneN1 = soDigitos(codN1).replace(/^55(?=\d{11}$)/, '');
      const pai = foneN1.length === 11
        ? um<{ id: string; paiId: string | null }>('SELECT id, pai_id FROM semeadores WHERE whatsapp_indice = ?', indice(foneN1))
        : um<{ id: string; paiId: string | null }>('SELECT id, pai_id FROM semeadores WHERE codigo = ?', codN1);
      if (pai?.paiId) erros.push(`"${codN1}" é de um N2 (a rede tem 2 níveis)`);
      else if (pai) paiId = pai.id;
      else if (foneN1.length === 11 && n1DaPlanilha.has(foneN1)) (paiNaPlanilha = true, paiId = n1DaPlanilha.get(foneN1) ?? null);
      else erros.push(`N1 "${codN1}" não encontrado (use o código ou o WhatsApp do N1)`);
    }
    if (fone && (nosDados.has(fone) || um('SELECT 1 FROM semeadores WHERE whatsapp_indice = ?', indice(fone)))) {
      r.push({ linha: n, referencia: ref, acao: 'ignorar', detalhe: 'já existe um semeador com este WhatsApp' });
      continue;
    }
    if (erros.length) { r.push({ linha: n, referencia: ref, acao: 'erro', detalhe: erros.join('; ') }); continue; }
    nosDados.add(fone!);
    const codigo = `${(l.nome ?? '').toUpperCase().normalize('NFD').replace(/[^A-Z]/g, '').slice(0, 3) || 'SEM'}${randomInt(1000, 9999)}`;
    const id = novoId();
    if (!codN1) n1DaPlanilha.set(fone!, aplicar ? id : null);
    if (aplicar) {
      inserir('semeadores', {
        id, nome: l.nome, sobrenome: l.sobrenome, whatsapp: cifrar(fone!), whatsappIndice: indice(fone!), cpf: cifrar(cpf),
        chavePix: cifrar(l.chave_pix), codigo, paiId, status: 'ativo',
      });
    }
    r.push({ linha: n, referencia: ref, acao: 'criar', detalhe: `${codN1 ? `N2 de ${paiNaPlanilha ? 'um N1 desta planilha' : codN1}` : 'N1'}${aplicar ? `, código ${codigo}` : ''}` });
  }
  r.sort((a, b) => a.linha - b.linha);
}

function importarParceiros(linhas: Record<string, string>[], r: ResultadoLinha[], aplicar: boolean) {
  linhas.forEach((l, k) => {
    const n = k + 2;
    const nome = (l.parceiro ?? l.nome ?? '').trim();
    if (!nome) return void r.push({ linha: n, referencia: '(vazio)', acao: 'erro', detalhe: 'coluna "parceiro" vazia' });
    const erros: string[] = [];
    const fone = validarFone(l.whatsapp ?? '', erros);
    const pix = validarPix(l.tipo_chave_pix ?? '', l.chave_pix ?? '', erros);
    if (erros.length) return void r.push({ linha: n, referencia: nome, acao: 'erro', detalhe: erros.join('; ') });
    const p = um<{ id: string }>('SELECT id FROM parceiros WHERE lower(nome) = lower(?)', nome);
    if (!fone && !pix) return void r.push({ linha: n, referencia: nome, acao: 'ignorar', detalhe: 'nada para mudar' });
    if (aplicar) {
      const dados = {
        ...(fone ? { whatsapp: cifrar(fone), whatsappIndice: indice(fone) } : {}),
        ...(pix ? { tipoChavePix: pix.tipo, chavePix: cifrar(pix.chave) } : {}),
      };
      if (p) {
        const cols = Object.keys(dados);
        executar(`UPDATE parceiros SET ${cols.map((c) => `${c.replace(/[A-Z]/g, (x) => `_${x.toLowerCase()}`)} = ?`).join(', ')} WHERE id = ?`, ...Object.values(dados), p.id);
      } else inserir('parceiros', { id: novoId(), nome, ativo: false, ...dados });
    }
    r.push({ linha: n, referencia: nome, acao: p ? 'atualizar' : 'criar', detalhe: [fone ? 'WhatsApp' : '', pix ? 'chave PIX' : ''].filter(Boolean).join(', ') + (p ? '' : ' (novo parceiro, fica oculto no app até ativar)') });
  });
}

// ---------- Ofertas da Edição 2026 vindas do sistema antigo (migração) ----------

/** "31/10/2026", "31/10/2026 14:30" ou "2026-10-31[T14:30...]" no horário de Brasília → ISO em UTC. */
function lerData(v: string) {
  const t = v.trim();
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2}))?/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +(m[4] ?? 12) + 3, +(m[5] ?? 0))).toISOString();
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (m && /[zZ]|[+-]\d{2}:?\d{2}$/.test(t)) return new Date(t).toISOString();
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 12) + 3, +(m[5] ?? 0))).toISOString();
  return null;
}
const SIM = ['sim', 's', '1', 'true', 'x', 'anonima', 'anônima'];

/**
 * Cada linha é uma oferta JÁ PAGA no sistema antigo. Entra paga, com os mesmos números da sorte (ou números
 * novos, se a coluna vier vazia), ligada à conta do WhatsApp (criada se não existir).
 * Não gera repasses: a divisão dessas ofertas já foi feita no sistema antigo.
 * "id_origem" (o código da oferta no sistema antigo) impede importar a mesma oferta duas vezes.
 */
function importarOfertas(linhas: Record<string, string>[], r: ResultadoLinha[], aplicar: boolean) {
  const campanha = campanhaAtiva();
  const numerosDaPlanilha = new Set<string>();
  const origensDaPlanilha = new Set<string>();
  linhas.forEach((l, k) => {
    const n = k + 2;
    if (/apague esta linha/i.test(l.id_origem ?? '')) return void r.push({ linha: n, referencia: 'exemplo', acao: 'ignorar', detalhe: 'linha de exemplo do modelo' });
    const origem = (l.id_origem ?? '').trim().replace(/[^\w-]/g, '').slice(0, 40);
    const ref = origem || '(sem id_origem)';
    const erros: string[] = [];
    if (!origem) erros.push('coluna "id_origem" vazia (o código da oferta no sistema antigo)');
    const txid = `MIGR${origem}`;
    if (origem && origensDaPlanilha.has(origem)) erros.push('id_origem repetido na planilha');
    origensDaPlanilha.add(origem);
    if (origem && um('SELECT 1 FROM ofertas WHERE txid = ?', txid)) {
      return void r.push({ linha: n, referencia: ref, acao: 'ignorar', detalhe: 'já importada antes' });
    }
    const igreja = um<{ id: string; nome: string }>('SELECT id, nome_fantasia AS nome FROM igrejas WHERE slug = ?', (l.igreja ?? l.endereco ?? '').trim());
    if (!igreja) erros.push(`igreja não encontrada ("${l.igreja ?? ''}"): use o endereço da igreja, como na planilha de igrejas`);
    const quantidade = Number(soDigitos(l.quantidade ?? ''));
    if (!quantidade || quantidade > 500) erros.push('quantidade de cupons inválida (1 a 500)');
    // "1.234,56" (Brasil) ou "1234.56"; vazio = cupons × valor do cupom.
    const bruto = (l.valor ?? '').replace(/[^\d.,]/g, '');
    const valor = bruto ? Number(bruto.includes(',') ? bruto.replace(/\./g, '').replace(',', '.') : bruto) : quantidade * campanha.valorCupom;
    if (!(valor > 0)) erros.push(`valor inválido ("${l.valor}")`);
    const pagaEm = lerData(l.data ?? '');
    if (!pagaEm) erros.push(`data inválida ("${l.data ?? ''}"): use dd/mm/aaaa ou dd/mm/aaaa hh:mm`);
    const anonima = SIM.includes((l.anonima ?? '').trim().toLowerCase());
    const fone = anonima ? null : validarFone(l.whatsapp ?? '', erros);
    if (!anonima && !fone) erros.push('informe o WhatsApp de quem ofertou (ou anonima = sim)');
    const numeros = (l.numeros ?? '').split(/[\s,;|]+/).filter(Boolean).map((x) => soDigitos(x).padStart(6, '0'));
    if (!anonima && numeros.length) {
      if (numeros.length !== quantidade) erros.push(`a oferta tem ${quantidade} cupom(ns) mas a coluna "numeros" tem ${numeros.length}`);
      for (const num of numeros) {
        if (num.length !== 6) erros.push(`número da sorte inválido: ${num}`);
        else if (numerosDaPlanilha.has(num)) erros.push(`número ${num} repetido na planilha`);
        else if (um('SELECT 1 FROM cupons WHERE campanha_id = ? AND numero = ?', campanha.id, num)) erros.push(`número ${num} já existe nesta campanha`);
        numerosDaPlanilha.add(num);
      }
    }
    if (erros.length) return void r.push({ linha: n, referencia: ref, acao: 'erro', detalhe: erros.join('; ') });

    if (aplicar) {
      let usuarioId: string | null = null;
      if (fone) {
        const existente = um<{ id: string }>('SELECT id FROM usuarios WHERE whatsapp_indice = ? AND excluido_em IS NULL', indice(fone));
        usuarioId = existente?.id ?? novoId();
        if (!existente) {
          inserir('usuarios', {
            id: usuarioId, nome: (l.nome ?? '').trim() || 'Ofertante', sobrenome: (l.sobrenome ?? '').trim(),
            whatsapp: cifrar(fone), whatsappIndice: indice(fone),
          });
        }
      }
      const id = novoId();
      inserir('ofertas', {
        id, campanhaId: campanha.id, usuarioId, igrejaId: igreja!.id, quantidade, valor: Math.round(valor * 100) / 100, anonima,
        status: 'paga', txid, copiaECola: '', divisaoJson: JSON.stringify(regraDaIgreja(igreja!.id, campanha)),
        expiraEm: pagaEm!, criadaEm: pagaEm!, pagaEm: pagaEm!, origem: 'migracao',
        observacao: 'Importada do sistema antigo (Edição 2026). Repasses feitos lá.', registradaPor: 'Importação de planilha',
      });
      if (!anonima) {
        const lista = numeros.length ? numeros : Array.from({ length: quantidade }, () => novoNumero(campanha.id));
        for (const numero of lista) {
          inserir('cupons', { id: novoId(), ofertaId: id, campanhaId: campanha.id, usuarioId, numero, criadoEm: pagaEm! });
        }
      }
    }
    r.push({
      linha: n, referencia: ref, acao: 'criar',
      detalhe: `${igreja!.nome} · ${quantidade} cupom(ns) · R$ ${valor.toFixed(2).replace('.', ',')}${anonima ? ' · anônima' : numeros.length ? '' : ' · números novos'}`,
    });
  });
}
