import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { api } from '@/api';
import { ListaIgrejas } from '@/components/ListaIgrejas';
import { Aviso, Botao, Cartao, Contador, Tela } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { useRascunhoOferta } from '@/store/oferta';
import { cores, espaco, raio } from '@/theme';
import { moeda } from '@/utils/format';

export default function Ofertar() {
  const token = useAuth((a) => a.token);
  const { quantidade, anonima, igreja, definir } = useRascunhoOferta();
  const { data: campanha } = useQuery({ queryKey: ['campanha'], queryFn: api.campanha });
  const valorCupom = campanha?.valorCupom ?? 20;

  const criar = useMutation({
    mutationFn: () => api.criarOferta({ igrejaId: igreja!.id, quantidade, anonima }),
    onSuccess: (o) => router.replace({ pathname: '/ofertar/[id]', params: { id: o.id } }),
  });

  function escolherModo(a: boolean) {
    if (!a && !token) {
      router.push({ pathname: '/login', params: { voltar: '/ofertar' } });
      return;
    }
    definir({ anonima: a });
  }

  return (
    <Tela
      bordas={['bottom']}
      rodape={
        <View style={{ gap: espaco.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: cores.textoSuave }}>Total</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: cores.texto }}>{moeda(quantidade * valorCupom)}</Text>
          </View>
          {criar.error ? <Aviso>{(criar.error as Error).message}</Aviso> : null}
          <Botao
            titulo={igreja ? 'Gerar PIX' : 'Escolha uma igreja'}
            icone="qr-code"
            desabilitado={!igreja}
            carregando={criar.isPending}
            onPress={() => criar.mutate()}
          />
        </View>
      }
    >
      <Cartao>
        <Text style={{ fontWeight: '700', color: cores.texto }}>Como você quer ofertar?</Text>
        <View style={{ flexDirection: 'row', gap: espaco.sm }}>
          {[
            { a: false, titulo: 'Concorrer', sub: 'Recebe números da sorte' },
            { a: true, titulo: 'Anônima', sub: 'Só oferta, sem sorteio' },
          ].map((m) => {
            const ativo = anonima === m.a;
            return (
              <Pressable
                key={m.titulo}
                onPress={() => escolherModo(m.a)}
                style={{
                  flex: 1, padding: espaco.md, borderRadius: raio.md,
                  borderWidth: ativo ? 2 : 1, borderColor: ativo ? cores.primaria : cores.borda,
                  backgroundColor: ativo ? cores.primariaClara : cores.superficie,
                }}
              >
                <Text style={{ fontWeight: '700', color: cores.texto }}>{m.titulo}</Text>
                <Text style={{ color: cores.textoSuave, fontSize: 12 }}>{m.sub}</Text>
              </Pressable>
            );
          })}
        </View>
      </Cartao>

      <Cartao style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontWeight: '700', color: cores.texto }}>
            {anonima ? 'Valor' : `${quantidade} ${quantidade === 1 ? 'cupom' : 'cupons'}`}
          </Text>
          <Text style={{ color: cores.textoSuave, fontSize: 13 }}>{moeda(valorCupom)} cada</Text>
        </View>
        <Contador valor={quantidade} onChange={(v) => definir({ quantidade: v })} />
      </Cartao>

      <Text style={{ fontWeight: '700', fontSize: 16, color: cores.texto }}>Para qual igreja?</Text>
      <ListaIgrejas selecionada={igreja?.id} onSelecionar={(i) => definir({ igreja: i })} />
    </Tela>
  );
}
