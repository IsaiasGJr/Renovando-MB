import { useState } from 'react';
import { enviarImagem } from '../api';

export type CampoDef = {
  nome: string;
  rotulo: string;
  tipo?: 'texto' | 'textarea' | 'numero' | 'checkbox' | 'select' | 'data' | 'datahora' | 'imagem' | 'galeria' | 'senha' | 'email';
  opcoes?: { valor: string; rotulo: string }[];
  largo?: boolean;
  ajuda?: string;
  obrigatorio?: boolean;
  padrao?: unknown;
  /** Esconde o campo ao editar um registro existente. */
  soNaCriacao?: boolean;
};

export type Valores = Record<string, unknown>;

/** ISO → valor aceito por <input type="datetime-local">. */
function paraLocal(iso: unknown) {
  if (!iso) return '';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function valoresIniciais(campos: CampoDef[], registro?: Valores): Valores {
  const v: Valores = {};
  for (const c of campos) {
    const atual = registro?.[c.nome];
    if (c.tipo === 'datahora') v[c.nome] = paraLocal(atual ?? c.padrao);
    else if (c.tipo === 'checkbox') v[c.nome] = atual === undefined ? (c.padrao ?? false) : !!atual;
    else if (c.tipo === 'senha') v[c.nome] = '';
    else if (c.tipo === 'galeria') v[c.nome] = Array.isArray(atual) ? atual : [];
    else v[c.nome] = atual ?? c.padrao ?? '';
  }
  return v;
}

/** Converte os valores do formulário para o formato que a API espera. */
export function paraPayload(campos: CampoDef[], v: Valores, editando: boolean): Valores {
  const out: Valores = {};
  for (const c of campos) {
    if (editando && c.soNaCriacao) continue;
    const valor = v[c.nome];
    if (c.tipo === 'numero') out[c.nome] = valor === '' ? 0 : Number(valor);
    else if (c.tipo === 'datahora') out[c.nome] = valor ? new Date(String(valor)).toISOString() : null;
    else if (c.tipo === 'senha') {
      if (valor) out[c.nome] = valor;
    } else out[c.nome] = valor;
  }
  return out;
}

export function Formulario({
  campos,
  valores,
  onChange,
  editando,
}: {
  campos: CampoDef[];
  valores: Valores;
  onChange: (v: Valores) => void;
  editando: boolean;
}) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erroUpload, setErroUpload] = useState('');
  const set = (nome: string, valor: unknown) => onChange({ ...valores, [nome]: valor });

  return (
    <div className="form-grade">
      {campos
        .filter((c) => !(editando && c.soNaCriacao))
        .map((c) => {
          const id = `campo-${c.nome}`;
          const valor = valores[c.nome];
          const classe = `campo ${c.largo || c.tipo === 'textarea' || c.tipo === 'imagem' || c.tipo === 'galeria' ? 'largo' : ''}`;

          if (c.tipo === 'checkbox') {
            return (
              <div key={c.nome} className={classe}>
                <label className="check">
                  <input type="checkbox" checked={!!valor} onChange={(e) => set(c.nome, e.target.checked)} />
                  {c.rotulo}
                </label>
                {c.ajuda ? <span className="ajuda">{c.ajuda}</span> : null}
              </div>
            );
          }

          let input;
          if (c.tipo === 'textarea') {
            input = <textarea id={id} className="input" value={String(valor ?? '')} onChange={(e) => set(c.nome, e.target.value)} />;
          } else if (c.tipo === 'select') {
            input = (
              <select id={id} className="input" value={String(valor ?? '')} onChange={(e) => set(c.nome, e.target.value)}>
                {c.opcoes?.map((o) => (
                  <option key={o.valor} value={o.valor}>{o.rotulo}</option>
                ))}
              </select>
            );
          } else if (c.tipo === 'galeria') {
            const lista = (valor as string[]) ?? [];
            input = (
              <div className="galeria-campo">
                {lista.map((url) => (
                  <div key={url} className="galeria-item">
                    <img src={url} alt="" />
                    <button type="button" className="btn perigo peq" aria-label="Remover foto"
                      onClick={() => set(c.nome, lista.filter((u) => u !== url))}>Remover</button>
                  </div>
                ))}
                {lista.length < 20 ? (
                  <label className="btn sec peq">
                    {enviando === c.nome ? 'Enviando…' : '+ Adicionar fotos'}
                    <input type="file" accept="image/*" multiple hidden
                      onChange={async (e) => {
                        const arquivos = [...(e.target.files ?? [])].slice(0, 20 - lista.length);
                        if (!arquivos.length) return;
                        setErroUpload('');
                        setEnviando(c.nome);
                        try {
                          const novas: string[] = [];
                          for (const f of arquivos) novas.push(await enviarImagem(f));
                          set(c.nome, [...lista, ...novas]);
                        } catch (err) {
                          setErroUpload((err as Error).message);
                        } finally {
                          setEnviando(null);
                          e.target.value = '';
                        }
                      }} />
                  </label>
                ) : null}
              </div>
            );
          } else if (c.tipo === 'imagem') {
            input = (
              <div className="linha">
                {valor ? <img className="miniatura" src={String(valor)} alt="" /> : null}
                <input id={id} className="input" style={{ flex: 1 }} placeholder="URL da imagem ou envie um arquivo"
                  value={String(valor ?? '')} onChange={(e) => set(c.nome, e.target.value)} />
                <label className="btn sec peq">
                  {enviando === c.nome ? 'Enviando…' : 'Enviar arquivo'}
                  <input type="file" accept="image/*" hidden
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setErroUpload('');
                      setEnviando(c.nome);
                      try {
                        set(c.nome, await enviarImagem(f));
                      } catch (err) {
                        setErroUpload((err as Error).message);
                      } finally {
                        setEnviando(null);
                      }
                    }} />
                </label>
              </div>
            );
          } else {
            const tipoHtml = { numero: 'number', data: 'date', datahora: 'datetime-local', senha: 'password', email: 'email' }[
              c.tipo as string
            ] ?? 'text';
            input = (
              <input id={id} className="input" type={tipoHtml} step={c.tipo === 'numero' ? 'any' : undefined}
                required={c.obrigatorio} value={String(valor ?? '')}
                autoComplete={c.tipo === 'senha' ? 'new-password' : undefined}
                onChange={(e) => set(c.nome, e.target.value)} />
            );
          }

          return (
            <div key={c.nome} className={classe}>
              <label htmlFor={id}>
                {c.rotulo}
                {c.obrigatorio ? ' *' : ''}
              </label>
              {input}
              {c.ajuda ? <span className="ajuda">{c.ajuda}</span> : null}
              {(c.tipo === 'imagem' || c.tipo === 'galeria') && erroUpload ? <span className="ajuda" style={{ color: 'var(--erro)' }}>{erroUpload}</span> : null}
            </div>
          );
        })}
    </div>
  );
}
