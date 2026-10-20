import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, BASE_URL } from '@/api';
import { Simbolo } from '@/components/Marca';
import { Aviso, Botao, Campo } from '@/components/ui';
import { useSessao, type Admin } from '@/store/sessao';
import { cores, espaco, raio } from '@/theme';

export default function Login() {
  const entrarNaSessao = useSessao((s) => s.entrar);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  // Segunda etapa: depois da senha certa, o servidor pede o código do aplicativo autenticador.
  const [pedeCodigo, setPedeCodigo] = useState(false);
  const [codigo, setCodigo] = useState('');

  const entrar = useMutation({
    mutationFn: () => api<{ token?: string; admin?: Admin; precisaCodigo?: boolean }>('/login', {
      method: 'POST', json: { email, senha, ...(pedeCodigo ? { codigo } : {}) },
    }),
    onSuccess: (r) => (r.precisaCodigo ? setPedeCodigo(true) : entrarNaSessao({ token: r.token!, admin: r.admin! })),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: cores.primariaEscura }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: espaco.xl, gap: espaco.xl }}
          keyboardShouldPersistTaps="handled">
          <View style={{ gap: 4 }}>
            <Simbolo tamanho={72} claro />
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 12 }}>Renovando</Text>
            <Text style={{ color: cores.destaque, fontSize: 16, fontWeight: '600' }}>Administração</Text>
          </View>

          <View style={{ backgroundColor: cores.superficie, borderRadius: raio.lg, padding: espaco.xl, gap: espaco.lg }}>
            {entrar.error ? <Aviso>{(entrar.error as Error).message}</Aviso> : null}
            <Campo rotulo="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
              autoComplete="email" textContentType="username" />
            <Campo rotulo="Senha" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="current-password"
              textContentType="password" onSubmitEditing={() => entrar.mutate()} />
            {pedeCodigo ? (
              <Campo rotulo="Código do aplicativo autenticador" value={codigo} keyboardType="number-pad" autoFocus
                autoComplete="one-time-code" textContentType="oneTimeCode" placeholder="000000"
                onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))} onSubmitEditing={() => entrar.mutate()} />
            ) : null}
            <Botao titulo={pedeCodigo ? 'Confirmar código' : 'Entrar'} onPress={() => entrar.mutate()} carregando={entrar.isPending}
              desabilitado={!email || !senha || (pedeCodigo && codigo.length !== 6)} />
          </View>

          <Text style={{ color: '#C9A9BD', fontSize: 12, textAlign: 'center' }}>Servidor: {BASE_URL}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
