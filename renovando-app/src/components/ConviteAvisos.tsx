import Ionicons from '@expo/vector-icons/Ionicons';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { Botao, Cartao } from '@/components/ui';
import { cores, espaco } from '@/theme';
import { ativarAvisos, type ResultadoAvisos } from '@/utils/avisos';

/**
 * Convite para receber os avisos do sorteio no celular. Some sozinho se já estiverem ativados.
 * Não aparece na versão web.
 */
export function ConviteAvisos({ texto = 'Receba o lembrete na véspera e o resultado de cada sorteio no celular.' }: { texto?: string }) {
  const [situacao, setSituacao] = useState<'carregando' | 'pendente' | ResultadoAvisos>(Platform.OS === 'web' ? 'indisponivel' : 'carregando');

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void Notifications.getPermissionsAsync().then(({ status }) => setSituacao(status === 'granted' ? 'ativado' : 'pendente'));
  }, []);

  if (situacao === 'carregando' || situacao === 'indisponivel' || situacao === 'ativado') return null;

  return (
    <Cartao style={{ gap: espaco.md, borderWidth: 1, borderColor: cores.primariaSuave }}>
      <View style={{ flexDirection: 'row', gap: espaco.md, alignItems: 'center' }}>
        <Ionicons name="notifications" size={26} color={cores.primaria} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', color: cores.texto }}>Avisos do sorteio</Text>
          <Text style={{ color: cores.textoSuave, fontSize: 13 }}>{texto}</Text>
        </View>
      </View>
      {situacao === 'negado' ? (
        <>
          <Text style={{ color: cores.textoSuave, fontSize: 13 }}>Os avisos estão bloqueados nas configurações do celular.</Text>
          <Botao titulo="Abrir configurações" variante="contorno" onPress={() => Linking.openSettings()} />
        </>
      ) : (
        <Botao titulo="Ativar avisos" icone="notifications-outline" onPress={async () => setSituacao(await ativarAvisos({ pedir: true }))} />
      )}
    </Cartao>
  );
}
