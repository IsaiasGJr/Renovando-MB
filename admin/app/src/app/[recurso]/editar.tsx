import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/api';
import { Formulario, paraPayload, valoresIniciais, type Valores } from '@/components/Formulario';
import { Aviso, Botao, Carregando, s as ui } from '@/components/ui';
import { RECURSOS } from '@/recursos';
import { cores, espaco } from '@/theme';
import { confirmar, voltar } from '@/utils/confirmar';

export default function Editar() {
  const { recurso, id, campanhaId } = useLocalSearchParams<{ recurso: string; id?: string; campanhaId?: string }>();
  const r = RECURSOS[recurso];
  const qc = useQueryClient();
  const [valores, setValores] = useState<Valores | null>(id ? null : valoresIniciais(r?.campos ?? []));
  const [erro, setErro] = useState('');

  const registro = useQuery({
    queryKey: [r?.caminho, 'item', id],
    queryFn: () => api<Valores>(`/${r.caminho}/${id}`),
    enabled: !!r && !!id,
  });

  // Preenche o formulário quando o registro chega do servidor.
  useEffect(() => {
    if (registro.data && !valores) setValores(valoresIniciais(r.campos, registro.data)); // eslint-disable-line react-hooks/set-state-in-effect
  }, [registro.data, valores, r]);

  const terminar = () => {
    qc.invalidateQueries({ queryKey: [r.caminho] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    voltar();
  };

  const salvar = useMutation({
    mutationFn: () => {
      let payload = paraPayload(r.campos, valores ?? {});
      if (recurso === 'premios' && !id) payload = { ...payload, campanhaId };
      return id ? api(`/${r.caminho}/${id}`, { method: 'PUT', json: payload }) : api(`/${r.caminho}`, { method: 'POST', json: payload });
    },
    onSuccess: terminar,
    onError: (e) => setErro((e as Error).message),
  });

  const excluir = useMutation({
    mutationFn: () => api(`/${r.caminho}/${id}`, { method: 'DELETE' }),
    onSuccess: terminar,
    onError: (e) => setErro((e as Error).message),
  });

  if (!r) return null;
  const titulo = id ? `Editar ${r.rotuloItem}` : `${r.feminino ? 'Nova' : 'Novo'} ${r.rotuloItem}`;

  return (
    <SafeAreaView style={ui.tela} edges={['bottom']}>
      <Stack.Screen options={{ title: titulo }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={ui.conteudo} keyboardShouldPersistTaps="handled">
          {registro.isLoading || !valores ? <Carregando /> : <Formulario campos={r.campos} valores={valores} onChange={setValores} />}
          {id && r.podeExcluir !== false && valores ? (
            <Botao titulo={`Excluir ${r.rotuloItem}`} variante="texto" corTexto={cores.erro} icone="trash-outline"
              carregando={excluir.isPending}
              onPress={async () => (await confirmar(`Excluir ${r.feminino ? 'esta' : 'este'} ${r.rotuloItem}?`, 'Essa ação não pode ser desfeita.', 'Excluir', true)) && excluir.mutate()} />
          ) : null}
        </ScrollView>
        <View style={ui.rodape}>
          {erro ? <View style={{ marginBottom: espaco.sm }}><Aviso>{erro}</Aviso></View> : null}
          <View style={{ flexDirection: 'row', gap: espaco.sm }}>
            <Botao titulo="Cancelar" variante="contorno" style={{ flex: 1 }} onPress={voltar} />
            <Botao titulo="Salvar" style={{ flex: 1 }} carregando={salvar.isPending} desabilitado={!valores}
              onPress={() => (setErro(''), salvar.mutate())} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
