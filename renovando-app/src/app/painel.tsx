import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, baixarPanfleto, BASE_URL } from '@/api';
import { Destaque } from '@/components/Conteudo';
import { LogoIgreja } from '@/components/Igrejas';
import { Aviso, Botao, Carregando, Cartao, s as ui } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { cores, espaco, raio } from '@/theme';
import { moeda, numero } from '@/utils/format';

const ROTULO_STATUS: Record<string, string> = {
  ativa: 'Ativa', ativo: 'Ativo', pendente: 'Em análise', rejeitada: 'Não aprovada', rejeitado: 'Não aprovado', inativa: 'Inativa', inativo: 'Inativo',
};

function Selo({ status }: { status: string }) {
  const ok = status === 'ativa' || status === 'ativo';
  const pend = status === 'pendente';
  return (
    <View style={{ backgroundColor: ok ? cores.sucessoClaro : pend ? cores.avisoClaro : '#EEE8EC', borderRadius: raio.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
      <Text style={{ color: ok ? cores.sucesso : pend ? cores.aviso : cores.textoSuave, fontSize: 12, fontWeight: '700' }}>{ROTULO_STATUS[status] ?? status}</Text>
    </View>
  );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: destaque ? cores.primariaClara : cores.fundo, borderRadius: raio.md, padding: espaco.md }}>
      <Text style={{ color: cores.textoSuave, fontSize: 12 }}>{rotulo}</Text>
      <Text style={{ color: destaque ? cores.primaria : cores.texto, fontWeight: '900', fontSize: 18 }} numberOfLines={1} adjustsFontSizeToFit>{valor}</Text>
    </View>
  );
}

/** Painel de quem é pastor responsável por uma igreja e/ou semeador (pelo WhatsApp cadastrado). */
export default function Painel() {
  const token = useAuth((a) => a.token);
  const q = useQuery({ queryKey: ['painel', token], queryFn: api.painel, enabled: !!token });
  const p = q.data;
  const vazio = p && !p.igrejas.length && !p.semeador;

  return (
    <SafeAreaView style={ui.tela} edges={['bottom']}>
      <ScrollView contentContainerStyle={ui.conteudo}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={cores.primaria} />}>
        <Destaque selo="Meu painel" titulo="Acompanhe sua igreja e sua rede"
          texto="Os números consideram só ofertas já pagas da campanha." />
        {q.isLoading ? <Carregando /> : null}
        {q.error ? <Aviso>{(q.error as Error).message}</Aviso> : null}

        {vazio ? (
          <Cartao style={{ alignItems: 'center', gap: espaco.md }}>
            <Ionicons name="information-circle" size={36} color={cores.primaria} />
            <Text style={{ color: cores.texto, textAlign: 'center', lineHeight: 21 }}>
              Seu WhatsApp não está cadastrado como pastor de uma igreja nem como semeador.
            </Text>
            <Botao titulo="Cadastrar minha igreja" onPress={() => router.push('/traga-sua-igreja')} style={{ alignSelf: 'stretch' }} />
            <Botao titulo="Quero ser semeador" variante="contorno" onPress={() => router.push('/seja-semeador')} style={{ alignSelf: 'stretch' }} />
          </Cartao>
        ) : null}

        {p?.igrejas.map((i) => (
          <Cartao key={i.id} style={{ gap: espaco.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md }}>
              <LogoIgreja nome={i.nomeFantasia} logoUrl={i.logoUrl} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: cores.texto, fontSize: 16 }}>{i.nomeFantasia}</Text>
                <Text style={{ color: cores.textoSuave, fontSize: 13 }}>{i.cidade}/{i.uf} · Protocolo {i.protocolo}</Text>
              </View>
              <Selo status={i.status} />
            </View>
            {i.status === 'ativa' ? (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm }}>
                  <Numero rotulo={`Repasse à igreja (${p.percentuais.igreja}%)`} valor={moeda(i.repasse)} destaque />
                  <Numero rotulo="Arrecadado" valor={moeda(i.arrecadado)} />
                  <Numero rotulo="Ofertas pagas" valor={numero(i.ofertas)} />
                  <Numero rotulo="Números da sorte" valor={numero(i.cupons)} />
                </View>
                <Botao titulo="Divulgar o link da igreja" icone="share-social-outline"
                  onPress={() => Share.share({ message: `Oferte para a ${i.nomeFantasia} na campanha Renovando e concorra a prêmios: ${BASE_URL}/igreja/${i.slug}` })} />
                <Botao titulo="Ver a página da igreja" variante="contorno" onPress={() => router.push({ pathname: '/igreja/[slug]', params: { slug: i.slug } })} />
                <BotoesPanfleto igrejaId={i.id} slug={i.slug} />
              </>
            ) : (
              <Aviso>{i.status === 'pendente' ? 'Cadastro em análise. Você recebe o retorno pelo WhatsApp.' : 'Esta igreja não está ativa na campanha. Fale com a equipe.'}</Aviso>
            )}
          </Cartao>
        ))}

        {p?.semeador ? (
          <Cartao style={{ gap: espaco.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: cores.texto }}>Semeador · {p.semeador.nome}</Text>
              <Selo status={p.semeador.status} />
            </View>
            {p.semeador.status === 'ativo' ? (
              <>
                <View style={{ backgroundColor: cores.destaqueClaro, borderRadius: raio.md, padding: espaco.md, alignItems: 'center' }}>
                  <Text style={{ color: cores.destaqueEscuro, fontSize: 12, fontWeight: '700' }}>SEU CÓDIGO DE INDICAÇÃO</Text>
                  <Text style={{ color: cores.primariaEscura, fontSize: 28, fontWeight: '900', letterSpacing: 3 }}>{p.semeador.codigo}</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm }}>
                  <Numero rotulo={`Sua participação (${p.percentuais.semeador}%)`} valor={moeda(p.semeador.comissao)} destaque />
                  <Numero rotulo="Volume das igrejas ativas" valor={moeda(p.semeador.volume)} />
                  <Numero rotulo="Igrejas vinculadas" valor={numero(p.semeador.igrejas.length)} />
                  <Numero rotulo="Semeadores indicados" valor={numero(p.semeador.semeadoresIndicados)} />
                </View>
                <Botao titulo="Enviar convite para uma igreja" icone="share-social-outline"
                  onPress={() => Share.share({ message: `Cadastre sua igreja na campanha Renovando com o meu código ${p.semeador!.codigo}: ${BASE_URL}/indicacao/${p.semeador!.codigo}` })} />
                {p.semeador.igrejas.map((i) => (
                  <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.sm, paddingVertical: 4 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: cores.texto, fontWeight: '700' }}>{i.nomeFantasia}</Text>
                      <Text style={{ color: cores.textoSuave, fontSize: 12 }}>{i.cidade}/{i.uf} · {moeda(i.arrecadado)}</Text>
                    </View>
                    <Selo status={i.status} />
                  </View>
                ))}
              </>
            ) : (
              <Aviso>{p.semeador.status === 'pendente' ? 'Seu cadastro está em análise. A equipe retorna pelo WhatsApp.' : 'Seu cadastro de semeador não está ativo. Fale com a equipe.'}</Aviso>
            )}
          </Cartao>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Panfleto da igreja para imprimir (PDF A4) com o QR Code da página dela:
 * 1 por folha (cartaz) ou 6 por folha (para recortar e distribuir).
 */
function BotoesPanfleto({ igrejaId, slug }: { igrejaId: string; slug: string }) {
  const [gerando, setGerando] = useState<1 | 6 | null>(null);
  async function baixar(porPagina: 1 | 6) {
    setGerando(porPagina);
    try {
      await baixarPanfleto(igrejaId, slug, porPagina);
    } catch (e) {
      const msg = (e as Error).message;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Panfleto', msg);
    } finally {
      setGerando(null);
    }
  }
  return (
    <View style={{ gap: espaco.sm }}>
      <Text style={{ fontWeight: '700', color: cores.texto }}>Panfleto para imprimir (com o QR Code da igreja)</Text>
      <View style={{ flexDirection: 'row', gap: espaco.sm }}>
        <Botao titulo="1 por folha" icone="document-outline" variante="contorno" style={{ flex: 1 }}
          carregando={gerando === 1} desabilitado={gerando !== null} onPress={() => baixar(1)} />
        <Botao titulo="6 por folha" icone="copy-outline" variante="contorno" style={{ flex: 1 }}
          carregando={gerando === 6} desabilitado={gerando !== null} onPress={() => baixar(6)} />
      </View>
    </View>
  );
}
