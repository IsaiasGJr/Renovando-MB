import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/api';
import type { Artista } from '@/types';
import { Destaque, ItemIcone, Secao } from '@/components/Conteudo';
import { Aviso, Botao, Campo, Carregando, Cartao, Tela } from '@/components/ui';
import { cores, espaco, raio, sombra } from '@/theme';
import { dataBrParaIso, mascaraData, mascaraTelefone, soDigitos } from '@/utils/format';
import { Imagem } from '@/components/Imagem';

const VAZIO = { nome: '', whatsapp: '', email: '', igreja: '', cidade: '', uf: '', dataEvento: '', tipo: '', publico: '', mensagem: '' };

export default function Shows() {
  const artistas = useQuery({ queryKey: ['artistas'], queryFn: api.artistas });
  const { artista } = useLocalSearchParams<{ artista?: string }>();
  // Vindo da página de um artista, ele já chega marcado no pedido.
  const [escolhidos, setEscolhidos] = useState<string[]>(artista ? [artista] : []);
  const [f, setF] = useState(VAZIO);
  const set = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }));
  const alternar = useCallback((nome: string) =>
    setEscolhidos((e) => (e.includes(nome) ? e.filter((x) => x !== nome) : [...e, nome])), []);

  const enviar = useMutation({
    mutationFn: () => api.solicitarShow({ ...f, dataEvento: dataBrParaIso(f.dataEvento), artistas: escolhidos }),
    onSuccess: () => (setF(VAZIO), setEscolhidos([])),
  });

  const valido =
    f.nome.trim().length >= 2 && soDigitos(f.whatsapp).length === 11 && /\S+@\S+\.\S+/.test(f.email) &&
    f.cidade.trim().length >= 2 && f.uf.trim().length === 2 && !!dataBrParaIso(f.dataEvento) && escolhidos.length > 0;

  return (
    <Tela bordas={['bottom']}>
      <Destaque selo="Shows gospel" titulo="O melhor do gospel no seu evento"
        texto="Contrate artistas gospel para igrejas, congressos e eventos, com atendimento direto da produção." />

      <Cartao style={{ gap: espaco.lg }}>
        <ItemIcone icone="person" titulo="Sem intermediários">Você fala direto com a produção: proposta, data e rider no mesmo lugar.</ItemIcone>
        <ItemIcone icone="flash" titulo="Sem burocracia">Envie os dados do evento e receba a disponibilidade com agilidade.</ItemIcone>
        <ItemIcone icone="chatbubbles" titulo="Atendimento próximo">Acompanhamento para igrejas, produtoras e organizadores.</ItemIcone>
      </Cartao>

      <Secao titulo="Artistas gospel para o seu evento" />
      <Text style={{ color: cores.textoSuave }}>Toque num artista para ver a página dele.</Text>
      {artistas.isLoading ? <Carregando /> : null}
      <Catalogo artistas={artistas.data} />

      <Secao titulo="Quais artistas você quer?" />
      <Text style={{ color: cores.textoSuave }}>Toque para marcar um ou mais.</Text>
      <Seletor artistas={artistas.data} escolhidos={escolhidos} alternar={alternar} />

      <Secao titulo="Solicite proposta e disponibilidade" />
      {enviar.isSuccess ? <Aviso tipo="sucesso">Pedido enviado! A produção retorna pelo WhatsApp com disponibilidade e valores.</Aviso> : null}
      <Cartao style={{ gap: espaco.md }}>
        <Campo rotulo="Nome *" value={f.nome} onChangeText={(t) => set({ nome: t })} autoComplete="name" />
        <Campo rotulo="WhatsApp *" value={f.whatsapp} keyboardType="phone-pad" placeholder="(99) 99999-9999"
          onChangeText={(t) => set({ whatsapp: mascaraTelefone(t) })} />
        <Campo rotulo="E-mail *" value={f.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email"
          onChangeText={(t) => set({ email: t })} />
        <Campo rotulo="Igreja ou produtora" value={f.igreja} onChangeText={(t) => set({ igreja: t })} />
        <View style={{ flexDirection: 'row', gap: espaco.sm }}>
          <View style={{ flex: 3 }}><Campo rotulo="Cidade *" value={f.cidade} onChangeText={(t) => set({ cidade: t })} /></View>
          <View style={{ flex: 1 }}><Campo rotulo="UF *" value={f.uf} maxLength={2} autoCapitalize="characters" onChangeText={(t) => set({ uf: t.toUpperCase() })} /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: espaco.sm }}>
          <View style={{ flex: 1 }}>
            <Campo rotulo="Data do evento *" value={f.dataEvento} keyboardType="number-pad" placeholder="dd/mm/aaaa"
              onChangeText={(t) => set({ dataEvento: mascaraData(t) })} />
          </View>
          <View style={{ flex: 1 }}>
            <Campo rotulo="Público estimado" value={f.publico} keyboardType="number-pad" onChangeText={(t) => set({ publico: soDigitos(t) })} />
          </View>
        </View>
        <Campo rotulo="Tipo de evento" value={f.tipo} placeholder="Show, congresso…" onChangeText={(t) => set({ tipo: t })} />
        <Campo rotulo="Mensagem" value={f.mensagem} multiline onChangeText={(t) => set({ mensagem: t })} style={{ minHeight: 90, textAlignVertical: 'top', paddingTop: 10 }} />
        {escolhidos.length === 0 ? <Text style={{ color: cores.textoSuave, fontSize: 13 }}>Selecione ao menos um artista acima.</Text> : null}
        {enviar.error ? <Aviso>{(enviar.error as Error).message}</Aviso> : null}
        <Botao titulo="Enviar solicitação" desabilitado={!valido} carregando={enviar.isPending} onPress={() => enviar.mutate()} />
      </Cartao>
    </Tela>
  );
}

// Os dois blocos abaixo ficam separados e memorizados: digitar no formulário não redesenha os 47 artistas.

const Catalogo = memo(function Catalogo({ artistas }: { artistas?: Artista[] }) {
  // Grade de 3 colunas (4 em telas largas) com cartões do mesmo tamanho, inclusive na última linha.
  const [largura, setLargura] = useState(0);
  const colunas = largura > 700 ? 4 : 3;
  const lado = largura ? Math.floor((largura - espaco.md * (colunas - 1)) / colunas) : 0;
  return (
    <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md }}>
      {lado ? artistas?.map((a) => (
        <Pressable key={a.id} onPress={() => a.slug && router.push({ pathname: '/artista/[slug]', params: { slug: a.slug } })}
          accessibilityRole="button" accessibilityLabel={`Ver ${a.nome}`}
          style={[{ width: lado, aspectRatio: 3 / 4, backgroundColor: cores.primariaProfunda, borderRadius: raio.lg, overflow: 'hidden' }, sombra(1)]}>
          {/* Fotos em retrato: corta por baixo e preserva o rosto. */}
          {a.fotoUrl ? <Imagem url={a.fotoUrl} style={StyleSheet.absoluteFill} posicao="top" />
            : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="mic" size={30} color={cores.primariaSuave} /></View>}
          {/* Nome sobre um degradê escuro: legível em qualquer foto. */}
          <LinearGradient colors={['transparent', 'rgba(54,0,42,0.92)']}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 36, paddingHorizontal: espaco.sm, paddingBottom: espaco.sm }}>
            <Text style={{ fontWeight: '800', color: '#fff', fontSize: 13 }} numberOfLines={2}>{a.nome}</Text>
          </LinearGradient>
        </Pressable>
      )) : null}
    </View>
  );
});

const Seletor = memo(function Seletor({ artistas, escolhidos, alternar }: { artistas?: Artista[]; escolhidos: string[]; alternar: (nome: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm }}>
      {artistas?.map((a) => {
        const ativo = escolhidos.includes(a.nome);
        return (
          <Pressable key={a.id} onPress={() => alternar(a.nome)} accessibilityRole="checkbox" accessibilityState={{ checked: ativo }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingLeft: a.fotoUrl ? 6 : 12, paddingRight: 12,
              borderRadius: raio.pill, borderWidth: 1, borderColor: ativo ? cores.primaria : cores.borda,
              backgroundColor: ativo ? cores.primariaClara : cores.superficie,
            }}>
            {a.fotoUrl ? <Imagem url={a.fotoUrl} style={{ width: 28, height: 28, borderRadius: 14 }} posicao="top" /> : null}
            {ativo ? <Ionicons name="checkmark" size={16} color={cores.primaria} /> : null}
            <Text style={{ color: ativo ? cores.primaria : cores.texto, fontWeight: '600' }}>{a.nome}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});
