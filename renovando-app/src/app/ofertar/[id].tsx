import { voltar } from '@/utils/navegacao';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { api, useModoTeste } from '@/api';
import { Aviso, Botao, Carregando, Cartao, Tela, Titulo } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { useRascunhoOferta } from '@/store/oferta';
import { cores, espaco } from '@/theme';
import { moeda } from '@/utils/format';
import { ConviteAvisos } from '@/components/ConviteAvisos';

function irPara(rota: '/' | '/cupons') {
  if (router.canDismiss()) router.dismissAll();
  router.navigate(rota);
}

export default function Pagamento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useAuth((a) => a.token);
  const limpar = useRascunhoOferta((r) => r.limpar);
  const qc = useQueryClient();
  const [copiado, setCopiado] = useState(false);
  const modoTeste = useModoTeste();

  // Consulta o status a cada 3 s até o pagamento ser confirmado.
  const { data: oferta } = useQuery({
    queryKey: ['oferta', id],
    queryFn: () => api.oferta(id),
    refetchInterval: (q) => (q.state.data?.status === 'aguardando_pagamento' ? 3000 : false),
  });

  const paga = oferta?.status === 'paga';

  useEffect(() => {
    if (paga) {
      limpar();
      qc.invalidateQueries({ queryKey: ['cupons', token] });
    }
  }, [paga, limpar, qc, token]);

  if (!oferta) return <Tela bordas={['bottom']}><Carregando /></Tela>;

  async function copiar() {
    await Clipboard.setStringAsync(oferta!.pix.copiaECola);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  if (paga) {
    return (
      <Tela bordas={['bottom']}>
        <View style={{ alignItems: 'center', gap: espaco.md, paddingTop: espaco.xl }}>
          <Ionicons name="checkmark-circle" size={72} color={cores.sucesso} />
          <Titulo>Oferta confirmada!</Titulo>
          <Text style={{ color: cores.textoSuave, textAlign: 'center', fontSize: 15 }}>
            {oferta.anonima
              ? `Obrigado! Sua oferta de ${moeda(oferta.valor)} foi recebida.`
              : `Você recebeu ${oferta.quantidade} ${oferta.quantidade === 1 ? 'número' : 'números'} da sorte. Boa sorte!`}
          </Text>
        </View>
        {!oferta.anonima ? (
          <>
            <ConviteAvisos texto="Quer saber na hora se um dos seus números foi sorteado? Ative os avisos." />
            <Botao titulo="Ver meus cupons" icone="ticket" onPress={() => irPara('/cupons')} />
          </>
        ) : null}
        <Botao titulo="Voltar ao início" variante="contorno" onPress={() => irPara('/')} />
      </Tela>
    );
  }

  return (
    <Tela bordas={['bottom']}>
      <Titulo sub="Abra o app do seu banco e pague com o QR Code ou com o código copia e cola.">
        {moeda(oferta.valor)}
      </Titulo>

      <Cartao style={{ alignItems: 'center', paddingVertical: espaco.xl }}>
        <QRCode value={oferta.pix.copiaECola} size={200} color={cores.texto} />
      </Cartao>

      <Botao titulo={copiado ? 'Código copiado!' : 'Copiar código PIX'} icone={copiado ? 'checkmark' : 'copy-outline'}
        variante="secundario" onPress={copiar} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.sm, justifyContent: 'center' }}>
        <Carregando />
        <Text style={{ color: cores.textoSuave }}>Aguardando confirmação do pagamento…</Text>
      </View>

      {modoTeste ? (
        <>
          <Aviso>Modo de teste: nenhum pagamento real é feito. Toque abaixo para simular a confirmação.</Aviso>
          <Botao titulo="Simular pagamento" variante="contorno" onPress={async () => {
            await api.simularPagamento(oferta.id);
            qc.invalidateQueries({ queryKey: ['oferta', id] });
          }} />
        </>
      ) : null}

      <Botao titulo="Cancelar" variante="texto" onPress={voltar} />
    </Tela>
  );
}
