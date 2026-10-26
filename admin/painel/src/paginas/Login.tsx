import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, salvarSessao, type Admin } from '../api';
import { Simbolo } from '../componentes/Marca';
import { Erro } from '../componentes/ui';
import { salvarSessaoPerfil, type SessaoPerfil } from '../perfil/sessao';

type PerfilOpcao = { tipo: 'equipe' | 'pastor' | 'semeador' | 'parceiro'; rotulo: string; detalhe: string; precisaTotp: boolean };
type Situacao = { tipo: 'pastor' | 'semeador'; nome: string; status: 'pendente' | 'rejeitado'; motivo: string };
type Verificado = { escolha?: string; perfis: PerfilOpcao[]; situacoes: Situacao[] };
type Entrada =
  | { tipo: 'equipe'; token: string; admin: Admin; configurar2fa?: boolean; precisaCodigo?: undefined }
  | { tipo: 'perfil'; token: string; perfil: SessaoPerfil['perfil']; precisaCodigo?: undefined }
  | { precisaCodigo: true; tipo?: undefined };

const mascara = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const so6 = (v: string) => v.replace(/\D/g, '').slice(0, 6);

/**
 * Entrada no painel, como no site: WhatsApp → código → escolha do perfil (equipe, pastor, semeador, parceiro).
 * A equipe também pode entrar com e-mail e senha.
 */
export default function Login() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<'whatsapp' | 'email'>('whatsapp');

  // ---- WhatsApp
  const [fone, setFone] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [verificado, setVerificado] = useState<Verificado | null>(null);
  const [perfilTotp, setPerfilTotp] = useState<PerfilOpcao | null>(null);
  const [totp, setTotp] = useState('');

  const pedirCodigo = useMutation({
    mutationFn: () => api('/entrar/whatsapp/codigo', { method: 'POST', json: { whatsapp: fone } }),
    onSuccess: () => setEnviado(true),
  });
  const conferir = useMutation({
    mutationFn: () => api<Verificado>('/entrar/whatsapp/verificar', { method: 'POST', json: { whatsapp: fone, codigo } }),
    onSuccess: (v) => {
      setVerificado(v);
      // Um perfil só (e sem código do aplicativo): entra direto.
      if (v.escolha && v.perfis.length === 1 && !v.perfis[0].precisaTotp) escolher.mutate({ p: v.perfis[0], escolha: v.escolha });
    },
  });
  const escolher = useMutation({
    mutationFn: ({ p, escolha, codigoTotp }: { p: PerfilOpcao; escolha: string; codigoTotp?: string }) =>
      api<Entrada>('/entrar/perfil', { method: 'POST', json: { escolha, tipo: p.tipo, ...(codigoTotp ? { codigoTotp } : {}) } }),
    onSuccess: (r, { p }) => {
      if (r.precisaCodigo) return setPerfilTotp(p);
      if (r.tipo === 'equipe') {
        salvarSessaoPerfil(null);
        salvarSessao({ token: r.token, admin: r.admin });
        navigate(r.configurar2fa ? '/conta' : '/', { replace: true });
      } else if (r.tipo === 'perfil') {
        salvarSessao(null);
        salvarSessaoPerfil({ token: r.token, perfil: r.perfil });
        navigate('/perfil', { replace: true });
      }
    },
  });

  // ---- E-mail e senha (equipe)
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [pedeTotpEmail, setPedeTotpEmail] = useState(false);
  const [totpEmail, setTotpEmail] = useState('');
  const entrarEmail = useMutation({
    mutationFn: () =>
      api<{ token?: string; admin?: Admin; precisaCodigo?: boolean; configurar2fa?: boolean }>('/login', {
        method: 'POST', json: { email, senha, ...(pedeTotpEmail ? { codigo: totpEmail } : {}) },
      }),
    onSuccess: (s) => {
      if (s.precisaCodigo) return setPedeTotpEmail(true);
      salvarSessaoPerfil(null);
      salvarSessao({ token: s.token!, admin: s.admin! });
      navigate(s.configurar2fa ? '/conta' : '/', { replace: true });
    },
  });

  const enviar = (fn: () => void) => (e: FormEvent) => (e.preventDefault(), fn());
  const recomecar = () => (setEnviado(false), setVerificado(null), setCodigo(''), setPerfilTotp(null), setTotp(''), conferir.reset(), escolher.reset());

  return (
    <div className="tela-login">
      <div className="cartao pilha">
        <div className="login-marca">
          <Simbolo tamanho={56} branca={false} />
          <div>
            <h1>Renovando</h1>
            <p style={{ color: 'var(--texto-2)', margin: '2px 0 0' }}>Painel administrativo</p>
          </div>
        </div>

        <div className="abas-login" role="tablist">
          <button role="tab" aria-selected={modo === 'whatsapp'} className={modo === 'whatsapp' ? 'ativa' : ''} onClick={() => setModo('whatsapp')}>WhatsApp</button>
          <button role="tab" aria-selected={modo === 'email'} className={modo === 'email' ? 'ativa' : ''} onClick={() => setModo('email')}>E-mail e senha</button>
        </div>

        {modo === 'whatsapp' ? (
          perfilTotp && verificado?.escolha ? (
            <form className="pilha" onSubmit={enviar(() => escolher.mutate({ p: perfilTotp, escolha: verificado.escolha!, codigoTotp: totp }))}>
              <Erro erro={escolher.error} />
              <div className="campo">
                <label htmlFor="totp">Código do aplicativo autenticador</label>
                <input id="totp" className="input" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="000000"
                  value={totp} onChange={(e) => setTotp(so6(e.target.value))} />
                <span className="ajuda">Sua conta da equipe tem verificação em duas etapas.</span>
              </div>
              <button className="btn botao-cheio" disabled={escolher.isPending || totp.length !== 6}>Entrar</button>
              <button type="button" className="btn sec" onClick={recomecar}>Voltar</button>
            </form>
          ) : verificado ? (
            <div className="pilha">
              <Erro erro={escolher.error} />
              {verificado.perfis.length > 1 ? (
                <>
                  <strong>Escolha com qual perfil entrar</strong>
                  <span className="ajuda">Esta conta tem mais de um perfil.</span>
                  {verificado.perfis.map((p) => (
                    <button key={p.tipo} className="opcao-perfil" disabled={escolher.isPending}
                      onClick={() => escolher.mutate({ p, escolha: verificado.escolha! })}>
                      <strong>{p.rotulo}</strong>
                      <span>{p.detalhe}</span>
                    </button>
                  ))}
                </>
              ) : verificado.perfis.length === 1 ? (
                <p>Entrando…</p>
              ) : null}
              {verificado.situacoes.map((s) => (
                <div key={s.tipo + s.nome} className={`alerta ${s.status === 'pendente' ? 'info' : ''}`}>
                  {s.status === 'pendente'
                    ? `${s.tipo === 'pastor' ? `O cadastro da ${s.nome}` : 'Seu cadastro de semeador'} está em análise. Você recebe o retorno pelo WhatsApp.`
                    : `${s.tipo === 'pastor' ? `O cadastro da ${s.nome}` : 'Seu cadastro de semeador'} não foi aprovado${s.motivo ? `: ${s.motivo}` : '.'}`}
                </div>
              ))}
              {!verificado.perfis.length ? <button className="btn sec" onClick={recomecar}>Voltar</button> : null}
            </div>
          ) : (
            <form className="pilha" onSubmit={enviar(() => (enviado ? conferir.mutate() : pedirCodigo.mutate()))}>
              <Erro erro={pedirCodigo.error ?? conferir.error} />
              <div className="campo">
                <label htmlFor="fone">WhatsApp</label>
                <input id="fone" className="input" inputMode="tel" autoComplete="tel-national" placeholder="(63) 99999-9999" disabled={enviado}
                  value={mascara(fone)} onChange={(e) => setFone(e.target.value.replace(/\D/g, '').slice(0, 11))} />
              </div>
              {enviado ? (
                <div className="campo">
                  <label htmlFor="cod">Código de acesso</label>
                  <input id="cod" className="input" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="000000"
                    value={codigo} onChange={(e) => setCodigo(so6(e.target.value))} />
                  <span className="ajuda">Se este número tiver acesso ao painel, o código chega pelo WhatsApp em instantes.</span>
                </div>
              ) : null}
              <button className="btn botao-cheio" disabled={(enviado ? conferir.isPending || codigo.length !== 6 : pedirCodigo.isPending || fone.length !== 11)}>
                {enviado ? 'Entrar' : pedirCodigo.isPending ? 'Enviando…' : 'Receber código no WhatsApp'}
              </button>
              {enviado ? <button type="button" className="btn sec" onClick={recomecar}>Alterar número</button> : null}
            </form>
          )
        ) : (
          <form className="pilha" onSubmit={enviar(() => entrarEmail.mutate())}>
            <Erro erro={entrarEmail.error} />
            <div className="campo">
              <label htmlFor="email">E-mail</label>
              <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="campo">
              <label htmlFor="senha">Senha</label>
              <input id="senha" className="input" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            {pedeTotpEmail ? (
              <div className="campo">
                <label htmlFor="codigo">Código do aplicativo autenticador</label>
                <input id="codigo" className="input" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="000000"
                  value={totpEmail} onChange={(e) => setTotpEmail(so6(e.target.value))} required />
              </div>
            ) : null}
            <button className="btn botao-cheio" disabled={entrarEmail.isPending || (pedeTotpEmail && totpEmail.length !== 6)}>
              {entrarEmail.isPending ? 'Entrando…' : pedeTotpEmail ? 'Confirmar código' : 'Entrar'}
            </button>
            <span className="ajuda">Só para a equipe. Pastores, semeadores e parceiros entram pelo WhatsApp.</span>
          </form>
        )}
      </div>
    </div>
  );
}
