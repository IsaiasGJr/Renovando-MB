import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { api } from '@/api';
import { Destaque } from '@/components/Conteudo';
import { Aviso, Carregando, Cartao, Tela } from '@/components/ui';
import { cores, espaco, raio } from '@/theme';

export default function Depoimentos() {
  const q = useQuery({ queryKey: ['depoimentos'], queryFn: api.depoimentos });

  return (
    <Tela bordas={['bottom']}>
      <Destaque selo="Depoimentos" titulo="O que Deus tem feito através do Renovando"
        texto="Histórias de igrejas, projetos e ofertantes que foram abençoados pela campanha." />
      {q.isLoading ? <Carregando /> : null}
      {q.error ? <Aviso>{(q.error as Error).message}</Aviso> : null}
      {q.data?.length === 0 ? <Text style={{ color: cores.textoSuave }}>Nenhum depoimento publicado ainda.</Text> : null}
      {q.data?.map((d) => (
        <Cartao key={d.id} style={{ gap: espaco.md }}>
          <Ionicons name="chatbubble-ellipses" size={24} color={cores.destaque} />
          <Text style={{ fontSize: 17, fontWeight: '800', color: cores.texto }}>“{d.titulo}”</Text>
          <Text style={{ color: cores.textoSuave, lineHeight: 22, fontSize: 15 }}>{d.texto}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.sm }}>
            <View style={{ width: 36, height: 36, borderRadius: raio.pill, backgroundColor: cores.primariaClara, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: cores.primaria, fontWeight: '800' }}>{d.autor.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={{ color: cores.texto, fontWeight: '700' }}>{d.autor}</Text>
              {d.local ? <Text style={{ color: cores.textoSuave, fontSize: 13 }}>{d.local}</Text> : null}
            </View>
          </View>
        </Cartao>
      ))}
    </Tela>
  );
}
