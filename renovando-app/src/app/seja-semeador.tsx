import { voltar } from '@/utils/navegacao';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '@/api';
import { Citacao, Destaque, ItemIcone, Secao } from '@/components/Conteudo';
import { Simulador } from '@/components/Simulador';
import { Aviso, Botao, Campo, Cartao, Tela } from '@/components/ui';
import { cores, espaco } from '@/theme';
import { mascaraCpf, mascaraTelefone, soDigitos } from '@/utils/format';

export default function SejaSemeador() {
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const [f, setF] = useState({ nome: '', sobrenome: '', whatsapp: '', cpf: '', chavePix: '', codigo: '', codigoIndicacao: (ref ?? '').toUpperCase() });
  // WhatsApp para o qual o código foi enviado: trocar o número pede um código novo.
  const [codigoPara, setCodigoPara] = useState('');
  const set = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }));
  const enviar = useMutation({
    mutationFn: () => api.cadastrarSemeador({ ...f, codigoIndicacao: f.codigoIndicacao || undefined }),
  });
  const pedirCodigo = useMutation({
    mutationFn: () => api.enviarCodigo(soDigitos(f.whatsapp)),
    onSuccess: () => (setCodigoPara(soDigitos(f.whatsapp)), set({ codigo: '' })),
  });
  const codigoEnviado = codigoPara !== '' && codigoPara === soDigitos(f.whatsapp);
  const valido =
    f.nome.trim().length >= 2 && f.sobrenome.trim().length >= 2 && soDigitos(f.whatsapp).length === 11 &&
    soDigitos(f.cpf).length === 11 && f.chavePix.trim().length >= 5 && codigoEnviado && f.codigo.length === 6;

  return (
    <Tela bordas={['bottom']}>
      <Destaque selo="Rede de semeadores" titulo="Você cadastra igrejas. O projeto multiplica o alcance."
        texto="Conecte congregações às campanhas, acompanhe o campo e participe do resultado com clareza e propósito." />

      <Citacao texto="O semeador saiu a semear." referencia="Mateus 13:3" />

      <Secao titulo="Do cadastro ao primeiro vínculo" />
      <Cartao style={{ gap: espaco.lg }}>
        <ItemIcone icone="create" titulo="1. Cadastre-se">Preencha o formulário abaixo. Todo cadastro passa por análise.</ItemIcone>
        <ItemIcone icone="checkmark-circle" titulo="2. Seja aprovado">A equipe retorna pelo WhatsApp com seu código de indicação.</ItemIcone>
        <ItemIcone icone="share-social" titulo="3. Indique igrejas">As igrejas informam seu código no cadastro.</ItemIcone>
        <ItemIcone icone="leaf" titulo="4. Acompanhe o fruto">Ofertas pagas nas igrejas vinculadas geram sua participação.</ItemIcone>
      </Cartao>

      <Simulador destaque="Semeador" rotuloResultado="Você receberia" />

      <Secao titulo="Quero ser semeador" />
      {enviar.isSuccess ? (
        <Cartao style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: cores.texto }}>Cadastro enviado!</Text>
          <Text style={{ color: cores.textoSuave, textAlign: 'center' }}>
            Sua solicitação está em análise. A equipe retorna pelo WhatsApp informado.
          </Text>
          <Botao titulo="Voltar" variante="contorno" onPress={voltar} style={{ alignSelf: 'stretch' }} />
        </Cartao>
      ) : (
        <Cartao style={{ gap: espaco.md }}>
          <View style={{ flexDirection: 'row', gap: espaco.sm }}>
            <View style={{ flex: 1 }}><Campo rotulo="Nome *" value={f.nome} onChangeText={(t) => set({ nome: t })} autoComplete="given-name" /></View>
            <View style={{ flex: 1 }}><Campo rotulo="Sobrenome *" value={f.sobrenome} onChangeText={(t) => set({ sobrenome: t })} autoComplete="family-name" /></View>
          </View>
          <Campo rotulo="WhatsApp *" value={f.whatsapp} keyboardType="phone-pad" placeholder="(99) 99999-9999"
            onChangeText={(t) => set({ whatsapp: mascaraTelefone(t) })} />
          <Text style={{ color: cores.textoSuave, fontSize: 13, marginTop: -4 }}>
            Usaremos este número para entrar no painel e para avisos. Confirme com o código enviado.
          </Text>
          <Botao titulo={codigoEnviado ? 'Reenviar código no WhatsApp' : 'Enviar código no WhatsApp'} variante="contorno" icone="logo-whatsapp"
            desabilitado={soDigitos(f.whatsapp).length !== 11} carregando={pedirCodigo.isPending} onPress={() => pedirCodigo.mutate()} />
          {pedirCodigo.error ? <Aviso>{(pedirCodigo.error as Error).message}</Aviso> : null}
          {codigoEnviado ? (
            <Campo rotulo="Código recebido no WhatsApp *" value={f.codigo} keyboardType="number-pad" maxLength={6} placeholder="000000"
              autoComplete="one-time-code" textContentType="oneTimeCode" onChangeText={(t) => set({ codigo: soDigitos(t).slice(0, 6) })} />
          ) : null}
          <Campo rotulo="CPF *" value={f.cpf} keyboardType="number-pad" placeholder="000.000.000-00"
            onChangeText={(t) => set({ cpf: mascaraCpf(t) })} />
          <Campo rotulo="Chave PIX para receber *" value={f.chavePix} autoCapitalize="none" onChangeText={(t) => set({ chavePix: t })} />
          <Campo rotulo="Código de quem te indicou (opcional)" value={f.codigoIndicacao} autoCapitalize="characters"
            onChangeText={(t) => set({ codigoIndicacao: t.toUpperCase() })} />
          {enviar.error ? <Aviso>{(enviar.error as Error).message}</Aviso> : null}
          <Botao titulo="Enviar cadastro" desabilitado={!valido} carregando={enviar.isPending} onPress={() => enviar.mutate()} />
        </Cartao>
      )}

      <Botao titulo="Represento uma igreja" variante="texto" onPress={() => router.push('/traga-sua-igreja')} />
    </Tela>
  );
}
