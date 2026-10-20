import { Linking } from 'react-native';
import { ListaFaq } from '@/components/Conteudo';
import { Botao, Tela, Titulo } from '@/components/ui';
import { CONTATO_WHATSAPP } from '@/config';

export default function Faq() {
  return (
    <Tela bordas={['bottom']}>
      <Titulo sub="Reunimos as principais dúvidas. Não achou a sua? Fale com a gente.">Perguntas frequentes</Titulo>
      <ListaFaq />
      <Botao titulo="Falar no WhatsApp" icone="logo-whatsapp" variante="contorno"
        onPress={() => Linking.openURL(`https://wa.me/${CONTATO_WHATSAPP}`)} />
    </Tela>
  );
}
