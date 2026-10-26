import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { api, compartilharCsv } from '@/api';
import { Info, Selo } from '@/components/admin';
import { Aviso, Botao, Carregando, Cartao, Tela } from '@/components/ui';
import { cores, espaco, raio } from '@/theme';
import { dataHora, moeda } from '@/utils/format';

type Detalhe = {
  id: string; criadaEm: string; pagaEm: string | null; status: string; quantidade: number; valor: number; anonima: boolean;
  origem: string; observacao: string; registradaPor: string; igreja: string; cidade: string; campanha: string; ofertante: string; whatsapp: string;
  cupons: { numero: string }[];
  divisao: { papel: string; percentual: number; valor: number; status: string; beneficiario: string }[];
};

/** Detalhe de uma oferta: cupons gerados e para onde vai cada parte do dinheiro. */
export default function Oferta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ['oferta', id], queryFn: () => api<Detalhe>(`/ofertas/${id}`) });
  const csv = useMutation({ mutationFn: () => compartilharCsv(`/ofertas/${id}/cupons.csv`, `cupons-oferta-${String(id).slice(0, 8)}.csv`) });
  const o = q.data;

  return (
    <Tela bordas={['bottom']}>
      {q.isLoading ? <Carregando /> : null}
      {q.error || csv.error ? <Aviso>{((q.error ?? csv.error) as Error).message}</Aviso> : null}
      {o ? (
        <>
          <Cartao style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: cores.texto }}>{moeda(o.valor)}</Text>
              <Selo status={o.status} />
            </View>
            <Info rotulo="Ofertante">{o.ofertante}</Info>
            {o.whatsapp ? <Info rotulo="WhatsApp">{o.whatsapp}</Info> : null}
            <Info rotulo="Igreja">{`${o.igreja} · ${o.cidade}`}</Info>
            <Info rotulo="Campanha">{o.campanha}</Info>
            <Info rotulo="Criada em">{dataHora(o.criadaEm)}</Info>
            <Info rotulo="Paga em">{o.pagaEm ? dataHora(o.pagaEm) : '—'}</Info>
          </Cartao>
          {o.origem === 'manual' ? <Aviso>Registrada à mão por {o.registradaPor}: {o.observacao}</Aviso> : null}

          <Cartao style={{ gap: espaco.sm }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: cores.texto }}>Para onde vai o dinheiro</Text>
            {o.divisao.length === 0 ? <Text style={{ color: cores.textoSuave }}>Esta oferta ainda não foi paga.</Text> : o.divisao.map((d, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espaco.sm, borderTopWidth: i ? 1 : 0, borderTopColor: cores.borda, paddingTop: i ? 8 : 0 }}>
                <View style={{ flexShrink: 1 }}>
                  <Text style={{ fontWeight: '700', color: cores.texto }}>{d.papel} ({d.percentual}%)</Text>
                  <Text style={{ color: cores.textoSuave, fontSize: 13 }}>{d.beneficiario ?? '—'} · {d.status === 'pago' ? 'repasse pago' : 'repasse a pagar'}</Text>
                </View>
                <Text style={{ fontWeight: '800', color: cores.texto }}>{moeda(d.valor)}</Text>
              </View>
            ))}
          </Cartao>

          <Cartao style={{ gap: espaco.sm }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: cores.texto }}>Cupons ({o.cupons.length})</Text>
            {o.cupons.length === 0 ? (
              <Text style={{ color: cores.textoSuave }}>{o.anonima ? 'Oferta anônima: não gera números da sorte.' : 'Esta oferta ainda não gerou cupons.'}</Text>
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {o.cupons.map((c) => (
                    <Text key={c.numero} style={{ backgroundColor: cores.primariaClara, color: cores.primariaEscura, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: raio.sm }}>
                      #{c.numero}
                    </Text>
                  ))}
                </View>
                <Botao titulo="Compartilhar planilha dos cupons" variante="contorno" icone="share-outline" carregando={csv.isPending} onPress={() => csv.mutate()} />
              </>
            )}
          </Cartao>
        </>
      ) : null}
    </Tela>
  );
}
