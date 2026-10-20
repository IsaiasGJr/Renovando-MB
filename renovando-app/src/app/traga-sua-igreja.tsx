import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { api } from '@/api';
import { Destaque, ItemIcone, Secao } from '@/components/Conteudo';
import { Simulador } from '@/components/Simulador';
import { Botao, Cartao, Tela } from '@/components/ui';
import { cores, espaco } from '@/theme';

export default function TragaSuaIgreja() {
  const { data: c } = useQuery({ queryKey: ['campanha'], queryFn: api.campanha });
  const pct = c?.divisao.find((d) => d.rotulo.toLowerCase() === 'igreja')?.percentual ?? 80;

  return (
    <Tela bordas={['bottom']}>
      <Destaque selo="Para igrejas" titulo="Cadastre sua igreja"
        texto={`Participe das campanhas e receba ${pct}% de cada oferta no PIX da congregação, com transparência.`}>
        <Botao titulo="Cadastrar minha igreja" style={{ backgroundColor: cores.destaque }} onPress={() => router.push('/cadastro-igreja')} />
      </Destaque>

      <Secao titulo="Por que participar" />
      <Cartao style={{ gap: espaco.lg }}>
        <ItemIcone icone="cash" titulo={`${pct}% para o ministério local`}>A maior fatia de cada oferta paga vai direto para a igreja.</ItemIcone>
        <ItemIcone icone="ticket" titulo="Campanha com cupons">Sua comunidade oferta com propósito e concorre a prêmios.</ItemIcone>
        <ItemIcone icone="globe" titulo="Presença na rede">Igrejas ativas aparecem para os ofertantes no app.</ItemIcone>
        <ItemIcone icone="shield-checkmark" titulo="Ativação com revisão">Só igrejas validadas pela equipe recebem ofertas.</ItemIcone>
        <ItemIcone icone="hand-left" titulo="Autonomia">Cada igreja decide como usar os recursos, sem interferência.</ItemIcone>
      </Cartao>

      <Simulador destaque="Igreja" rotuloResultado="Sua igreja receberia" />

      <Secao titulo="O que ter em mãos" />
      <Cartao style={{ gap: espaco.lg }}>
        <ItemIcone icone="document-text" titulo="CNPJ da igreja (opcional)" />
        <ItemIcone icone="logo-whatsapp" titulo="WhatsApp do pastor" />
        <ItemIcone icone="location" titulo="Endereço e cidade" />
        <ItemIcone icone="key" titulo="Chave PIX da congregação" />
      </Cartao>

      <Botao titulo="Ir para o cadastro" onPress={() => router.push('/cadastro-igreja')} />
      <Botao titulo="Quero ser semeador" variante="texto" onPress={() => router.push('/seja-semeador')} />
    </Tela>
  );
}
