import { Image } from 'expo-image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { api, baixarArquivo, urlImagem } from '@/api';
import { BotaoNovo, Chips, Info, Vazio } from '@/components/admin';
import { Aviso, Botao, Carregando, Cartao, s as ui } from '@/components/ui';
import { RECURSOS } from '@/recursos';
import { useEhAdmin } from '@/store/sessao';
import { cores, espaco, raio } from '@/theme';
import { useCampanhas } from '@/tipos';
import { confirmar } from '@/utils/confirmar';

type Linha = Record<string, any> & { id: string };

export default function Lista() {
  const { recurso, status: statusInicial } = useLocalSearchParams<{ recurso: string; status?: string }>();
  const r = RECURSOS[recurso];
  const qc = useQueryClient();
  const ehAdmin = useEhAdmin();
  const [status, setStatus] = useState(statusInicial ?? '');

  // Prêmios: escolher a campanha (padrão: a ativa).
  // PDF do panfleto da igreja (1 ou 6 por folha A4).
  const panfleto = useMutation({
    mutationFn: ({ id, slug, porPagina }: { id: string; slug: string; porPagina: 1 | 6 }) =>
      baixarArquivo(`/igrejas/${id}/panfleto?porPagina=${porPagina}`, `panfleto-${slug}-${porPagina}-por-pagina.pdf`, 'application/pdf'),
  });

  const ehPremios = recurso === 'premios';
  const campanhas = useCampanhas();
  const [campanhaEscolhida, setCampanhaEscolhida] = useState('');
  const campanhaId = ehPremios
    ? campanhaEscolhida || (campanhas.data?.find((c) => c.ativa) ?? campanhas.data?.[0])?.id || ''
    : '';

  const params = new URLSearchParams({ ...(status ? { status } : {}), ...(campanhaId ? { campanhaId } : {}) }).toString();
  const lista = useQuery({
    queryKey: [r?.caminho, params],
    queryFn: () => api<Linha[]>(`/${r.caminho}${params ? `?${params}` : ''}`),
    enabled: !!r && (!ehPremios || !!campanhaId),
  });

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: [r.caminho] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const mudarStatus = useMutation({
    mutationFn: ({ id, novo }: { id: string; novo: string }) => api(`/${r.caminho}/${id}`, { method: 'PUT', json: { status: novo } }),
    onSuccess: recarregar,
  });
  const desfazer = useMutation({
    mutationFn: (id: string) => api(`/premios/${id}/desfazer-sorteio`, { method: 'POST' }),
    onSuccess: recarregar,
  });

  if (!r) return <Vazio texto="Cadastro não encontrado." />;
  if (r.soAdmin && !ehAdmin) return <Vazio texto="Apenas administradores podem acessar." icone="lock-closed-outline" />;

  const editar = (id?: string) =>
    router.push({ pathname: '/[recurso]/editar', params: { recurso, ...(id ? { id } : {}), ...(campanhaId ? { campanhaId } : {}) } });

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <Stack.Screen options={{ title: r.titulo }} />
      <FlatList
        data={lista.data ?? []}
        keyExtractor={(l) => l.id}
        contentContainerStyle={[ui.conteudo, { paddingBottom: 100 }]}
        refreshControl={<RefreshControl refreshing={lista.isRefetching} onRefresh={lista.refetch} tintColor={cores.primaria} />}
        ListHeaderComponent={
          <View style={{ gap: espaco.md }}>
            {r.descricao ? <Text style={{ color: cores.textoSuave, lineHeight: 20 }}>{r.descricao}</Text> : null}
            {ehPremios && campanhas.data ? (
              <Chips opcoes={campanhas.data.map((c) => ({ valor: c.id, rotulo: `${c.edicao}${c.ativa ? ' (ativa)' : ''}` }))}
                valor={campanhaId} onChange={setCampanhaEscolhida} />
            ) : null}
            {r.filtroStatus ? <Chips opcoes={r.filtroStatus} valor={status} onChange={setStatus} /> : null}
            {lista.isLoading ? <Carregando /> : null}
            {lista.error ? <Aviso>{(lista.error as Error).message}</Aviso> : null}
            {mudarStatus.error ? <Aviso>{(mudarStatus.error as Error).message}</Aviso> : null}
            {panfleto.error ? <Aviso>{(panfleto.error as Error).message}</Aviso> : null}
          </View>
        }
        ListEmptyComponent={lista.data ? <Vazio texto="Nenhum registro." /> : null}
        renderItem={({ item: l }) => {
          const it = r.item(l);
          const rapidas = r.acoesRapidas?.(l) ?? [];
          return (
            <Cartao style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: espaco.md, alignItems: 'flex-start' }}>
                  {it.imagem ? (
                    <Image source={urlImagem(it.imagem)} style={{ width: 56, height: 56, borderRadius: raio.sm, backgroundColor: '#EEE8EC' }} contentFit="cover" cachePolicy="memory-disk" recyclingKey={it.imagem} />
                  ) : null}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: cores.texto }}>{it.titulo}</Text>
                    {it.sub ? <Text style={{ color: cores.textoSuave, fontSize: 13 }} numberOfLines={2}>{it.sub}</Text> : null}
                  </View>
                  {it.status}
                </View>
                {it.infos?.map(([rotulo, valor]) => <Info key={rotulo} rotulo={rotulo}>{valor}</Info>)}

                <View style={{ flexDirection: 'row', gap: espaco.sm, marginTop: 4 }}>
                    {rapidas.map((a) => (
                      <Botao key={a.status} titulo={a.rotulo} variante={a.perigo ? 'contorno' : 'primario'} style={{ flex: 1, minHeight: 42 }}
                        corTexto={a.perigo ? cores.erro : undefined}
                        carregando={mudarStatus.isPending && mudarStatus.variables?.id === l.id && mudarStatus.variables.novo === a.status}
                        onPress={() => mudarStatus.mutate({ id: l.id, novo: a.status })} />
                    ))}
                    {ehPremios && ehAdmin && !l.ganhadorNumero ? (
                      <Botao titulo="Sortear" icone="shuffle" style={{ flex: 1, minHeight: 42 }}
                        onPress={() => router.push({ pathname: '/sorteio', params: { id: l.id, nome: l.nome } })} />
                    ) : null}
                    {ehPremios && ehAdmin && l.ganhadorNumero ? (
                      <Botao titulo="Desfazer sorteio" variante="contorno" style={{ flex: 1, minHeight: 42 }}
                        onPress={async () => (await confirmar('Desfazer o resultado deste sorteio?', undefined, 'Desfazer', true)) && desfazer.mutate(l.id)} />
                    ) : null}
                    <Botao titulo="Editar" variante="secundario" icone="create-outline" style={{ flex: 1, minHeight: 42 }}
                      onPress={() => editar(l.id)} />
                </View>
                {/* Panfleto da igreja com o QR Code dela, para imprimir (A4). */}
                {recurso === 'igrejas' && l.status === 'ativa' ? (
                  <View style={{ flexDirection: 'row', gap: espaco.sm }}>
                    {([1, 6] as const).map((n) => (
                      <Botao key={n} titulo={n === 1 ? 'Panfleto 1/folha' : 'Panfleto 6/folha'} icone="print-outline" variante="contorno"
                        style={{ flex: 1, minHeight: 42 }}
                        carregando={panfleto.isPending && panfleto.variables?.id === l.id && panfleto.variables.porPagina === n}
                        onPress={() => panfleto.mutate({ id: l.id, slug: String(l.slug), porPagina: n })} />
                    ))}
                  </View>
                ) : null}
            </Cartao>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: espaco.md }} />}
      />
      {r.podeCriar !== false ? (
        <BotaoNovo rotulo={`${r.feminino ? 'Nova' : 'Novo'} ${r.rotuloItem}`} onPress={() => editar()} />
      ) : null}
    </View>
  );
}
