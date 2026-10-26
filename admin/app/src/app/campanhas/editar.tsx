import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/api';
import { Chips, Selo } from '@/components/admin';
import { CampoImagem, SeletorLista } from '@/components/Formulario';
import { Aviso, Botao, Campo, Carregando, Cartao, s as ui } from '@/components/ui';
import { cores, espaco } from '@/theme';
import { useCampanhas, type Campanha } from '@/tipos';
import { confirmar, voltar } from '@/utils/confirmar';
import { brParaIso, isoParaBr, mascaraData } from '@/utils/format';

type Form = {
  edicao: string; titulo: string; subtitulo: string; descricao: string; valorCupom: string;
  inicio: string; fim: string; imagemCupom: string; imagemPanfleto: string; divisao: Parte[]; divisaoN2: Parte[];
  parceiroId: string; metaOfertas: string;
};
type TipoDivisao = 'igreja' | 'semeador_n1' | 'semeador_n2' | 'parceiro' | 'plataforma';
type Parte = { rotulo: string; percentual: string; tipo: TipoDivisao };
const TIPOS: { valor: TipoDivisao; rotulo: string }[] = [
  { valor: 'igreja', rotulo: 'Igreja' }, { valor: 'semeador_n1', rotulo: 'Semeador N1' }, { valor: 'semeador_n2', rotulo: 'Semeador N2' },
  { valor: 'parceiro', rotulo: 'Parceiro' }, { valor: 'plataforma', rotulo: 'Plataforma' },
];
const tipoPadrao = (rotulo: string): TipoDivisao => {
  const t = rotulo.toLowerCase();
  return t.includes('igreja') ? 'igreja' : t.includes('n2') ? 'semeador_n2' : t.includes('semeador') ? 'semeador_n1' : t.includes('parceir') ? 'parceiro' : 'plataforma';
};

const NOVA: Form = {
  edicao: '', titulo: '', subtitulo: '', descricao: '', valorCupom: '20', inicio: '', fim: '', imagemCupom: '', imagemPanfleto: '',
  divisao: [
    { rotulo: 'Igreja', percentual: '80', tipo: 'igreja' }, { rotulo: 'Semeador', percentual: '7', tipo: 'semeador_n1' },
    { rotulo: 'Parceiro da campanha', percentual: '5', tipo: 'parceiro' }, { rotulo: 'Plataforma', percentual: '8', tipo: 'plataforma' },
  ],
  divisaoN2: [
    { rotulo: 'Igreja', percentual: '80', tipo: 'igreja' }, { rotulo: 'Semeador N1', percentual: '3', tipo: 'semeador_n1' },
    { rotulo: 'Semeador N2', percentual: '4', tipo: 'semeador_n2' }, { rotulo: 'Parceiro da campanha', percentual: '5', tipo: 'parceiro' },
    { rotulo: 'Plataforma', percentual: '8', tipo: 'plataforma' },
  ],
  parceiroId: '', metaOfertas: '0',
};

const paraForm = (c: Campanha): Form => ({
  edicao: c.edicao, titulo: c.titulo, subtitulo: c.subtitulo, descricao: c.descricao, valorCupom: String(c.valorCupom),
  inicio: isoParaBr(c.inicio, false), fim: isoParaBr(c.fim, false), imagemCupom: c.imagemCupom ?? '', imagemPanfleto: c.imagemPanfleto ?? '',
  divisao: c.divisao.map((d) => ({ rotulo: d.rotulo, percentual: String(d.percentual), tipo: (d.tipo as TipoDivisao) ?? tipoPadrao(d.rotulo) })),
  divisaoN2: (c.divisaoN2 ?? []).map((d) => ({ rotulo: d.rotulo, percentual: String(d.percentual), tipo: (d.tipo as TipoDivisao) ?? tipoPadrao(d.rotulo) })),
  parceiroId: c.parceiroId ?? '', metaOfertas: String(c.metaOfertas ?? 0),
});

const num = (s: string) => Number(s.replace(',', '.')) || 0;

function FormCampanha({ inicial, id }: { inicial: Form; id?: string }) {
  const qc = useQueryClient();
  const [f, setF] = useState(inicial);
  const set = (p: Partial<Form>) => setF((v) => ({ ...v, ...p }));
  const somaOk = (d: Parte[]) => Math.abs(d.reduce((s, x) => s + num(x.percentual), 0) - 100) < 0.01;
  const tudoOk = somaOk(f.divisao) && (!f.divisaoN2.length || somaOk(f.divisaoN2));
  const parceiros = useQuery({ queryKey: ['parceiros'], queryFn: () => api<{ id: string; nome: string }[]>('/parceiros') });

  const salvar = useMutation({
    mutationFn: () => {
      if (!f.edicao.trim() || !f.titulo.trim()) throw new Error('Preencha a edição e o título.');
      const inicio = f.inicio ? brParaIso(f.inicio, false) : '';
      const fim = f.fim ? brParaIso(f.fim, false) : '';
      if ((f.inicio && !inicio) || (f.fim && !fim)) throw new Error('Use datas no formato dd/mm/aaaa.');
      const json = {
        edicao: f.edicao.trim(), titulo: f.titulo.trim(), subtitulo: f.subtitulo.trim(), descricao: f.descricao.trim(),
        valorCupom: num(f.valorCupom), inicio: inicio || null, fim: fim || null, imagemCupom: f.imagemCupom, imagemPanfleto: f.imagemPanfleto,
        divisao: f.divisao.map((d) => ({ rotulo: d.rotulo.trim(), percentual: num(d.percentual), tipo: d.tipo })),
        ...(f.divisaoN2.length ? { divisaoN2: f.divisaoN2.map((d) => ({ rotulo: d.rotulo.trim(), percentual: num(d.percentual), tipo: d.tipo })) } : {}),
        parceiroId: f.parceiroId || null, metaOfertas: num(f.metaOfertas),
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

        <CampoImagem rotulo="Arte do cupom" finalidade="cupom" valor={f.imagemCupom} onChange={(u) => set({ imagemCupom: u })} />
        <Text style={{ color: cores.textoSuave, fontSize: 13, marginTop: -espaco.sm }}>
          O bilhete que o ofertante baixa em “Meus cupons”, como no site: arte em pé com a parte de baixo em branco, onde o sistema escreve o número, a igreja e a data.
        </Text>

        <CampoImagem rotulo="Panfleto" finalidade="panfleto" valor={f.imagemPanfleto} onChange={(u) => set({ imagemPanfleto: u })} />
        <Text style={{ color: cores.textoSuave, fontSize: 13, marginTop: -espaco.sm }}>
          Arte deitada de 1200 × 470, como no site, com o quadro branco no canto direito: cada igreja baixa o PDF com o QR Code dela nesse quadro.
        </Text>

        <Campo rotulo="Meta de ofertas (R$)" value={f.metaOfertas} keyboardType="number-pad" onChangeText={(t) => set({ metaOfertas: t.replace(/\D/g, '') })} />
        <SeletorLista rotulo="Parceiro da campanha" valor={f.parceiroId} onChange={(v) => set({ parceiroId: v })}
          opcoes={[{ valor: '', rotulo: 'Nenhum (parte do parceiro vai para a plataforma)' }, ...(parceiros.data ?? []).map((p) => ({ valor: p.id, rotulo: p.nome }))]} />

        <EditorDivisao titulo="Divisão (sem semeador N2)" itens={f.divisao} onChange={(divisao) => set({ divisao })}
          ajuda="Igrejas indicadas por um N1 ou sem semeador. Parte sem quem receber fica com a plataforma." />
        <EditorDivisao titulo="Divisão com semeador N2" itens={f.divisaoN2} onChange={(divisaoN2) => set({ divisaoN2 })}
          ajuda="A parte de semeador se divide entre o N2 (quem indicou a igreja) e o N1 que trouxe o N2. Valores iniciais são exemplos: confira com a diretoria." />

        {id ? (
          <Botao titulo="Excluir campanha" variante="texto" corTexto={cores.erro} icone="trash-outline"
            onPress={async () => (await confirmar('Excluir esta campanha?', 'Só é possível se ela ainda não tiver ofertas.', 'Excluir', true)) && excluir.mutate()} />
        ) : null}
      </ScrollView>
      <View style={ui.rodape}>
        {erro ? <View style={{ marginBottom: espaco.sm }}><Aviso>{(erro as Error).message}</Aviso></View> : null}
        <View style={{ flexDirection: 'row', gap: espaco.sm }}>
          <Botao titulo="Cancelar" variante="contorno" style={{ flex: 1 }} onPress={voltar} />
          <Botao titulo="Salvar" style={{ flex: 1 }} desabilitado={!tudoOk} carregando={salvar.isPending} onPress={() => salvar.mutate()} />
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

/** Uma regra de divisão: nome da parte, para quem vai e percentual (soma 100%). */
function EditorDivisao({ titulo, itens, onChange, ajuda }: { titulo: string; itens: Parte[]; onChange: (d: Parte[]) => void; ajuda: string }) {
  const soma = itens.reduce((s, d) => s + num(d.percentual), 0);
  const ok = Math.abs(soma - 100) < 0.01;
  const mudar = (i: number, p: Partial<Parte>) => onChange(itens.map((d, j) => (j === i ? { ...d, ...p } : d)));
  return (
    <Cartao>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espaco.sm }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: cores.texto, flexShrink: 1 }}>{titulo}</Text>
        <Selo status={ok ? 'ativa' : 'rejeitada'} texto={`Total ${(Math.round(soma * 100) / 100).toLocaleString('pt-BR')}%`} />
      </View>
      {itens.map((d, i) => (
        <View key={i} style={{ gap: 6, borderTopWidth: i ? 1 : 0, borderTopColor: cores.borda, paddingTop: i ? espaco.sm : 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.sm }}>
            <TextInput value={d.rotulo} onChangeText={(t) => mudar(i, { rotulo: t })} placeholder="Nome da parte"
              accessibilityLabel="Nome da parte" style={[ui.input, { flex: 1 }]} placeholderTextColor={cores.textoSuave} />
            <TextInput value={d.percentual} onChangeText={(t) => mudar(i, { percentual: t })} keyboardType="decimal-pad"
              accessibilityLabel="Percentual" style={[ui.input, { width: 64, textAlign: 'right' }]} />
            <Text style={{ color: cores.texto }}>%</Text>
            <Pressable onPress={() => onChange(itens.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Remover">
              <Ionicons name="close-circle" size={24} color={cores.erro} />
            </Pressable>
          </View>
          <Chips opcoes={TIPOS} valor={d.tipo} onChange={(tipo) => mudar(i, { tipo })} />
        </View>
      ))}
      <Botao titulo="Adicionar parte" variante="texto" icone="add" onPress={() => onChange([...itens, { rotulo: '', percentual: '0', tipo: 'plataforma' }])} />
      <Text style={{ color: cores.textoSuave, fontSize: 12 }}>{ajuda} A soma precisa dar 100%.</Text>
    </Cartao>
  );
}
