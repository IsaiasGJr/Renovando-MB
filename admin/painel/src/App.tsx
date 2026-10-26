import { useMutation } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import {
  BarChart3, Building2, ClipboardList, Flag, Gift, HelpCircle, LayoutDashboard, LogOut,
  MessageSquareQuote, Music, Newspaper, ShieldCheck, Sprout, Users, ImageIcon, Handshake, Images, Inbox, Bell, Scale,
  ClipboardCheck, LifeBuoy, Wallet,
} from './componentes/icones';
import { Simbolo } from './componentes/Marca';
import { api, lerSessao, salvarSessao, type Admin } from './api';
import { Carregando, Erro } from './componentes/ui';
import { useDashboard } from './consultas';

// Cada página vira um arquivo separado, baixado só quando é aberta:
// o login e o menu abrem rápido e os gráficos (Recharts) só carregam quando precisam.
const Auditoria = lazy(() => import('./paginas/Auditoria'));
const Avisos = lazy(() => import('./paginas/Avisos'));
const MinhaConta = lazy(() => import('./paginas/MinhaConta'));
const Aprovacoes = lazy(() => import('./paginas/Aprovacoes'));
const Repasses = lazy(() => import('./paginas/Repasses'));
const Ajuda = lazy(() => import('./paginas/Ajuda'));
const Campanhas = lazy(() => import('./paginas/Campanhas'));
const Dashboard = lazy(() => import('./paginas/Dashboard'));
const Premios = lazy(() => import('./paginas/Premios'));
const Relatorios = lazy(() => import('./paginas/Relatorios'));
const conteudo = () => import('./paginas/Conteudo');
const Banners = lazy(() => conteudo().then((m) => ({ default: m.Banners })));
const GaleriaPalmas = lazy(() => conteudo().then((m) => ({ default: m.GaleriaPalmas })));
const Mensagens = lazy(() => conteudo().then((m) => ({ default: m.Mensagens })));
const PaginasLegais = lazy(() => conteudo().then((m) => ({ default: m.PaginasLegais })));
const Parceiros = lazy(() => conteudo().then((m) => ({ default: m.Parceiros })));
const cadastros = () => import('./paginas/Cadastros');
const Depoimentos = lazy(() => cadastros().then((m) => ({ default: m.Depoimentos })));
const Faqs = lazy(() => cadastros().then((m) => ({ default: m.Faqs })));
const Igrejas = lazy(() => cadastros().then((m) => ({ default: m.Igrejas })));
const Noticias = lazy(() => cadastros().then((m) => ({ default: m.Noticias })));
const Ofertantes = lazy(() => cadastros().then((m) => ({ default: m.Ofertantes })));
const Semeadores = lazy(() => cadastros().then((m) => ({ default: m.Semeadores })));
const Shows = lazy(() => cadastros().then((m) => ({ default: m.Shows })));
const UsuariosAdmin = lazy(() => cadastros().then((m) => ({ default: m.UsuariosAdmin })));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protegido />}>
        <Route index element={<Dashboard />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="ofertantes" element={<Ofertantes />} />
        <Route path="campanhas" element={<Campanhas />} />
        <Route path="premios" element={<Premios />} />
        <Route path="igrejas" element={<Igrejas />} />
        <Route path="semeadores" element={<Semeadores />} />
        <Route path="noticias" element={<Noticias />} />
        <Route path="depoimentos" element={<Depoimentos />} />
        <Route path="faq" element={<Faqs />} />
        <Route path="shows" element={<Shows />} />
        <Route path="usuarios" element={<UsuariosAdmin />} />
        <Route path="auditoria" element={<Auditoria />} />
        <Route path="avisos" element={<Avisos />} />
        <Route path="conta" element={<MinhaConta />} />
        <Route path="aprovacoes" element={<Aprovacoes />} />
        <Route path="repasses" element={<Repasses />} />
        <Route path="ajuda" element={<Ajuda />} />
        <Route path="banners" element={<Banners />} />
        <Route path="parceiros" element={<Parceiros />} />
        <Route path="galeria" element={<GaleriaPalmas />} />
        <Route path="paginas" element={<PaginasLegais />} />
        <Route path="mensagens" element={<Mensagens />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function Protegido() {
  const sessao = lerSessao();
  if (!sessao) return <Navigate to="/login" replace />;
  return <Layout admin={sessao.admin} />;
}

function Layout({ admin }: { admin: Admin }) {
  const navigate = useNavigate();
  const { data } = useDashboard();
  const pend = data?.pendencias;
  const ehAdmin = admin.papel === 'admin';
  const [menuAberto, setMenuAberto] = useState(false);
  const totalPend = (pend?.igrejas ?? 0) + (pend?.semeadores ?? 0) + (pend?.shows ?? 0);

  useEffect(() => {
    if (!menuAberto) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuAberto(false);
    window.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [menuAberto]);

  const link = (para: string, rotulo: string, Icone: typeof Gift, contador?: number) => (
    <NavLink to={para} end={para === '/'} onClick={() => setMenuAberto(false)}>
      <Icone size={18} strokeWidth={2} aria-hidden="true" />
      <span className="texto-link">{rotulo}</span>
      {contador ? <span className="contador" aria-label={`${contador} pendentes`}>{contador}</span> : null}
    </NavLink>
  );

  return (
    <div className="layout">
      {/* Barra do topo: só aparece no celular */}
      <header className="barra-topo">
        <button className="botao-menu" onClick={() => setMenuAberto(true)} aria-label="Abrir menu" aria-expanded={menuAberto}>
          <span /><span /><span />
          {totalPend ? <span className="ponto" aria-hidden="true" /> : null}
        </button>
        <div className="marca"><Simbolo tamanho={30} />Renovando<small>Admin</small></div>
      </header>
      {menuAberto ? <div className="fundo-menu" onClick={() => setMenuAberto(false)} aria-hidden="true" /> : null}

      <nav className={`menu ${menuAberto ? 'aberto' : ''}`} aria-label="Menu principal">
        <button className="fechar-menu" onClick={() => setMenuAberto(false)} aria-label="Fechar menu">×</button>
        <div className="marca"><Simbolo />
          <div>Renovando<small>Painel administrativo</small></div>
        </div>
        {link('/', 'Visão geral', LayoutDashboard)}
        {link('/relatorios', 'Relatórios', BarChart3)}
        {link('/ofertantes', 'Ofertantes', Users)}
        {ehAdmin ? link('/repasses', 'Repasses', Wallet) : null}
        <div className="grupo">Campanha</div>
        {ehAdmin ? link('/campanhas', 'Campanhas', Flag) : null}
        {link('/premios', 'Prêmios e sorteios', Gift)}
        <div className="grupo">Rede</div>
        {link('/aprovacoes', 'Aprovações', ClipboardCheck, (pend?.igrejas ?? 0) + (pend?.semeadores ?? 0))}
        {link('/igrejas', 'Igrejas', Building2)}
        {link('/semeadores', 'Semeadores', Sprout)}
        <div className="grupo">Conteúdo do app</div>
        {link('/noticias', 'Notícias', Newspaper)}
        {link('/depoimentos', 'Depoimentos', MessageSquareQuote)}
        {link('/faq', 'Perguntas frequentes', HelpCircle)}
        {link('/banners', 'Banners do topo', ImageIcon)}
        {link('/parceiros', 'Parcerias', Handshake)}
        {link('/galeria', 'Galeria Palmas para Jesus', Images)}
        {link('/mensagens', 'Mensagens', Inbox, pend?.mensagens)}
        {link('/shows', 'Shows gospel', Music, pend?.shows)}
        {ehAdmin ? (
          <>
            <div className="grupo">Sistema</div>
            {link('/avisos', 'Avisos no celular', Bell)}
            {link('/usuarios', 'Usuários do painel', ShieldCheck)}
            {link('/paginas', 'Páginas legais', Scale)}
            {link('/auditoria', 'Registro de atividades', ClipboardList)}
          </>
        ) : null}
        {link('/ajuda', 'Central de ajuda', LifeBuoy)}
        <div className="rodape">
          <NavLink to="/conta" className="quem-link" onClick={() => setMenuAberto(false)} title="Minha conta">
            <span className="avatar" aria-hidden="true">{admin.nome.charAt(0).toUpperCase()}</span>
            <div className="quem">
              <strong>{admin.nome}</strong>
              <span>{admin.papel === 'admin' ? 'Administrador' : 'Editor'} · Minha conta</span>
            </div>
          </NavLink>
          <button onClick={() => (salvarSessao(null), navigate('/login'))} aria-label="Sair" title="Sair"><LogOut size={18} /></button>
        </div>
      </nav>
      <main className="conteudo">
        <Suspense fallback={<Carregando />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  // Segunda etapa: depois da senha certa, o servidor pede o código do aplicativo autenticador.
  const [pedeCodigo, setPedeCodigo] = useState(false);
  const [codigo, setCodigo] = useState('');
  const entrar = useMutation({
    mutationFn: () =>
      api<{ token?: string; admin?: Admin; precisaCodigo?: boolean; configurar2fa?: boolean }>('/login', {
        method: 'POST', json: { email, senha, ...(pedeCodigo ? { codigo } : {}) },
      }),
    onSuccess: (s) => {
      if (s.precisaCodigo) return setPedeCodigo(true);
      salvarSessao({ token: s.token!, admin: s.admin! });
      navigate(s.configurar2fa ? '/conta' : '/', { replace: true });
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    entrar.mutate();
  }

  return (
    <div className="tela-login">
      <form className="cartao pilha" onSubmit={enviar}>
        <div className="login-marca">
          <Simbolo tamanho={56} branca={false} />
          <div>
            <h1>Renovando</h1>
            <p style={{ color: 'var(--texto-2)', margin: '2px 0 0' }}>Painel administrativo</p>
          </div>
        </div>
        <Erro erro={entrar.error} />
        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input id="senha" className="input" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </div>
        {pedeCodigo ? (
          <div className="campo">
            <label htmlFor="codigo">Código do aplicativo autenticador</label>
            <input id="codigo" className="input" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="000000"
              value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
            <span className="ajuda">Abra o Google Authenticator (ou similar) e digite o código de 6 dígitos do Renovando Admin.</span>
          </div>
        ) : null}
        <button className="btn" style={{ justifyContent: 'center', minHeight: 40 }} disabled={entrar.isPending || (pedeCodigo && codigo.length !== 6)}>
          {entrar.isPending ? 'Entrando…' : pedeCodigo ? 'Confirmar código' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
