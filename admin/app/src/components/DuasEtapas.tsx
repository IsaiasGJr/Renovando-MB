import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { api } from '@/api';
import { Aviso, Botao, Campo, Cartao } from '@/components/ui';
import { useSessao } from '@/store/sessao';
import { cores, espaco } from '@/theme';

type Eu = { totpAtivo: boolean; doisFatoresObrigatorio: boolean };
type Inicio = { segredo: string; otpauth: string; qrCode: string };

const so6 = (v: string) => v.replace(/\D/g, '').slice(0, 6);

/** Verificação em duas etapas: o login passa a pedir o código do aplicativo autenticador. */
export function DuasEtapas() {
  const qc = useQueryClient();
  const { admin, entrar } = useSessao();
  const eu = useQuery({ queryKey: ['eu'], queryFn: () => api<Eu>('/me') });
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [inicio, setInicio] = useState<Inicio | null>(null);
  const [copiado, setCopiado] = useState(false);

  const iniciar = useMutation({
    mutationFn: () => api<Inicio>('/me/2fa/iniciar', { method: 'POST', json: { senha } }),
    onSuccess: (r) => (setInicio(r), setSenha('')),
  });
  const ativar = useMutation({
    mutationFn: () => api<{ token: string }>('/me/2fa/ativar', { method: 'POST', json: { codigo } }),
    onSuccess: async ({ token }) => {
      // As outras sessões caem; esta continua com o token novo.
      if (admin) await entrar({ token, admin });
      setInicio(null);
      setCodigo('');
      qc.invalidateQueries({ queryKey: ['eu'] });
    },
  });
  const desativar = useMutation({
    mutationFn: () => api('/me/2fa/desativar', { method: 'POST', json: { senha, codigo } }),
    onSuccess: () => (setSenha(''), setCodigo(''), qc.invalidateQueries({ queryKey: ['eu'] })),
  });

  const d = eu.data;
  const erro = (iniciar.error ?? ativar.error ?? desativar.error) as Error | null;

  return (
    <Cartao style={{ gap: espaco.md }}>
      <Text style={{ fontSize: 17, fontWeight: '800', color: cores.texto }}>Verificação em duas etapas</Text>
      <Text style={{ color: cores.textoSuave }}>
        O login passa a pedir também um código de 6 dígitos do aplicativo autenticador (Google Authenticator, Microsoft Authenticator ou Authy).
      </Text>
      {d?.doisFatoresObrigatorio && !d.totpAtivo ? <Aviso>Obrigatória neste sistema: ative para usar o admin.</Aviso> : null}
      {erro ? <Aviso>{erro.message}</Aviso> : null}

      {d?.totpAtivo ? (
        <>
          <Aviso tipo="sucesso">Ativada. O login pede o código do aplicativo.</Aviso>
          {!d.doisFatoresObrigatorio ? (
            <>
              <Campo rotulo="Senha" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="current-password" />
              <Campo rotulo="Código atual do aplicativo" value={codigo} onChangeText={(t) => setCodigo(so6(t))} keyboardType="number-pad" />
              <Botao titulo="Desativar" variante="contorno" carregando={desativar.isPending}
                desabilitado={!senha || codigo.length !== 6} onPress={() => desativar.mutate()} />
            </>
          ) : null}
        </>
      ) : inicio ? (
        <>
          <Text style={{ fontWeight: '700', color: cores.texto }}>1. Adicione no aplicativo autenticador</Text>
          {Platform.OS === 'web' ? (
            <Image source={inicio.qrCode} style={{ width: 200, height: 200, alignSelf: 'center' }} accessibilityLabel="QR Code" />
          ) : (
            // No próprio celular não dá para ler o QR: abre direto no aplicativo autenticador.
            <Botao titulo="Abrir no aplicativo autenticador" icone="open-outline" variante="secundario"
              onPress={() => Linking.openURL(inicio.otpauth).catch(() => setCopiado(false))} />
          )}
          <View style={{ gap: 4 }}>
            <Text style={{ color: cores.textoSuave, fontSize: 13 }}>Ou digite a chave no aplicativo:</Text>
            <Text selectable style={{ fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), color: cores.texto }}>{inicio.segredo}</Text>
            <Botao titulo={copiado ? 'Chave copiada' : 'Copiar chave'} variante="texto" icone="copy-outline"
              onPress={async () => (await Clipboard.setStringAsync(inicio.segredo), setCopiado(true))} />
          </View>
          <Text style={{ fontWeight: '700', color: cores.texto }}>2. Digite o código que aparece no aplicativo</Text>
          <Campo rotulo="Código de 6 dígitos" value={codigo} onChangeText={(t) => setCodigo(so6(t))} keyboardType="number-pad" />
          <Botao titulo="Ativar" carregando={ativar.isPending} desabilitado={codigo.length !== 6} onPress={() => ativar.mutate()} />
          <Botao titulo="Cancelar" variante="texto" onPress={() => (setInicio(null), setCodigo(''))} />
        </>
      ) : (
        <>
          <Campo rotulo="Confirme sua senha para começar" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="current-password" />
          <Botao titulo="Ativar verificação em duas etapas" icone="shield-checkmark-outline" carregando={iniciar.isPending}
            desabilitado={!senha} onPress={() => iniciar.mutate()} />
        </>
      )}
    </Cartao>
  );
}
