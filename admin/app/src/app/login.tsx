import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, BASE_URL } from '@/api';
import { Simbolo } from '@/components/Marca';
import { Aviso, Botao, Campo } from '@/components/ui';
import { useSessao, type Admin } from '@/store/sessao';
import { cores, espaco, raio } from '@/theme';

type Verificado = { escolha?: string; perfis: { tipo: string; rotulo: string; precisaTotp: boolean }[]; situacoes: unknown[] };
type Entrada = { tipo?: 'equipe'; token?: string; admin?: Admin; precisaCodigo?: boolean };

const digitos = (t: string, n: number) => t.replace(/\D/g, '').slice(0, n);
const mascara = (v: string) => {
  const d = digitos(v, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

/** Entrada da equipe: pelo código no WhatsApp (como no site) ou com e-mail e senha. */
export default function Login() {
  const entrarNaSessao = useSessao((s) => s.entrar);
  const [modo, setModo] = useState<'whatsapp' | 'email'>('whatsapp');

  // ---- WhatsApp
  const [fone, setFone] = useState('');
  const [codigoWhats, setCodigoWhats] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [escolha, setEscolha] = useState<string | null>(null);
  const [pedeTotpWhats, setPedeTotpWhats] = useState(false);
  const [totpWhats, setTotpWhats] = useState('');
  const [semEquipe, setSemEquipe] = useState(false);

  const pedir = useMutation({
    mutationFn: () => api('/entrar/whatsapp/codigo', { method: 'POST', json: { whatsapp: fone } }),
    onSuccess: () => setEnviado(true),
  });
  const entrarPerfil = useMutation({
    mutationFn: (p: { escolha: string; codigoTotp?: string }) =>
      api<Entrada>('/entrar/perfil', { method: 'POST', json: { escolha: p.escolha, tipo: 'equipe', ...(p.codigoTotp ? { codigoTotp: p.codigoTotp } : {}) } }),
    onSuccess: (r) => (r.precisaCodigo ? setPedeTotpWhats(true) : entrarNaSessao({ token: r.token!, admin: r.admin! })),
  });
  const verificar = useMutation({
    mutationFn: () => api<Verificado>('/entrar/whatsapp/verificar', { method: 'POST', json: { whatsapp: fone, codigo: codigoWhats } }),
    onSuccess: (v) => {
      const equipe = v.perfis.find((p) => p.tipo === 'equipe');
      // Este app é só da equipe: pastores, semeadores e parceiros usam o app Renovando ou o painel web.
      if (!equipe || !v.escolha) return setSemEquipe(true);
      setEscolha(v.escolha);
      if (equipe.precisaTotp) setPedeTotpWhats(true);
      else entrarPerfil.mutate({ escolha: v.escolha });
    },
  });
  const recomecar = () => (setEnviado(false), setCodigoWhats(''), setEscolha(null), setPedeTotpWhats(false), setTotpWhats(''), setSemEquipe(false), verificar.reset(), entrarPerfil.reset());

  // ---- E-mail e senha
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

  const erro = (modo === 'whatsapp' ? pedir.error ?? verificar.error ?? entrarPerfil.error : entrar.error) as Error | null;

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
            <View style={{ flexDirection: 'row', backgroundColor: cores.fundo, borderRadius: raio.md, padding: 4 }} accessibilityRole="tablist">
              {([['whatsapp', 'WhatsApp'], ['email', 'E-mail e senha']] as const).map(([v, r]) => (
                <Pressable key={v} onPress={() => setModo(v)} accessibilityRole="tab" accessibilityState={{ selected: modo === v }}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: raio.sm, alignItems: 'center', backgroundColor: modo === v ? cores.superficie : 'transparent' }}>
                  <Text style={{ fontWeight: '700', color: modo === v ? cores.primaria : cores.textoSuave }}>{r}</Text>
                </Pressable>
              ))}
            </View>
            {erro ? <Aviso>{erro.message}</Aviso> : null}

            {modo === 'whatsapp' ? (
              semEquipe ? (
                <>
                  <Aviso>Este número não é da equipe. Pastores, semeadores e parceiros acompanham tudo no app Renovando (Meu painel) ou no painel web.</Aviso>
                  <Botao titulo="Usar outro número" variante="contorno" onPress={recomecar} />
                </>
              ) : pedeTotpWhats && escolha ? (
                <>
                  <Campo rotulo="Código do aplicativo autenticador" value={totpWhats} keyboardType="number-pad" autoFocus
                    autoComplete="one-time-code" textContentType="oneTimeCode" placeholder="000000" onChangeText={(t) => setTotpWhats(digitos(t, 6))} />
                  <Botao titulo="Entrar" carregando={entrarPerfil.isPending} desabilitado={totpWhats.length !== 6}
                    onPress={() => entrarPerfil.mutate({ escolha, codigoTotp: totpWhats })} />
                  <Botao titulo="Voltar" variante="texto" onPress={recomecar} />
                </>
              ) : (
                <>
                  <Campo rotulo="WhatsApp" value={mascara(fone)} keyboardType="phone-pad" editable={!enviado}
                    placeholder="(63) 99999-9999" onChangeText={(t) => setFone(digitos(t, 11))} />
                  {enviado ? (
                    <>
                      <Campo rotulo="Código de acesso" value={codigoWhats} keyboardType="number-pad" autoFocus
                        autoComplete="one-time-code" textContentType="oneTimeCode" placeholder="000000" onChangeText={(t) => setCodigoWhats(digitos(t, 6))} />
                      <Text style={{ color: cores.textoSuave, fontSize: 13 }}>Se este número tiver acesso, o código chega pelo WhatsApp em instantes.</Text>
                      <Botao titulo="Entrar" carregando={verificar.isPending || entrarPerfil.isPending} desabilitado={codigoWhats.length !== 6} onPress={() => verificar.mutate()} />
                      <Botao titulo="Alterar número" variante="texto" onPress={recomecar} />
                    </>
                  ) : (
                    <Botao titulo="Receber código no WhatsApp" icone="logo-whatsapp" carregando={pedir.isPending} desabilitado={fone.length !== 11} onPress={() => pedir.mutate()} />
                  )}
                </>
              )
            ) : (
              <>
                <Campo rotulo="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
                  autoComplete="email" textContentType="username" />
                <Campo rotulo="Senha" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="current-password"
                  textContentType="password" onSubmitEditing={() => entrar.mutate()} />
                {pedeCodigo ? (
                  <Campo rotulo="Código do aplicativo autenticador" value={codigo} keyboardType="number-pad" autoFocus
                    autoComplete="one-time-code" textContentType="oneTimeCode" placeholder="000000"
                    onChangeText={(t) => setCodigo(digitos(t, 6))} onSubmitEditing={() => entrar.mutate()} />
                ) : null}
                <Botao titulo={pedeCodigo ? 'Confirmar código' : 'Entrar'} onPress={() => entrar.mutate()} carregando={entrar.isPending}
                  desabilitado={!email || !senha || (pedeCodigo && codigo.length !== 6)} />
              </>
            )}
          </View>

          <Text style={{ color: '#C9A9BD', fontSize: 12, textAlign: 'center' }}>Servidor: {BASE_URL}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
