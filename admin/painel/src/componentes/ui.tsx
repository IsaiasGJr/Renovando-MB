import { useEffect, type ReactNode } from 'react';

export function Modal({
  titulo,
  onFechar,
  children,
  rodape,
}: {
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);

  return (
    <div className="fundo-modal" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <header>
          <h2>{titulo}</h2>
          <button className="fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </header>
        <div className="corpo">{children}</div>
        {rodape ? <footer>{rodape}</footer> : null}
      </div>
    </div>
  );
}

export function Cabecalho({ titulo, sub, children }: { titulo: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="cabecalho">
      <div>
        <h1>{titulo}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {children ? <div className="linha">{children}</div> : null}
    </div>
  );
}

const CLASSE_STATUS: Record<string, string> = {
  ativa: 'ok', ativo: 'ok', paga: 'ok', publicada: 'ok', fechada: 'ok', sim: 'ok',
  pendente: 'aviso', aguardando_pagamento: 'aviso', nova: 'aviso', em_contato: 'aviso', rascunho: 'aviso',
  rejeitada: 'erro', rejeitado: 'erro', expirada: 'erro', cancelada: 'erro', descartada: 'erro',
};

const ROTULO_STATUS: Record<string, string> = {
  aguardando_pagamento: 'Aguardando', em_contato: 'Em contato',
};

export function Selo({ status }: { status: string }) {
  const rotulo = ROTULO_STATUS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`selo ${CLASSE_STATUS[status] ?? ''}`}>{rotulo}</span>;
}

export function Carregando() {
  return <div className="vazio">Carregando…</div>;
}

export function Erro({ erro }: { erro: unknown }) {
  return erro ? <div className="alerta">{(erro as Error).message}</div> : null;
}
