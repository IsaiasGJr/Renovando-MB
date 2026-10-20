import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';
import { api } from '@/api';
import { Citacao, Destaque, ItemIcone, Secao } from '@/components/Conteudo';
import { Botao, Cartao, Tela } from '@/components/ui';
import { cores, espaco, raio, sombra } from '@/theme';
import { Imagem } from '@/components/Imagem';

const EDICOES = [
  ['2022', '1ª edição', 'Cerca de 270 ministérios engajados. Cupons de R$ 10 e prêmios como moto, celulares e Bíblias.'],
  ['2023/24', '2ª edição', 'Sorteios ao vivo em evento nacional, crescimento orgânico e novas parcerias.'],
  ['2025', '3ª edição', 'Expansão nacional, prêmios maiores e 5% para o fundo social e projetos evangelísticos.'],
] as const;

export default function Projeto() {
  const parceiros = useQuery({ queryKey: ['parceiros'], queryFn: api.parceiros });
  return (
    <Tela bordas={['bottom']}>
      <Destaque selo="O projeto" titulo="Unindo propósitos com fé e ações sociais"
        texto="Uma iniciativa cristã de cooperação que fortalece a evangelização, incentiva ofertas e amplia ações sociais em todo o Brasil.">
        <Botao titulo="Fazer minha oferta" icone="heart" style={{ backgroundColor: cores.destaque }} onPress={() => router.navigate('/')} />
      </Destaque>

      <Citacao texto="Cada um exerça o dom que recebeu para servir os outros." referencia="1 Pedro 4:10" />

      <Cartao>
        <ItemIcone icone="flag" titulo="Nossa missão">
          Unir, fortalecer e impulsionar o Corpo de Cristo, conectando igrejas e ministérios para atuarem juntos.
        </ItemIcone>
        <ItemIcone icone="eye" titulo="Nossa visão">
          Transformar vidas por meio da evangelização, da generosidade e do serviço.
        </ItemIcone>
      </Cartao>

      <Secao titulo="Como funciona" />
      <Cartao style={{ gap: espaco.lg }}>
        <ItemIcone icone="ticket" titulo="Igrejas recebem cupons sem custo">
          Cada igreja aprovada tem sua campanha para distribuir cupons à comunidade.
        </ItemIcone>
        <ItemIcone icone="gift" titulo="Fiéis ofertam e concorrem">
          Quem oferta recebe números da sorte e concorre a carros, motos, celulares e outros prêmios.
        </ItemIcone>
        <ItemIcone icone="business" titulo="A maior parte fica na igreja local">
          A igreja recebe sua parte direto no PIX da congregação para investir no que precisa.
        </ItemIcone>
        <ItemIcone icone="people" titulo="Fundo social">
          Uma parte vai para projetos sociais e evangelísticos. Igrejas participantes podem inscrever projetos.
        </ItemIcone>
      </Cartao>

      <Secao titulo="Frutos já colhidos" />
      {EDICOES.map(([ano, nome, texto]) => (
        <View key={ano} style={{ flexDirection: 'row', gap: espaco.md }}>
          <View style={{ width: 72 }}>
            <Text style={{ fontWeight: '800', color: cores.primaria, fontSize: 16 }}>{ano}</Text>
            <Text style={{ color: cores.textoSuave, fontSize: 12 }}>{nome}</Text>
          </View>
          <Text style={{ flex: 1, color: cores.texto, lineHeight: 20 }}>{texto}</Text>
        </View>
      ))}

      <Secao titulo="Impacto social e espiritual" />
      <Cartao style={{ gap: espaco.lg }}>
        <ItemIcone icone="hammer" titulo="Reformas de templos" />
        <ItemIcone icone="medkit" titulo="Apoio a casas de recuperação" />
        <ItemIcone icone="book" titulo="Distribuição de Bíblias e alimentos" />
        <ItemIcone icone="megaphone" titulo="Evangelização em comunidades" />
      </Cartao>

      <Secao titulo="Rede de parcerias" />
      <Text style={{ color: cores.textoSuave, lineHeight: 20 }}>
        Um projeto dessa magnitude só é possível com a colaboração de diferentes setores unidos pelo mesmo propósito.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md }}>
        {parceiros.data?.map((p) => (
          <Pressable key={p.id} disabled={!p.site} onPress={() => Linking.openURL(p.site)}
            style={[{ width: '30%', flexGrow: 1, aspectRatio: 1.4, backgroundColor: cores.superficie, borderRadius: raio.lg, alignItems: 'center', justifyContent: 'center', padding: espaco.sm }, sombra(1)]}>
            {p.logoUrl ? <Imagem url={p.logoUrl} style={{ width: '90%', height: '70%' }} ajuste="contain" rotulo={p.nome} />
              : <Text style={{ textAlign: 'center', color: cores.textoSuave, fontWeight: '700', fontSize: 12 }}>{p.nome}</Text>}
          </Pressable>
        ))}
      </View>

      <Botao titulo="Conheça o Palmas para Jesus" variante="contorno" onPress={() => router.push('/palmas-para-jesus')} />
      <Botao titulo="Fale conosco" icone="chatbubbles-outline" onPress={() => router.push('/contato')} />
    </Tela>
  );
}
