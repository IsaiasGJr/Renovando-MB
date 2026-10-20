import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api, lerSessao, salvarSessao } from '../api';
import { Cabecalho, Carregando, Erro } from '../componentes/ui';

type Eu = { id: string; nome: string; email: string; papel: string; totpAtivo: boolean; doisFatoresObrigatorio: boolean };
type Inicio = { segredo: string; otpauth: string; qrCode: string };

/** Minha conta: verificação em duas etapas (código do aplicativo autenticador). */
export default function MinhaConta() {
  const qc = useQueryClient();
  const eu = useQuery({ queryKey: ['eu'], queryFn: () => api<Eu>('/me') });
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [inicio, setInicio] = useState<Inicio | null>(null);

  const iniciar = useMutation({
    mutationFn: () => api<Inicio>('/me/2fa/iniciar', { method: 'POST', json: { senha } }),
    onSuccess: (r) => (setInicio(r), setSenha('')),
  });
  const ativar = useMutation({
    mutationFn: () => api<{ token: string }>('/me/2fa/ativar', { method: 'POST', json: { codigo } }),
    onSuccess: ({ token }) => {
      // As outras sessões caem; esta continua com o token novo.
      const s = lerSessao();
      if (s) salvarSessao({ ...s, token });
      setInicio(null);
      setCodigo('');
      qc.invalidateQueries();
    },
  });
  const desativar = useMutation({
    mutationFn: () => api('/me/2fa/desativar', { method: 'POST', json: { senha, codigo } }),
    onSuccess: () => (setSenha(''), setCodigo(''), qc.invalidateQueries({ queryKey: ['eu'] })),
  });

  const so6 = (v: string) => v.replace(/\D/g, '').slice(0, 6);
  const enviar = (fn: () => void) => (e: FormEvent) => (e.preventDefault(), fn());

  if (eu.isLoading) return <Carregando />;
  const d = eu.data;

  return (
    <div className="pilha" style={{ maxWidth: 640 }}>
      <Cabecalho titulo="Minha conta" sub={d ? `${d.nome} · ${d.email}` : undefined} />
      <Erro erro={eu.error} />

      <div className="cartao pilha">
        <h2 style={{ margin: 0 }}>Verificação em duas etapas</h2>
        <p style={{ margin: 0, color: 'var(--texto-2)' }}>
          Além da senha, o login pede um código de 6 dígitos do aplicativo autenticador do seu celular
          (Google Authenticator, Microsoft Authenticator ou Authy). Mesmo que alguém descubra sua senha, não entra.
        </p>
        {d?.doisFatoresObrigatorio && !d.totpAtivo ? (
          <div className="alerta info">A verificação em duas etapas é obrigatória: ative para usar o painel.</div>
        ) : null}

        {d?.totpAtivo ? (
          <>
            <div className="alerta ok">Ativada. O login pede o código do aplicativo.</div>
            {!d.doisFatoresObrigatorio ? (
              <form className="pilha" onSubmit={enviar(() => desativar.mutate())}>
                <strong>Desativar</strong>
                <Erro erro={desativar.error} />
                <div className="form-grade">
                  <div className="campo"><label htmlFor="d-senha">Senha</label>
                    <input id="d-senha" type="password" className="input" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></div>
                  <div className="campo"><label htmlFor="d-cod">Código atual do aplicativo</label>
                    <input id="d-cod" className="input" inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={(e) => setCodigo(so6(e.target.value))} required /></div>
                </div>
                <div><button className="btn sec" disabled={desativar.isPending || codigo.length !== 6}>Desativar verificação</button></div>
              </form>
            ) : null}
          </>
        ) : inicio ? (
          <form className="pilha" onSubmit={enviar(() => ativar.mutate())}>
            <strong>1. No aplicativo autenticador, leia o QR Code</strong>
            <img src={inicio.qrCode} alt="QR Code para o aplicativo autenticador" width={200} height={200} style={{ borderRadius: 8 }} />
            <span className="ajuda">Sem câmera? Digite a chave no aplicativo: <code style={{ userSelect: 'all' }}>{inicio.segredo}</code></span>
            <strong>2. Digite o código de 6 dígitos que aparece no aplicativo</strong>
            <Erro erro={ativar.error} />
            <div className="campo" style={{ maxWidth: 220 }}>
              <input className="input" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" value={codigo}
                onChange={(e) => setCodigo(so6(e.target.value))} aria-label="Código do aplicativo" />
            </div>
            <div className="linha">
              <button className="btn" disabled={ativar.isPending || codigo.length !== 6}>Ativar</button>
              <button type="button" className="btn sec" onClick={() => (setInicio(null), setCodigo(''))}>Cancelar</button>
            </div>
          </form>
        ) : (
          <form className="pilha" onSubmit={enviar(() => iniciar.mutate())}>
            <Erro erro={iniciar.error} />
            <div className="campo" style={{ maxWidth: 320 }}>
              <label htmlFor="a-senha">Confirme sua senha para começar</label>
              <input id="a-senha" type="password" className="input" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            <div><button className="btn" disabled={iniciar.isPending}>Ativar verificação em duas etapas</button></div>
          </form>
        )}
      </div>
      <p className="ajuda">Perdeu o celular? Outro administrador pode desligar a sua verificação em Usuários do painel; depois é só ativar de novo.</p>
    </div>
  );
}
