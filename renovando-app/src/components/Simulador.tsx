import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api } from '@/api';
import { Cartao } from '@/components/ui';
import { cores, espaco, raio } from '@/theme';
import { moeda } from '@/utils/format';

const OPCOES = [10, 25, 50, 75, 100];

/** Simula a divisão de N cupons emitidos numa igreja, destacando um destinatário. */
export function Simulador({ destaque, rotuloResultado }: { destaque: string; rotuloResultado: string }) {
  const [cupons, setCupons] = useState(50);
  const { data: c } = useQuery({ queryKey: ['campanha'], queryFn: api.campanha });
  if (!c) return null;

  const volume = cupons * c.valorCupom;
  const alvo = c.divisao.find((d) => d.rotulo.toLowerCase() === destaque.toLowerCase());

  return (
    <Cartao>
      <Text style={{ fontWeight: '700', fontSize: 17, color: cores.texto }}>Simulador</Text>
      <Text style={{ color: cores.textoSuave }}>
        Quantos cupons seriam emitidos na igreja? Cada cupom vale {moeda(c.valorCupom)}.
      </Text>
      <View style={{ flexDirection: 'row', gap: espaco.xs, flexWrap: 'wrap' }}>
        {OPCOES.map((n) => {
          const ativo = n === cupons;
          return (
            <Pressable key={n} onPress={() => setCupons(n)} accessibilityRole="button" accessibilityState={{ selected: ativo }}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: raio.pill, borderWidth: 1,
                borderColor: ativo ? cores.primaria : cores.borda, backgroundColor: ativo ? cores.primaria : cores.superficie,
              }}>
              <Text style={{ color: ativo ? '#fff' : cores.texto, fontWeight: '600' }}>{n}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ backgroundColor: cores.primariaClara, borderRadius: raio.md, padding: espaco.lg, gap: 2 }}>
        <Text style={{ color: cores.primaria }}>{rotuloResultado}</Text>
        <Text style={{ fontSize: 30, fontWeight: '800', color: cores.primaria }}>
          {moeda((volume * (alvo?.percentual ?? 0)) / 100)}
        </Text>
        <Text style={{ color: cores.textoSuave, fontSize: 13 }}>
          sobre {cupons} cupons, {moeda(volume)} em ofertas
        </Text>
      </View>

      {c.divisao.map((d) => (
        <View key={d.rotulo} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: cores.texto, fontWeight: d === alvo ? '700' : '400' }}>
            {d.rotulo} · {d.percentual}%
          </Text>
          <Text style={{ color: cores.texto, fontWeight: d === alvo ? '700' : '400' }}>{moeda((volume * d.percentual) / 100)}</Text>
        </View>
      ))}
      <Text style={{ color: cores.textoSuave, fontSize: 12 }}>
        Simulação educativa. Os valores reais seguem a divisão da campanha ativa.
      </Text>
    </Cartao>
  );
}
