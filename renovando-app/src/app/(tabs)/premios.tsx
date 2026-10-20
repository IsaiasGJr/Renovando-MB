import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { api } from '@/api';
import { Carregando, Cartao, Tela, Titulo } from '@/components/ui';
import { cores, espaco, raio } from '@/theme';
import { data } from '@/utils/format';
import { Imagem } from '@/components/Imagem';

export default function Premios() {
  const { data: premios } = useQuery({ queryKey: ['premios'], queryFn: api.premios });

  return (
    <Tela>
      <Titulo sub="Os sorteios são transmitidos ao vivo. Você recebe um aviso no app quando começar.">
        Prêmios e sorteios
      </Titulo>
      {!premios ? (
        <Carregando />
      ) : (
        premios.map((p) => {
          const realizado = new Date(p.dataSorteio) <= new Date();
          return (
            <Cartao key={p.id} style={p.principal ? { borderColor: cores.destaque, borderWidth: 2 } : undefined}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md }}>
                <View
                  style={{
                    width: 52, height: 52, borderRadius: raio.md, backgroundColor: cores.primariaClara,
                    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}
                >
                  {p.imagemUrl ? (
                    <Imagem url={p.imagemUrl} style={{ width: 52, height: 52 }} />
                  ) : (
                    <Ionicons
                      name={p.principal ? 'car-sport' : p.nome.includes('PIX') ? 'cash' : 'gift'}
                      size={26}
                      color={cores.primaria}
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  {p.principal ? (
                    <Text style={{ color: cores.destaque, fontWeight: '700', fontSize: 12 }}>PRÊMIO PRINCIPAL</Text>
                  ) : null}
                  <Text style={{ fontSize: 17, fontWeight: '700', color: cores.texto }}>{p.nome}</Text>
                  <Text style={{ color: cores.textoSuave }}>
                    {realizado ? 'Sorteado em' : 'Sorteio em'} {data(p.dataSorteio)}
                  </Text>
                </View>
              </View>
              {p.ganhador ? (
                <View style={{ backgroundColor: cores.sucessoClaro, borderRadius: raio.sm, padding: espaco.md }}>
                  <Text style={{ color: cores.sucesso, fontWeight: '700' }}>
                    Ganhador(a): {p.ganhador.nome} · {p.ganhador.cidade}
                  </Text>
                  <Text style={{ color: cores.sucesso }}>Número sorteado: {p.ganhador.numero}</Text>
                </View>
              ) : null}
            </Cartao>
          );
        })
      )}
    </Tela>
  );
}
