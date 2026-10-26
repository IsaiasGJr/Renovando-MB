import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Switch, Text, View } from 'react-native';
import { api } from '@/api';
import { Vazio } from '@/components/admin';
import { SeletorLista } from '@/components/Formulario';
import { Aviso, Botao, Campo, Cartao, Tela } from '@/components/ui';
import { useEhAdmin } from '@/store/sessao';
import { cores, espaco } from '@/theme';
import { confirmar } from '@/utils/confirmar';
import { moeda } from '@/utils/format';

type Igreja = { id: string; nomeFantasia: string; cidade: string; uf: string };
const soDigitos = (t: string) => t.replace(/\D/g, '');

/** Oferta recebida fora do app (ex.: dinheiro no culto). Entra como paga e gera os números da sorte. */
export default function RegistrarOferta() {
  const ehAdmin = useEhAdmin();
  const qc = useQueryClient();
  const igrejas = useQuery({ queryKey: ['igrejas', 'ativas'], queryFn: () => api<Igreja[]>('/igrejas?status=ativa'), enabled: ehAdmin });
  const [f, setF] = useState({ igrejaId: '', quantidade: '1', anonima: false, nome: '', sobrenome: '', whatsapp: '', observacao: '' });
  const set = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }));
  const salvar = useMutation({
    mutationFn: () => api<{ valor: number; numeros: string[] }>('/ofertas/manual', {
      method: 'POST',
      json: { ...f, quantidade: Number(f.quantidade), whatsapp: soDigitos(f.whatsapp) || undefined },
    }),
    onSuccess: () => qc.invalidateQueries(),
  });

  if (!ehAdmin) return <Vazio texto="Apenas administradores registram ofertas." icone="lock-closed-outline" />;
  const valido = !!f.igrejaId && Number(f.quantidade) >= 1 && f.observacao.trim().length >= 3 && (f.anonima || soDigitos(f.whatsapp).length === 11);

  async function enviar() {
    if (await confirmar('Registrar oferta?', 'Ela entra como PAGA e gera os números da sorte e os repasses.', 'Registrar')) salvar.mutate();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Tela bordas={['bottom']}>
        {salvar.error ? <Aviso>{(salvar.error as Error).message}</Aviso> : null}
        {salvar.data ? (
          <Cartao style={{ gap: espaco.md }}>
            <Aviso tipo="sucesso">
              Oferta de {moeda(salvar.data.valor)} registrada.{salvar.data.numeros.length ? ` Números: ${salvar.data.numeros.map((n) => `#${n}`).join(', ')}.` : ''}
            </Aviso>
            <Botao titulo="Registrar outra" variante="contorno" onPress={() => (salvar.reset(), set({ nome: '', sobrenome: '', whatsapp: '', quantidade: '1' }))} />
          </Cartao>
        ) : (
          <Cartao style={{ gap: espaco.md }}>
            <SeletorLista rotulo="Igreja *" valor={f.igrejaId} onChange={(v) => set({ igrejaId: v })}
              opcoes={(igrejas.data ?? []).map((i) => ({ valor: i.id, rotulo: `${i.nomeFantasia} (${i.cidade}/${i.uf})` }))} />
            <Campo rotulo="Cupons (quantidade) *" value={f.quantidade} keyboardType="number-pad" onChangeText={(t) => set({ quantidade: soDigitos(t).slice(0, 3) })} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: cores.texto, fontWeight: '600' }}>Anônima (não concorre)</Text>
              <Switch value={f.anonima} onValueChange={(v) => set({ anonima: v })} trackColor={{ true: cores.primaria }} />
            </View>
            {!f.anonima ? (
              <>
                <Campo rotulo="Nome" value={f.nome} onChangeText={(t) => set({ nome: t })} />
                <Campo rotulo="Sobrenome" value={f.sobrenome} onChangeText={(t) => set({ sobrenome: t })} />
                <Campo rotulo="WhatsApp de quem ofertou *" value={f.whatsapp} keyboardType="phone-pad" placeholder="DDD + número"
                  onChangeText={(t) => set({ whatsapp: t })} />
                <Text style={{ color: cores.textoSuave, fontSize: 12, marginTop: -espaco.sm }}>É com este número que a pessoa vê os cupons no app.</Text>
              </>
            ) : null}
            <Campo rotulo="Como a oferta foi recebida *" value={f.observacao} maxLength={300} onChangeText={(t) => set({ observacao: t })}
              placeholder="Ex.: dinheiro no culto, recibo nº 123" />
            <Botao titulo="Registrar oferta" icone="add-circle-outline" desabilitado={!valido} carregando={salvar.isPending} onPress={enviar} />
          </Cartao>
        )}
      </Tela>
    </KeyboardAvoidingView>
  );
}
