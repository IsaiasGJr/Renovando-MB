import type Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Linking, ScrollView, Text, View } from 'react-native';
import { api } from '@/api';
import type { ComponentProps } from 'react';
import { Destaque, ItemIcone, Secao } from '@/components/Conteudo';
import { Aviso, Botao, Cartao, Tela } from '@/components/ui';
import { CONTATO_WHATSAPP } from '@/config';
import { cores, espaco, raio, sombra } from '@/theme';
import { Imagem } from '@/components/Imagem';

type Area = [ComponentProps<typeof Ionicons>['name'], string, string];

const AREAS: Area[] = [
  ['map', 'Área mínima de 100.000 m²', 'Espaço para o projeto completo, com áreas verdes e crescimento por etapas.'],
  ['boat', 'Área turística à beira do lago', 'Orla para descanso, encontros e experiências cristãs ao ar livre.'],
  ['bed', 'Hotel', 'Hospedagem para congressos, retiros, caravanas e equipes missionárias.'],
  ['restaurant', 'Restaurantes', 'Gera trabalho e renda e ajuda a sustentar o fundo do projeto.'],
  ['water', 'Praia para batismo e lazer', 'Lugar de testemunho, celebração e convivência em família.'],
  ['football', 'Área de esportes', 'Campos e quadras para crianças, jovens e famílias.'],
  ['people', 'Centro de convenções', 'Conferências, treinamentos e encontros ministeriais.'],
  ['musical-notes', 'Arena de shows gospel', 'Festivais, celebrações e encontros de grande alcance.'],
  ['musical-note', 'Escola de música', 'Formação musical para novas gerações e ministérios de louvor.'],
  ['laptop', 'Escola de computação', 'Inclusão digital e capacitação para o trabalho.'],
  ['book', 'Escola bíblica', 'Estudo, discipulado e formação cristã para todas as idades.'],
  ['bonfire', 'Área de camping', 'Retiros, acampamentos e imersões de jovens.'],
  ['fish', 'Barcos de pesca', 'Passeios e pesca assistida: lazer, turismo responsável e descanso.'],
];

const VISAO: Area[] = [
  ['grid', 'Tudo em um só lugar', 'Hospedagem, convenção, arena, escolas, esporte, camping e orla num caminho pensado para acolher e servir.'],
  ['water', 'Uma orla com propósito', 'A margem do lago recebe famílias, visitantes e caravanas com descanso, refeições e momentos de fé.'],
  ['megaphone', 'Eventos que mobilizam a cidade', 'Conferências, congressos e celebrações gospel que fortalecem igrejas e levam esperança.'],
  ['school', 'Formação que abre futuro', 'Escolas de música, tecnologia e Bíblia para desenvolver dons e novas habilidades com base cristã.'],
  ['football', 'Juventude perto da fé', 'Quadras, campos e acampamentos para discipulado, amizade e restauração familiar.'],
];

export default function PalmasParaJesus() {
  const galeria = useQuery({ queryKey: ['galeria', 'palmas'], queryFn: () => api.galeria('palmas') });
  return (
    <Tela bordas={['bottom']}>
      <Destaque selo="Fundo social · Centro de Convivência Cristã" titulo="Palmas para Jesus"
        texto="Um centro cristão às margens do lago para acolher famílias, formar pessoas, receber igrejas e anunciar Jesus em Palmas." />

      <Aviso>Projeto em planejamento. As áreas abaixo são perspectivas ilustrativas.</Aviso>

      {galeria.data?.length ? (
        <>
          <Secao titulo="Veja o que esse lugar pode se tornar" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -espaco.lg }}
            contentContainerStyle={{ gap: espaco.md, paddingHorizontal: espaco.lg }}>
            {galeria.data.map((g) => (
              <View key={g.id} style={[{ width: 280, borderRadius: raio.lg, overflow: 'hidden', backgroundColor: cores.superficie }, sombra(1)]}>
                <Imagem url={g.imagemUrl} style={{ width: 280, height: 180 }} rotulo={g.titulo} />
                {g.titulo ? <Text style={{ padding: espaco.md, color: cores.texto, fontSize: 13 }} numberOfLines={2}>{g.titulo}</Text> : null}
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}

      <Secao titulo="A visão do projeto" />
      <Cartao style={{ gap: espaco.lg }}>
        {VISAO.map(([icone, titulo, texto]) => <ItemIcone key={titulo} icone={icone} titulo={titulo}>{texto}</ItemIcone>)}
      </Cartao>

      <Secao titulo="O que será construído" />
      <Cartao style={{ gap: espaco.lg }}>
        {AREAS.map(([icone, titulo, texto]) => (
          <ItemIcone key={titulo} icone={icone} titulo={titulo}>{texto}</ItemIcone>
        ))}
      </Cartao>

      <Cartao style={{ backgroundColor: cores.primariaClara, borderColor: cores.primariaClara }}>
        <ItemIcone icone="heart" titulo="Quer apoiar?">
          Fale com a equipe para saber como contribuir com o projeto.
        </ItemIcone>
        <Botao titulo="Quero apoiar" icone="logo-whatsapp"
          onPress={() => Linking.openURL(`https://wa.me/${CONTATO_WHATSAPP}?text=${encodeURIComponent('Quero apoiar o Palmas para Jesus')}`)} />
      </Cartao>
    </Tela>
  );
}
