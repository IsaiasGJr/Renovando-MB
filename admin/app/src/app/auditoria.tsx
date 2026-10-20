import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { api } from '@/api';
import { Chips, Selo, Vazio } from '@/components/admin';
import { Aviso, Carregando, Cartao, s as ui } from '@/components/ui';
import { useEhAdmin } from '@/store/sessao';
import { cores, espaco } from '@/theme';
import { dataHora } from '@/utils/format';

type Registro = {
  id: string; adminNome: string; acao: string; recurso: string; resumo: string;
  detalhes: Record<string, unknown>; ip: string; criadoEm: string;
};
type Pagina = { total: number; pagina: number; porPagina: number; linhas: Registro[] };

const ROTULO_ACAO: Record<string, string> = {
  criar: 'Criou', editar: 'Editou', excluir: 'Excluiu', ativar: 'Ativou', sortear: 'Sorteou',
  desfazer_sorteio: 'Desfez sorteio', login: 'Entrou', login_falhou: 'Login recusado',
  exportar: 'Exportou', encerrar_sessoes: 'Saiu de todos os aparelhos', enviar_aviso: 'Enviou aviso',
  ativar_2fa: 'Ativou verificação em 2 etapas', desativar_2fa: 'Desativou verificação em 2 etapas', login_2fa_falhou: 'Código de login recusado',
};
const ROTULO_RECURSO: Record<string, string> = {
  igrejas: 'Igreja', semeadores: 'Semeador', campanhas: 'Campanha', premios: 'Prêmio', noticias: 'Notícia',
  depoimentos: 'Depoimento', faqs: 'Pergunta', artistas: 'Artista', 'solicitacoes-show': 'Pedido de show',
  admins: 'Usuário do admin', sessao: 'Sessão', upload: 'Imagem', conta: 'Conta de ofertante', relatorios: 'Relatório', avisos: 'Aviso no celular',
};
const STATUS_ACAO: Record<string, string> = { login_falhou: 'rejeitada', excluir: 'rejeitada', editar: 'pendente' };

const FILTROS = [
  { valor: '', rotulo: 'Tudo' }, { valor: 'igrejas', rotulo: 'Igrejas' }, { valor: 'semeadores', rotulo: 'Semeadores' },
  { valor: 'premios', rotulo: 'Prêmios' }, { valor: 'campanhas', rotulo: 'Campanhas' }, { valor: 'admins', rotulo: 'Usuários' },
  { valor: 'sessao', rotulo: 'Logins' },
];

function mudancas(r: Registro) {
  if (r.acao !== 'editar') return '';
  const fmt = (x: unknown) => (x == null || x === '' ? '(vazio)' : typeof x === 'object' ? JSON.stringify(x) : String(x));
  return Object.entries(r.detalhes)
    .map(([campo, v]) => {
      const { de, para } = (v ?? {}) as { de?: unknown; para?: unknown };
      return `${campo}: ${fmt(de)} → ${fmt(para)}`;
    })
    .join('\n');
}

export default function Auditoria() {
  const ehAdmin = useEhAdmin();
  const [recurso, setRecurso] = useState('');
  const q = useInfiniteQuery({
    queryKey: ['auditoria', recurso],
    queryFn: ({ pageParam }) => api<Pagina>(`/auditoria?pagina=${pageParam}${recurso ? `&recurso=${recurso}` : ''}`),
    initialPageParam: 1,
    getNextPageParam: (p) => (p.pagina * p.porPagina < p.total ? p.pagina + 1 : undefined),
    enabled: ehAdmin,
  });

  if (!ehAdmin) return <Vazio texto="Apenas administradores podem ver o registro." icone="lock-closed-outline" />;
  const linhas = q.data?.pages.flatMap((p) => p.linhas) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <FlatList
        data={linhas}
        keyExtractor={(r) => r.id}
        contentContainerStyle={ui.conteudo}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={cores.primaria} />}
        ItemSeparatorComponent={() => <View style={{ height: espaco.sm }} />}
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={cores.primaria} /> : null}
        ListHeaderComponent={
          <View style={{ gap: espaco.md }}>
            <Text style={{ color: cores.textoSuave, lineHeight: 20 }}>
              Quem fez o quê: cadastros, alterações (inclusive de chave PIX), sorteios e logins.
            </Text>
            <Chips opcoes={FILTROS} valor={recurso} onChange={setRecurso} />
            {q.isLoading ? <Carregando /> : null}
            {q.error ? <Aviso>{(q.error as Error).message}</Aviso> : null}
          </View>
        }
        ListEmptyComponent={q.data ? <Vazio texto="Nada registrado." /> : null}
        renderItem={({ item: r }) => (
          <Cartao style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espaco.sm }}>
              <Text style={{ fontWeight: '700', color: cores.texto, flexShrink: 1 }}>{r.adminNome}</Text>
              <Selo status={STATUS_ACAO[r.acao] ?? 'ativa'} texto={ROTULO_ACAO[r.acao] ?? r.acao} />
            </View>
            <Text style={{ color: cores.texto }}>{ROTULO_RECURSO[r.recurso] ?? r.recurso}{r.resumo ? `: ${r.resumo}` : ''}</Text>
            {mudancas(r) ? <Text style={{ color: cores.textoSuave, fontSize: 12 }}>{mudancas(r)}</Text> : null}
            <Text style={{ color: cores.textoSuave, fontSize: 12 }}>{dataHora(r.criadoEm)}{r.ip ? ` · IP ${r.ip}` : ''}</Text>
          </Cartao>
        )}
      />
    </View>
  );
}
