import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, Text, View } from 'react-native';
import { api } from '@/api';
import { Destaque, ItemIcone } from '@/components/Conteudo';
import { Aviso, Botao, Campo, Cartao, Tela } from '@/components/ui';
import { CONTATO_EMAIL, CONTATO_WHATSAPP } from '@/config';
import type { Anexo } from '@/types';
import { cores, espaco, raio } from '@/theme';
import { mascaraTelefone, soDigitos } from '@/utils/format';

const ENDERECO = 'Quadra Arse 81, Alameda 14, S/N, Lote 15, Sala 16, Plano Diretor Sul, Palmas/TO';
const VAZIO = { nome: '', sobrenome: '', whatsapp: '', mensagem: '' };

export default function Contato() {
  const [f, setF] = useState(VAZIO);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [erroAnexo, setErroAnexo] = useState('');
  const set = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }));

  const enviar = useMutation({
    mutationFn: () => api.enviarContato({ ...f, anexos }),
    onSuccess: () => (setF(VAZIO), setAnexos([])),
  });
  const valido = f.nome.trim().length >= 2 && soDigitos(f.whatsapp).length === 11 && f.mensagem.trim().length >= 5;

  async function anexar() {
    setErroAnexo('');
    const r = await DocumentPicker.getDocumentAsync({ type: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'], copyToCacheDirectory: true });
    if (r.canceled) return;
    const a = r.assets[0];
    if ((a.size ?? 0) > 5 * 1024 * 1024) return setErroAnexo('O arquivo passa de 5 MB.');
    setEnviandoAnexo(true);
    try {
      const enviado = await api.enviarAnexo({ uri: a.uri, nome: a.name, tipo: a.mimeType ?? 'application/octet-stream' });
      setAnexos((l) => [...l, enviado]);
    } catch (e) {
      setErroAnexo((e as Error).message);
    } finally {
      setEnviandoAnexo(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Tela bordas={['bottom']}>
        <Destaque selo="Fale conosco" titulo="Entre em contato conosco"
          texto="Atendemos igrejas, empresas, lideranças e organizações que querem fazer parte deste movimento." />

        <Cartao style={{ gap: espaco.lg }}>
          <Pressable onPress={() => Linking.openURL(`https://wa.me/${CONTATO_WHATSAPP}`)}>
            <ItemIcone icone="logo-whatsapp" titulo="WhatsApp">+55 (63) 98424-1475</ItemIcone>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(`mailto:${CONTATO_EMAIL}`)}>
            <ItemIcone icone="mail" titulo="E-mail">{CONTATO_EMAIL}</ItemIcone>
          </Pressable>
          <ItemIcone icone="location" titulo="Endereço">{ENDERECO}</ItemIcone>
        </Cartao>

        {enviar.isSuccess ? <Aviso tipo="sucesso">Mensagem enviada! Nossa equipe retorna pelo WhatsApp informado.</Aviso> : null}

        <Cartao style={{ gap: espaco.md }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: cores.texto }}>Envie uma mensagem</Text>
          <View style={{ flexDirection: 'row', gap: espaco.sm }}>
            <View style={{ flex: 1 }}><Campo rotulo="Nome *" value={f.nome} onChangeText={(t) => set({ nome: t })} autoComplete="given-name" /></View>
            <View style={{ flex: 1 }}><Campo rotulo="Sobrenome" value={f.sobrenome} onChangeText={(t) => set({ sobrenome: t })} autoComplete="family-name" /></View>
          </View>
          <Campo rotulo="WhatsApp *" value={f.whatsapp} keyboardType="phone-pad" placeholder="(99) 99999-9999"
            onChangeText={(t) => set({ whatsapp: mascaraTelefone(t) })} />
          <Campo rotulo="Mensagem *" value={f.mensagem} multiline onChangeText={(t) => set({ mensagem: t })}
            style={{ minHeight: 120, textAlignVertical: 'top', paddingTop: 12 }} />

          <View style={{ gap: espaco.sm }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: cores.texto }}>Anexos (opcional)</Text>
            {anexos.map((a) => (
              <View key={a.arquivo} style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.sm, backgroundColor: cores.primariaClara, borderRadius: raio.md, padding: espaco.sm }}>
                <Ionicons name={a.arquivo.endsWith('.pdf') ? 'document-text' : 'image'} size={18} color={cores.primaria} />
                <Text style={{ flex: 1, color: cores.texto }} numberOfLines={1}>{a.nome}</Text>
                <Pressable onPress={() => setAnexos((l) => l.filter((x) => x.arquivo !== a.arquivo))} hitSlop={8} accessibilityLabel={`Remover ${a.nome}`}>
                  <Ionicons name="close-circle" size={20} color={cores.textoSuave} />
                </Pressable>
              </View>
            ))}
            {anexos.length < 3 ? (
              <Botao titulo={enviandoAnexo ? 'Enviando arquivo…' : 'Anexar imagem ou PDF'} icone="attach" variante="secundario"
                carregando={enviandoAnexo} onPress={anexar} />
            ) : null}
            <Text style={{ color: cores.textoSuave, fontSize: 12 }}>Até 3 arquivos, de até 5 MB cada (PNG, JPG, WEBP ou PDF).</Text>
            {erroAnexo ? <Aviso>{erroAnexo}</Aviso> : null}
          </View>

          {enviar.error ? <Aviso>{(enviar.error as Error).message}</Aviso> : null}
          <Botao titulo="Enviar mensagem" icone="send" desabilitado={!valido || enviandoAnexo} carregando={enviar.isPending} onPress={() => enviar.mutate()} />
        </Cartao>
      </Tela>
    </KeyboardAvoidingView>
  );
}
