import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, baixar } from '../api';
import { Cabecalho, Erro } from '../componentes/ui';

type Tipo = 'igrejas' | 'semeadores' | 'parceiros';
type Resultado = {
  linhas: { linha: number; referencia: string; acao: 'atualizar' | 'criar' | 'ignorar' | 'erro'; detalhe: string }[];
  criar: number; atualizar: number; ignorar: number; erros: number; aplicado: boolean;
};

const TIPOS: { valor: Tipo; titulo: string; texto: string }[] = [
  { valor: 'igrejas', titulo: 'Igrejas: WhatsApp do pastor e chave PIX',
    texto: 'O modelo já vem com todas as igrejas. Preencha só o que falta (WhatsApp do pastor e, se precisar, a chave PIX). Célula vazia não muda nada.' },
  { valor: 'semeadores', titulo: 'Semeadores N1 e N2',
    texto: 'Uma linha por semeador. Para um N2, ponha em "codigo_n1" o código ou o WhatsApp do N1 (pode ser um N1 da mesma planilha). Entram como ativos.' },
  { valor: 'parceiros', titulo: 'Parceiros: WhatsApp e chave PIX',
    texto: 'O modelo vem com as parcerias cadastradas. O WhatsApp dá acesso ao portal do parceiro; a chave PIX é usada nos repasses.' },
];
const ACAO = { atualizar: 'Atualizar', criar: 'Criar', ignorar: 'Sem mudança', erro: 'Erro' } as const;

/** Importação por planilha (CSV do Excel): primeiro confere, depois grava. Planilha com erro não é gravada. */
export default function Importacoes() {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<Tipo>('igrejas');
  const [csv, setCsv] = useState('');
  const [arquivo, setArquivo] = useState('');
  const [erroModelo, setErroModelo] = useState<unknown>(null);
  const processar = useMutation({
    mutationFn: (aplicar: boolean) => api<Resultado>(`/importacoes/${tipo}`, { method: 'POST', json: { csv, aplicar } }),
    onSuccess: (r) => r.aplicado && qc.invalidateQueries(),
  });
  const r = processar.data;
  const trocarTipo = (t: Tipo) => (setTipo(t), setCsv(''), setArquivo(''), processar.reset());

  return (
    <div className="pilha" style={{ maxWidth: 980 }}>
      <Cabecalho titulo="Importar planilhas" sub="Preencha no Excel e envie aqui. O sistema mostra tudo o que vai mudar antes de gravar." />
      <div className="abas">
        {TIPOS.map((t) => (
          <button key={t.valor} className={`btn ${tipo === t.valor ? '' : 'sec'} peq`} onClick={() => trocarTipo(t.valor)}>{t.titulo}</button>
        ))}
      </div>
      <div className="cartao pilha">
        <p style={{ margin: 0 }}>{TIPOS.find((t) => t.valor === tipo)!.texto}</p>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li><button className="btn sec peq" onClick={() => baixar(`/importacoes/${tipo}/modelo.csv`, `modelo-${tipo}.csv`).catch(setErroModelo)}>Baixar o modelo</button></li>
          <li>Abra no Excel, preencha e salve como <strong>CSV (separado por ponto e vírgula)</strong>.</li>
          <li>
            <label className="btn sec peq">
              {arquivo ? `Trocar arquivo (${arquivo})` : 'Escolher a planilha preenchida'}
              <input type="file" accept=".csv,text/csv" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                processar.reset();
                setArquivo(f.name);
                // Excel às vezes salva em Windows-1252: se aparecer "�", lê de novo nessa codificação.
                let texto = await f.text();
                if (texto.includes('�')) texto = new TextDecoder('windows-1252').decode(await f.arrayBuffer());
                setCsv(texto);
              }} />
            </label>
          </li>
          <li>Clique em <strong>Conferir</strong>, revise e depois em <strong>Importar</strong>.</li>
        </ol>
        <Erro erro={erroModelo ?? processar.error} />
        <div className="linha">
          <button className="btn sec" disabled={!csv || processar.isPending} onClick={() => processar.mutate(false)}>Conferir</button>
          <button className="btn" disabled={!r || r.aplicado || r.erros > 0 || r.criar + r.atualizar === 0 || processar.isPending}
            onClick={() => confirm(`Gravar ${r!.criar + r!.atualizar} mudança(s)?`) && processar.mutate(true)}>Importar</button>
        </div>
      </div>

      {r ? (
        <div className="cartao pilha">
          {r.aplicado ? <div className="alerta ok">Importado: {r.criar} novo(s) e {r.atualizar} atualizado(s).</div>
            : r.erros ? <div className="alerta">Há {r.erros} linha(s) com erro. Corrija na planilha e confira de novo: nada foi gravado.</div>
            : <div className="alerta info">Conferido: {r.criar} novo(s), {r.atualizar} para atualizar, {r.ignorar} sem mudança. Nada foi gravado ainda.</div>}
          <div className="tabela-wrap">
            <table className="cartoes">
              <thead><tr><th>Linha</th><th>Registro</th><th>Ação</th><th>Detalhe</th></tr></thead>
              <tbody>
                {r.linhas.map((l) => (
                  <tr key={l.linha} style={l.acao === 'erro' ? { background: 'var(--erro-claro)' } : undefined}>
                    <td data-rotulo="Linha">{l.linha}</td><td data-titulo>{l.referencia}</td>
                    <td data-rotulo="Ação"><strong>{ACAO[l.acao]}</strong></td><td data-rotulo="Detalhe">{l.detalhe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
