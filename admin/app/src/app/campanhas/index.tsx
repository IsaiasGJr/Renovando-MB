import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { api } from '@/api';
import { BotaoNovo, Info, Selo, Vazio } from '@/components/admin';
import { Aviso, Botao, Carregando, Cartao, s as ui } from '@/components/ui';
import { useEhAdmin } from '@/store/sessao';
import { cores, espaco } from '@/theme';
import { useCampanhas } from '@/tipos';
import { confirmar } from '@/utils/confirmar';
import { data, moeda } from '@/utils/format';

export default function Campanhas() {
  const ehAdmin = useEhAdmin();
  const qc = useQueryClient();
  const lista = useCampanhas();
  const ativar = useMutation({
    mutationFn: (id: string) => api(`/campanhas/${id}/ativar`, { method: 'POST' }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['campanhas'] }), qc.invalidateQueries({ queryKey: ['dashboard'] })),
  });

  if (!ehAdmin) return <Vazio texto="Apenas administradores podem gerenciar campanhas." icone="lock-closed-outline" />;

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <FlatList
        data={lista.data ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={[ui.conteudo, { paddingBottom: 100 }]}
        ItemSeparatorComponent={() => <View style={{ height: espaco.md }} />}
        ListHeaderComponent={
          <View style={{ gap: espaco.md }}>
            <Text style={{ color: cores.textoSuave }}>Só uma campanha fica ativa por vez: é ela que aparece no app.</Text>
            {lista.isLoading ? <Carregando /> : null}
            {lista.error ? <Aviso>{(lista.error as Error).message}</Aviso> : null}
            {ativar.error ? <Aviso>{(ativar.error as Error).message}</Aviso> : null}
          </View>
        }
        renderItem={({ item: c }) => (
          <Cartao style={c.ativa ? { borderColor: cores.primaria, borderWidth: 2 } : undefined}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: cores.texto }}>{c.edicao}</Text>
              {c.ativa ? <Selo status="ativa" texto="Ativa no app" /> : <Selo status="" texto="Inativa" />}
            </View>
            <Text style={{ color: cores.texto }}>{c.titulo} {c.subtitulo}</Text>
            <Info rotulo="Cupom">{moeda(c.valorCupom)}</Info>
            <Info rotulo="Período">{`${data(c.inicio)} a ${data(c.fim)}`}</Info>
            <Info rotulo="Divisão">{c.divisao.map((d) => `${d.rotulo} ${d.percentual}%`).join(' · ')}</Info>
            <View style={{ flexDirection: 'row', gap: espaco.sm, marginTop: 4 }}>
              <Botao titulo="Editar" variante="contorno" style={{ flex: 1, minHeight: 42 }}
                onPress={() => router.push({ pathname: '/campanhas/editar', params: { id: c.id } })} />
              {!c.ativa ? (
                <Botao titulo="Ativar" style={{ flex: 1, minHeight: 42 }} carregando={ativar.isPending && ativar.variables === c.id}
                  onPress={async () => (await confirmar(`Ativar "${c.edicao}"?`, 'A campanha atual deixa de aparecer no app.', 'Ativar')) && ativar.mutate(c.id)} />
              ) : null}
            </View>
          </Cartao>
        )}
      />
      <BotaoNovo rotulo="Nova campanha" onPress={() => router.push('/campanhas/editar')} />
    </View>
  );
}
