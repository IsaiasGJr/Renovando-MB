import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { api, useModoTeste } from '@/api';
import { Simbolo } from '@/components/Marca';
import { Aviso, Botao, Campo, Tela, Titulo } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { cores } from '@/theme';
import { mascaraTelefone, soDigitos } from '@/utils/format';

export default function Login() {
  const { voltar } = useLocalSearchParams<{ voltar?: string }>();
  const entrar = useAuth((a) => a.entrar);
  const modoTeste = useModoTeste();

  const [etapa, setEtapa] = useState<'dados' | 'codigo'>('dados');
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [codigo, setCodigo] = useState('');
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const fone = soDigitos(whatsapp);
  const dadosOk = nome.trim().length >= 2 && fone.length === 11 && aceite;

  async function enviar() {
    setErro('');
    setCarregando(true);
    try {
      await api.enviarCodigo(fone);
      setEtapa('codigo');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  async function verificar() {
    setErro('');
    setCarregando(true);
    try {
      const sessao = await api.verificarCodigo({ whatsapp: fone, codigo, nome: nome.trim(), sobrenome: sobrenome.trim() });
      await entrar(sessao);
      // O login pode ter sido aberto por link direto, sem tela anterior.
      const podeVoltar = router.canGoBack();
      if (podeVoltar) router.back();
      if (voltar === '/ofertar') {
        if (podeVoltar) router.push('/ofertar');
        else router.replace('/ofertar');
      } else if (!podeVoltar) {
        router.replace('/');
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Tela bordas={['bottom']}>
        {etapa === 'dados' ? (
          <>
            <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
              <Simbolo tamanho={64} />
              <Text style={{ fontWeight: '800', fontSize: 16, color: cores.primariaEscura }}>Renovando a Vinha do Senhor</Text>
            </View>
            <Titulo sub="Sem senha: enviamos um código de acesso para o seu WhatsApp.">Criar conta ou entrar</Titulo>
            <Campo rotulo="Nome" value={nome} onChangeText={setNome} placeholder="Seu nome" autoComplete="given-name" />
            <Campo rotulo="Sobrenome" value={sobrenome} onChangeText={setSobrenome} placeholder="Seu sobrenome"
              autoComplete="family-name" />
            <Campo
              rotulo="WhatsApp com DDD"
              value={whatsapp}
              onChangeText={(t) => setWhatsapp(mascaraTelefone(t))}
              placeholder="(99) 99999-9999"
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            <Pressable onPress={() => setAceite(!aceite)} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, color: aceite ? cores.primaria : cores.textoSuave }}>{aceite ? '☑' : '☐'}</Text>
              <Text style={{ flex: 1, color: cores.texto }}>
                Li e concordo com os{' '}
                <Text style={{ color: cores.primaria, fontWeight: '700' }} onPress={() => router.push('/pagina/termos')}>termos de uso</Text>
                {' '}e a{' '}
                <Text style={{ color: cores.primaria, fontWeight: '700' }} onPress={() => router.push('/pagina/privacidade')}>política de privacidade</Text>.
              </Text>
            </Pressable>
            {erro ? <Aviso>{erro}</Aviso> : null}
            <Botao titulo="Receber código no WhatsApp" icone="logo-whatsapp" onPress={enviar}
              desabilitado={!dadosOk} carregando={carregando} />
          </>
        ) : (
          <>
            <Titulo sub={`Digite o código de 6 dígitos que enviamos para ${mascaraTelefone(fone)}.`}>
              Confirme seu WhatsApp
            </Titulo>
            {modoTeste ? <Aviso>Modo de teste: use o código 123456.</Aviso> : null}
            <Campo
              rotulo="Código"
              value={codigo}
              onChangeText={(t) => setCodigo(soDigitos(t).slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              autoFocus
              style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
            />
            {erro ? <Aviso>{erro}</Aviso> : null}
            <Botao titulo="Confirmar" onPress={verificar} desabilitado={codigo.length !== 6} carregando={carregando} />
            <Botao titulo="Alterar número" variante="texto" onPress={() => setEtapa('dados')} />
          </>
        )}
      </Tela>
    </KeyboardAvoidingView>
  );
}
