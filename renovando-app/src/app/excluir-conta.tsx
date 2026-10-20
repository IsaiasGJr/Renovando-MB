import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { api } from '@/api';
import { Aviso, Botao, Campo, Cartao, Tela, Titulo } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { cores, espaco } from '@/theme';
import { mascaraTelefone } from '@/utils/format';
import { voltar } from '@/utils/navegacao';

function Linha({ icone, cor, children }: { icone: 'close-circle' | 'checkmark-circle' | 'alert-circle'; cor: string; children: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: espaco.sm, alignItems: 'flex-start' }}>
      <Ionicons name={icone} size={18} color={cor} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: cores.texto, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

export default function ExcluirConta() {
  const { usuario, token, sair } = useAuth();
  const qc = useQueryClient();
  const [confirmacao, setConfirmacao] = useState('');
  const cupons = useQuery({ queryKey: ['cupons', token], queryFn: api.meusCupons, enabled: !!token });

  const excluir = useMutation({
    mutationFn: api.excluirConta,
    onSuccess: async () => {
      await sair();
      qc.clear();
      router.replace('/');
    },
  });

  if (!usuario) {
    return (
      <Tela bordas={['bottom']}>
        <Titulo sub="Entre na conta que você quer excluir.">Excluir conta</Titulo>
        <Botao titulo="Entrar" onPress={() => router.replace({ pathname: '/login', params: { voltar: '/perfil' } })} />
      </Tela>
    );
  }

  const qtd = cupons.data?.length ?? 0;
  const pode = confirmacao.trim().toUpperCase() === 'EXCLUIR';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Tela bordas={['bottom']}>
        <Titulo sub={`${`${usuario.nome} ${usuario.sobrenome}`.trim()} · ${mascaraTelefone(usuario.whatsapp)}`}>Excluir minha conta</Titulo>

        <Cartao>
          <Text style={{ fontWeight: '700', color: cores.texto }}>O que será apagado</Text>
          <Linha icone="close-circle" cor={cores.erro}>Seu nome, sobrenome e WhatsApp.</Linha>
          <Linha icone="close-circle" cor={cores.erro}>O acesso à conta neste e em outros aparelhos.</Linha>
          <Linha icone="close-circle" cor={cores.erro}>PIX gerados que ainda não foram pagos.</Linha>
        </Cartao>

        <Cartao>
          <Text style={{ fontWeight: '700', color: cores.texto }}>O que é mantido, sem identificar você</Text>
          <Linha icone="checkmark-circle" cor={cores.sucesso}>
            O registro das ofertas já pagas, que é obrigatório para a prestação de contas das igrejas.
          </Linha>
        </Cartao>

        <Aviso>
          {qtd > 0
            ? `Você tem ${qtd} ${qtd === 1 ? 'número' : 'números'} da sorte. Eles deixam de concorrer nos próximos sorteios, porque não teremos como entrar em contato para entregar o prêmio.`
            : 'Seus números da sorte, se houver, deixam de concorrer nos próximos sorteios.'}
        </Aviso>

        <Text style={{ color: cores.textoSuave, lineHeight: 20 }}>
          Essa ação não pode ser desfeita. Se quiser voltar depois, é só criar uma conta nova com seu WhatsApp.
        </Text>

        <Campo rotulo='Para confirmar, digite "EXCLUIR"' value={confirmacao} onChangeText={setConfirmacao}
          autoCapitalize="characters" autoCorrect={false} placeholder="EXCLUIR" />

        {excluir.error ? <Aviso>{(excluir.error as Error).message}</Aviso> : null}

        <Botao titulo="Excluir minha conta" icone="trash-outline" desabilitado={!pode} carregando={excluir.isPending}
          style={{ backgroundColor: cores.erro }} onPress={() => excluir.mutate()} />
        <Botao titulo="Cancelar" variante="contorno" onPress={voltar} />
      </Tela>
    </KeyboardAvoidingView>
  );
}
