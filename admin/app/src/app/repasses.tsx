import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { api } from '@/api';
import { GradeKpi, Kpi, Vazio } from '@/components/admin';
import { Aviso, Carregando, Cartao, s as ui } from '@/components/ui';
import { useEhAdmin } from '@/store/sessao';
import { cores, espaco } from '@/theme';
import { moeda } from '@/utils/format';

export type LinhaRepasse = {
  beneficiarioTipo: 'igreja' | 'semeador' | 'parceiro' | 'plataforma'; beneficiarioId: string | null; nome: string;
  aPagar: number; pago: number; tipoChavePix: string; chavePix: string;
};
export const TIPO_BENEFICIARIO = { igreja: 'Igreja', semeador: 'Semeador', parceiro: 'Parceiro', plataforma: 'Plataforma' } as const;

/** Quanto cada um tem a receber. O sistema NÃO transfere dinheiro: só registra o que a equipe pagou. */
export default function Repasses() {
  const ehAdmin = useEhAdmin();
  const q = useQuery({ queryKey: ['repasses', ''], queryFn: () => api<LinhaRepasse[]>('/repasses'), enabled: ehAdmin });
  if (!ehAdmin) return <Vazio texto="Apenas administradores veem os repasses." icone="lock-closed-outline" />;
  const aPagar = (q.data ?? []).reduce((s, l) => s + l.aPagar, 0);
  const pago = (q.data ?? []).reduce((s, l) => s + l.pago, 0);

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(l) => `${l.beneficiarioTipo}-${l.beneficiarioId}`}
        contentContainerStyle={ui.conteudo}
        ItemSeparatorComponent={() => <View style={{ height: espaco.md }} />}
        ListHeaderComponent={
          <View style={{ gap: espaco.md }}>
            <Aviso>O sistema não transfere dinheiro. Pague pelo banco ou gateway e depois registre o pagamento aqui.</Aviso>
            <GradeKpi>
              <Kpi destaque icone="wallet" rotulo="A pagar" valor={moeda(aPagar)} />
              <Kpi icone="checkmark-done" rotulo="Já pago" valor={moeda(pago)} />
            </GradeKpi>
            {q.isLoading ? <Carregando /> : null}
            {q.error ? <Aviso>{(q.error as Error).message}</Aviso> : null}
          </View>
        }
        ListEmptyComponent={q.data ? <Vazio texto="Ainda não há ofertas pagas." /> : undefined}
        renderItem={({ item: l }) => (
          <Pressable accessibilityRole="button"
            onPress={() => router.push({ pathname: '/repasse', params: { tipo: l.beneficiarioTipo, id: l.beneficiarioId ?? 'plataforma', nome: l.nome, chave: l.chavePix, tipoChave: l.tipoChavePix } })}>
            <Cartao style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espaco.sm }}>
                <Text style={{ fontWeight: '700', color: cores.texto, fontSize: 15, flexShrink: 1 }}>{l.nome}</Text>
                <Text style={{ fontWeight: '800', color: l.aPagar > 0 ? cores.primariaEscura : cores.textoSuave, fontSize: 15 }}>{moeda(l.aPagar)}</Text>
              </View>
              <Text style={{ color: cores.textoSuave, fontSize: 13 }}>{TIPO_BENEFICIARIO[l.beneficiarioTipo]} · já pago {moeda(l.pago)}</Text>
            </Cartao>
          </Pressable>
        )}
      />
    </View>
  );
}
