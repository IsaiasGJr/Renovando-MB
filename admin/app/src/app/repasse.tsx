import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { api } from '@/api';
import { GradeKpi, Info, Kpi, Selo } from '@/components/admin';
import { Aviso, Botao, Campo, Carregando, Cartao, Tela } from '@/components/ui';
import { cores, espaco } from '@/theme';
import { confirmar } from '@/utils/confirmar';
import { dataHora, moeda } from '@/utils/format';

type Detalhe = {
  saldo: { aReceber: number; recebido: number };
  movimentacoes: { id: string; papel: string; percentual: number; valor: number; status: string; criadoEm: string; campanha: string; igreja: string }[];
  pagamentos: { id: string; valor: number; referencia: string; observacao: string; adminNome: string; criadoEm: string }[];
};

/** Saldo de um beneficiário e registro do pagamento (feito por fora do sistema). */
export default function Repasse() {
  const { tipo, id, nome, chave, tipoChave } = useLocalSearchParams<{ tipo: string; id: string; nome: string; chave?: string; tipoChave?: string }>();
  const qc = useQueryClient();
  const caminho = `/repasses/${tipo}/${id}`;
  const q = useQuery({ queryKey: ['repasse', caminho], queryFn: () => api<Detalhe>(caminho) });
  const [referencia, setReferencia] = useState('');
  const [observacao, setObservacao] = useState('');
  const [copiado, setCopiado] = useState(false);
  const pagar = useMutation({
    mutationFn: () => api<{ valor: number }>(`${caminho}/pagar`, { method: 'POST', json: { referencia: referencia.trim(), observacao: observacao.trim() } }),
    onSuccess: () => {
      setReferencia('');
      setObservacao('');
      qc.invalidateQueries({ queryKey: ['repasse'] });
      qc.invalidateQueries({ queryKey: ['repasses'] });
    },
  });
  const d = q.data;

  async function registrar() {
    if (!d) return;
    const ok = await confirmar('Registrar pagamento?', `Confirma que ${moeda(d.saldo.aReceber)} JÁ FOI PAGO por fora do sistema para ${nome}?`, 'Registrar');
    if (ok) pagar.mutate();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: nome ?? 'Repasse' }} />
      <Tela bordas={['bottom']}>
        {q.isLoading ? <Carregando /> : null}
        {q.error || pagar.error ? <Aviso>{((q.error ?? pagar.error) as Error).message}</Aviso> : null}
        {d ? (
          <>
            <GradeKpi>
              <Kpi destaque icone="wallet" rotulo="A receber" valor={moeda(d.saldo.aReceber)} />
              <Kpi icone="checkmark-done" rotulo="Já recebido" valor={moeda(d.saldo.recebido)} />
            </GradeKpi>
            {chave ? (
              <Cartao style={{ gap: 6 }}>
                <Info rotulo={`Chave PIX (${tipoChave})`}>{chave}</Info>
                <Botao titulo={copiado ? 'Chave copiada' : 'Copiar chave'} variante="texto" icone="copy-outline"
                  onPress={async () => (await Clipboard.setStringAsync(chave), setCopiado(true))} />
              </Cartao>
            ) : null}
            {pagar.data ? <Aviso tipo="sucesso">Pagamento de {moeda(pagar.data.valor)} registrado.</Aviso> : null}
            {d.saldo.aReceber > 0 ? (
              <Cartao style={{ gap: espaco.md }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: cores.texto }}>Registrar pagamento de {moeda(d.saldo.aReceber)}</Text>
                <Text style={{ color: cores.textoSuave, fontSize: 13 }}>Faça a transferência antes, pelo banco ou gateway. Aqui só fica registrado.</Text>
                <Campo rotulo="Referência do comprovante *" value={referencia} onChangeText={setReferencia} maxLength={120}
                  placeholder="Ex.: id da transação PIX" />
                <Campo rotulo="Observação" value={observacao} onChangeText={setObservacao} maxLength={300} />
                <Botao titulo="Registrar pagamento" icone="checkmark-circle-outline" desabilitado={referencia.trim().length < 3}
                  carregando={pagar.isPending} onPress={registrar} />
              </Cartao>
            ) : null}
            {d.pagamentos.length ? (
              <Cartao style={{ gap: espaco.sm }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: cores.texto }}>Pagamentos registrados</Text>
                {d.pagamentos.map((p) => (
                  <View key={p.id} style={{ borderTopWidth: 1, borderTopColor: cores.borda, paddingTop: espaco.sm }}>
                    <Text style={{ fontWeight: '700', color: cores.texto }}>{moeda(p.valor)} · ref. {p.referencia}</Text>
                    <Text style={{ color: cores.textoSuave, fontSize: 12 }}>{dataHora(p.criadoEm)} · {p.adminNome}{p.observacao ? ` · ${p.observacao}` : ''}</Text>
                  </View>
                ))}
              </Cartao>
            ) : null}
            <Text style={{ fontSize: 16, fontWeight: '800', color: cores.texto }}>Movimentações</Text>
            {d.movimentacoes.map((m) => (
              <Cartao key={m.id} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '700', color: cores.texto, flexShrink: 1 }}>{m.igreja}</Text>
                  <Text style={{ fontWeight: '800', color: cores.texto }}>{moeda(m.valor)}</Text>
                </View>
                <Text style={{ color: cores.textoSuave, fontSize: 13 }}>{m.papel} ({m.percentual}%) · {m.campanha} · {dataHora(m.criadoEm)}</Text>
                <Selo status={m.status === 'pago' ? 'paga' : 'pendente'} texto={m.status === 'pago' ? 'Pago' : 'A pagar'} />
              </Cartao>
            ))}
          </>
        ) : null}
      </Tela>
    </KeyboardAvoidingView>
  );
}
