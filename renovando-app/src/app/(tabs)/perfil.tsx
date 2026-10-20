import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Alert, Linking, Platform, Pressable, Text, View } from 'react-native';
import { api } from '@/api';
import { ConviteAvisos } from '@/components/ConviteAvisos';
import { Botao, Cartao, Tela, Titulo } from '@/components/ui';
import { CONTATO_EMAIL, CONTATO_WHATSAPP } from '@/config';
import { useAuth } from '@/store/auth';
import { cores, espaco } from '@/theme';
import { mascaraTelefone } from '@/utils/format';

type Icone = ComponentProps<typeof Ionicons>['name'];

function Item({ icone, texto, onPress }: { icone: Icone; texto: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link"
      style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md, paddingVertical: espaco.md }}>
      <Ionicons name={icone} size={20} color={cores.primaria} />
      <Text style={{ flex: 1, color: cores.texto, fontSize: 15 }}>{texto}</Text>
      <Ionicons name="chevron-forward" size={18} color={cores.textoSuave} />
    </Pressable>
  );
}

function Grupo({ titulo, itens }: { titulo: string; itens: [Icone, string, Href][] }) {
  return (
    <View style={{ gap: espaco.xs }}>
      <Text style={{ color: cores.textoSuave, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>{titulo}</Text>
      <Cartao style={{ paddingVertical: espaco.xs, gap: 0 }}>
        {itens.map(([icone, texto, rota]) => <Item key={texto} icone={icone} texto={texto} onPress={() => router.push(rota)} />)}
      </Cartao>
    </View>
  );
}

export default function Mais() {
  const { usuario, sair } = useAuth();

  // Útil se o celular foi perdido ou alguém entrou na conta em outro aparelho.
  async function sairDeTodos() {
    const confirmar = () => api.sairDeTodos().catch(() => undefined).finally(sair);
    const texto = 'Seu login será encerrado em todos os aparelhos, inclusive neste. Para voltar, basta pedir um código novo.';
    if (Platform.OS === 'web') {
      if (window.confirm(`Sair de todos os aparelhos?

${texto}`)) await confirmar();
      return;
    }
    Alert.alert('Sair de todos os aparelhos?', texto, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair de todos', style: 'destructive', onPress: confirmar },
    ]);
  }

  return (
    <Tela>
      <Titulo>Mais</Titulo>
      {usuario ? (
        <Cartao>
          <Text style={{ fontSize: 18, fontWeight: '700', color: cores.texto }}>{usuario.nome} {usuario.sobrenome}</Text>
          <Text style={{ color: cores.textoSuave }}>{mascaraTelefone(usuario.whatsapp)}</Text>
        </Cartao>
      ) : (
        <Botao titulo="Entrar com WhatsApp" icone="logo-whatsapp"
          onPress={() => router.push({ pathname: '/login', params: { voltar: '/perfil' } })} />
      )}

      <ConviteAvisos />

      <Grupo titulo="O projeto" itens={[
        ['information-circle-outline', 'Conheça o projeto', '/projeto'],
        ['leaf-outline', 'Palmas para Jesus', '/palmas-para-jesus'],
        ['newspaper-outline', 'Novidades', '/noticias'],
        ['chatbubble-ellipses-outline', 'Depoimentos', '/depoimentos'],
        ['help-circle-outline', 'Perguntas frequentes', '/faq'],
      ]} />

      {usuario ? (
        <Grupo titulo="Minha área" itens={[
          ['speedometer-outline', 'Meu painel (igreja ou semeador)', '/painel'],
        ]} />
      ) : null}

      <Grupo titulo="Participe" itens={[
        ['business-outline', 'Traga sua igreja', '/traga-sua-igreja'],
        ['people-outline', 'Seja um semeador', '/seja-semeador'],
        ['musical-notes-outline', 'Shows gospel', '/shows'],
      ]} />

      <View style={{ gap: espaco.xs }}>
        <Text style={{ color: cores.textoSuave, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>Contato</Text>
        <Cartao style={{ paddingVertical: espaco.xs, gap: 0 }}>
          <Item icone="chatbubbles-outline" texto="Fale conosco (mensagem e anexos)" onPress={() => router.push('/contato')} />
          <Item icone="logo-whatsapp" texto="Fale conosco no WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${CONTATO_WHATSAPP}`)} />
          <Item icone="mail-outline" texto={CONTATO_EMAIL} onPress={() => Linking.openURL(`mailto:${CONTATO_EMAIL}`)} />
        </Cartao>
      </View>

      <Grupo titulo="Legal" itens={[
        ['shield-checkmark-outline', 'Política de Privacidade', '/pagina/privacidade'],
        ['document-text-outline', 'Termos de Uso', '/pagina/termos'],
      ]} />

      {usuario ? (
        <>
          <Botao titulo="Sair" variante="contorno" onPress={sair} />
          <Botao titulo="Sair de todos os aparelhos" variante="texto" icone="phone-portrait-outline" onPress={sairDeTodos} />
          <Botao titulo="Excluir minha conta" variante="texto" corTexto={cores.erro} icone="trash-outline"
            onPress={() => router.push('/excluir-conta')} />
        </>
      ) : null}
    </Tela>
  );
}
