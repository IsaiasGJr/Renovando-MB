import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/api';
import { Selo } from '@/components/admin';
import { CampoImagem } from '@/components/Formulario';
import { Aviso, Botao, Campo, Carregando, Cartao, s as ui } from '@/components/ui';
import { cores, espaco } from '@/theme';
import { useCampanhas, type Campanha } from '@/tipos';
import { confirmar, voltar } from '@/utils/confirmar';
import { brParaIso, isoParaBr, mascaraData } from '@/utils/format';

type Form = {
  edicao: string; titulo: string; subtitulo: string; descricao: string; valorCupom: string;
  inicio: string; fim: string; imagemCupom: string; divisao: { rotulo: string; percentual: string }[];
};

const NOVA: Form = {
  edicao: '', titulo: '', subtitulo: '', descricao: '', valorCupom: '20', inicio: '', fim: '', imagemCupom: '',
  divisao: [
    { rotulo: 'Igreja', percentual: '80' }, { rotulo: 'Semeador', percentual: '7' },
    { rotulo: 'Parceiro da campanha', percentual: '5' }, { rotulo: 'Plataforma', percentual: '8' },
  ],
};

const paraForm = (c: Campanha): Form => ({
  edicao: c.edicao, titulo: c.titulo, subtitulo: c.subtitulo, descricao: c.descricao, valorCupom: String(c.valorCupom),
  inicio: isoParaBr(c.inicio, false), fim: isoParaBr(c.fim, false), imagemCupom: c.imagemCupom ?? '',
  divisao: c.divisao.map((d) => ({ rotulo: d.rotulo, percentual: String(d.percentual) })),
});

const num = (s: string) => Number(s.replace(',', '.')) || 0;

function FormCampanha({ inicial, id }: { inicial: Form; id?: string }) {
  const qc = useQueryClient();
  const [f, setF] = useState(inicial);
  const set = (p: Partial<Form>) => setF((v) => ({ ...v, ...p }));
  const soma = f.divisao.reduce((s, d) => s + num(d.percentual), 0);
  const somaOk = Math.abs(soma - 100) < 0.01;
  const setDiv = (i: number, p: Partial<Form['divisao'][number]>) =>
    set({ divisao: f.divisao.map((d, j) => (j === i ? { ...d, ...p } : d)) });

  const salvar = useMutation({
    mutationFn: () => {
      if (!f.edicao.trim() || !f.titulo.trim()) throw new Error('Preencha a edição e o título.');
      const inicio = f.inicio ? brParaIso(f.inicio, false) : '';
      const fim = f.fim ? brParaIso(f.fim, false) : '';
      if ((f.inicio && !inicio) || (f.fim && !fim)) throw new Error('Use datas no formato dd/mm/aaaa.');
      const json = {
        edicao: f.edicao.trim(), titulo: f.titulo.trim(), subtitulo: f.subtitulo.trim(), descricao: f.descricao.trim(),
        valorCupom: num(f.valorCupom), inicio: inicio || null, fim: fim || null, imagemCupom: f.imagemCupom,
        divisao: f.divisao.map((d) => ({ rotulo: d.rotulo.trim(), percentual: num(d.percentual) })),
      };
      return id ? api(`/campanhas/${id}`, { method: 'PUT', json }) : api('/campanhas', { method: 'POST', json });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campanhas'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      voltar();
    },
  });
  const excluir = useMutation({
    mutationFn: () => api(`/campanhas/${id}`, { method: 'DELETE' }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['campanhas'] }), voltar()),
  });
  const erro = salvar.error ?? excluir.error;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={ui.conteudo} keyboardShouldPersistTaps="handled">
        <Campo rotulo="Edição *" value={f.edicao} placeholder="Ex.: Edição 2027" onChangeText={(t) => set({ edicao: t })} />
        <Campo rotulo="Título *" value={f.titulo} placeholder="Ex.: Semeando esperança," onChangeText={(t) => set({ titulo: t })} />
        <Campo rotulo="Subtítulo" value={f.subtitulo} placeholder="Ex.: Distribuindo prêmios." onChangeText={(t) => set({ subtitulo: t })} />
        <Campo rotulo="Descrição" value={f.descricao} multiline onChangeText={(t) => set({ descricao: t })}
          style={{ minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }} />
        <Campo rotulo="Valor do cupom (R$) *" value={f.valorCupom} keyboardType="decimal-pad" onChangeText={(t) => set({ valorCupom: t })} />
        <View style={{ flexDirection: 'row', gap: espaco.sm }}>
          <View style={{ flex: 1 }}>
            <Campo rotulo="Início" value={f.inicio} placeholder="dd/mm/aaaa" keyboardType="number-pad" onChangeText={(t) => set({ inicio: mascaraData(t, false) })} />
          </View>
          <View style={{ flex: 1 }}>
            <Campo rotulo="Fim" value={f.fim} placeholder="dd/mm/aaaa" keyboardType="number-pad" onChangeText={(t) => set({ fim: mascaraData(t, false) })} />
          </View>
        </View>

        <CampoImagem rotulo="Arte do cupom" valor={f.imagemCupom} onChange={(u) => set({ imagemCupom: u })} />
        <Text style={{ color: cores.textoSuave, fontSize: 13, marginTop: -espaco.sm }}>
          O bilhete que o ofertante baixa em “Meus cupons”, como no site: arte em pé com a parte de baixo em branco, onde o sistema escreve o número, a igreja e a data.
        </Text>

        <Cartao>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: cores.texto }}>Divisão de cada oferta</Text>
            <Selo status={somaOk ? 'ativa' : 'rejeitada'} texto={`Total ${soma.toLocaleString('pt-BR')}%`} />
          </View>
          {f.divisao.map((d, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.sm }}>
              <TextInput value={d.rotulo} onChangeText={(t) => setDiv(i, { rotulo: t })} placeholder="Destinatário"
                accessibilityLabel="Destinatário" style={[ui.input, { flex: 1 }]} placeholderTextColor={cores.textoSuave} />
              <TextInput value={d.percentual} onChangeText={(t) => setDiv(i, { percentual: t })} keyboardType="decimal-pad"
                accessibilityLabel="Percentual" style={[ui.input, { width: 64, textAlign: 'right' }]} />
              <Text style={{ color: cores.texto }}>%</Text>
              <Pressable onPress={() => set({ divisao: f.divisao.filter((_, j) => j !== i) })} hitSlop={8} accessibilityLabel="Remover">
                <Ionicons name="close-circle" size={24} color={cores.erro} />
              </Pressable>
            </View>
          ))}
          <Botao titulo="Adicionar destinatário" variante="texto" icone="add"
            onPress={() => set({ divisao: [...f.divisao, { rotulo: '', percentual: '0' }] })} />
          <Text style={{ color: cores.textoSuave, fontSize: 12 }}>
            O destinatário chamado “Igreja” é usado no relatório de repasses por igreja. A soma precisa dar 100%.
          </Text>
        </Cartao>

        {id ? (
          <Botao titulo="Excluir campanha" variante="texto" corTexto={cores.erro} icone="trash-outline"
            onPress={async () => (await confirmar('Excluir esta campanha?', 'Só é possível se ela ainda não tiver ofertas.', 'Excluir', true)) && excluir.mutate()} />
        ) : null}
      </ScrollView>
      <View style={ui.rodape}>
        {erro ? <View style={{ marginBottom: espaco.sm }}><Aviso>{(erro as Error).message}</Aviso></View> : null}
        <View style={{ flexDirection: 'row', gap: espaco.sm }}>
          <Botao titulo="Cancelar" variante="contorno" style={{ flex: 1 }} onPress={voltar} />
          <Botao titulo="Salvar" style={{ flex: 1 }} desabilitado={!somaOk} carregando={salvar.isPending} onPress={() => salvar.mutate()} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function EditarCampanha() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const lista = useCampanhas();
  const campanha = id ? lista.data?.find((c) => c.id === id) : undefined;

  return (
    <SafeAreaView style={ui.tela} edges={['bottom']}>
      <Stack.Screen options={{ title: id ? 'Editar campanha' : 'Nova campanha' }} />
      {id && !campanha ? <Carregando /> : <FormCampanha key={id ?? 'nova'} id={id} inicial={campanha ? paraForm(campanha) : NOVA} />}
    </SafeAreaView>
  );
}
