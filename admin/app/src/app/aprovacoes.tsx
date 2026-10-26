import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { api } from '@/api';
import { Info, Vazio } from '@/components/admin';
import { Aviso, Botao, Campo, Carregando, Cartao, Tela } from '@/components/ui';
import { cores, espaco, raio } from '@/theme';
import { dataHora } from '@/utils/format';

type Dados = {
  igrejas: { id: string; nomeFantasia: string; razaoSocial: string; cnpj: string; cidade: string; uf: string; pastorNome: string; pastorWhatsapp: string; criadoEm: string; semeador: string }[];
  semeadores: { id: string; nome: string; sobrenome: string; whatsapp: string; codigo: string; criadoEm: string; nivel: 1 | 2; indicadoPor: string }[];
};
type Recusa = { tipo: 'igrejas' | 'semeadores'; id: string; nome: string };

/** Cadastros feitos pelo app (igrejas e semeadores) esperando análise. */
export default function Aprovacoes() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['aprovacoes'], queryFn: () => api<Dados>('/aprovacoes') });
  const [recusa, setRecusa] = useState<Recusa | null>(null);
  const [motivo, setMotivo] = useState('');
  const decidir = useMutation({
    mutationFn: (p: { tipo: 'igrejas' | 'semeadores'; id: string; acao: 'aprovar' | 'rejeitar'; motivo?: string }) =>
      api(`/aprovacoes/${p.tipo}/${p.id}`, { method: 'POST', json: { acao: p.acao, motivo: p.motivo ?? '' } }),
    onSuccess: () => {
      setRecusa(null);
      setMotivo('');
      qc.invalidateQueries({ queryKey: ['aprovacoes'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const botoes = (tipo: 'igrejas' | 'semeadores', id: string, nome: string) => (
    <View style={{ flexDirection: 'row', gap: espaco.sm, marginTop: 4 }}>
      <Botao titulo="Aprovar" style={{ flex: 1, minHeight: 42 }} carregando={decidir.isPending && decidir.variables?.id === id && decidir.variables.acao === 'aprovar'}
        onPress={() => decidir.mutate({ tipo, id, acao: 'aprovar' })} />
      <Botao titulo="Recusar" variante="contorno" corTexto={cores.erro} style={{ flex: 1, minHeight: 42 }} onPress={() => setRecusa({ tipo, id, nome })} />
    </View>
  );

  return (
    <Tela bordas={['bottom']}>
      <Text style={{ color: cores.textoSuave }}>Quem se cadastrou recebe um aviso no celular com o resultado.</Text>
      {q.isLoading ? <Carregando /> : null}
      {q.error || decidir.error ? <Aviso>{((q.error ?? decidir.error) as Error).message}</Aviso> : null}
      {q.data ? (
        <>
          <Text style={{ fontSize: 18, fontWeight: '800', color: cores.texto }}>Igrejas ({q.data.igrejas.length})</Text>
          {q.data.igrejas.length === 0 ? <Vazio texto="Nenhuma igreja pendente." /> : q.data.igrejas.map((i) => (
            <Cartao key={i.id} style={{ gap: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: cores.texto }}>{i.nomeFantasia}</Text>
              <Info rotulo="Cidade">{`${i.cidade}/${i.uf}`}</Info>
              {i.cnpj ? <Info rotulo="CNPJ">{i.cnpj}</Info> : null}
              <Info rotulo="Pastor">{`${i.pastorNome} · ${i.pastorWhatsapp}`}</Info>
              <Info rotulo="Indicada por">{i.semeador || '—'}</Info>
              <Info rotulo="Cadastro">{dataHora(i.criadoEm)}</Info>
              {botoes('igrejas', i.id, i.nomeFantasia)}
            </Cartao>
          ))}
          <Text style={{ fontSize: 18, fontWeight: '800', color: cores.texto }}>Semeadores ({q.data.semeadores.length})</Text>
          {q.data.semeadores.length === 0 ? <Vazio texto="Nenhum semeador pendente." /> : q.data.semeadores.map((s) => (
            <Cartao key={s.id} style={{ gap: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: cores.texto }}>{s.nome} {s.sobrenome}</Text>
              <Info rotulo="WhatsApp">{s.whatsapp}</Info>
              <Info rotulo="Nível">{s.nivel === 2 ? `N2 (rede de ${s.indicadoPor})` : 'N1'}</Info>
              <Info rotulo="Cadastro">{dataHora(s.criadoEm)}</Info>
              {botoes('semeadores', s.id, `${s.nome} ${s.sobrenome}`)}
            </Cartao>
          ))}
        </>
      ) : null}

      <Modal visible={!!recusa} transparent animationType="fade" onRequestClose={() => setRecusa(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: espaco.xl }}>
          <View style={{ backgroundColor: cores.superficie, borderRadius: raio.lg, padding: espaco.xl, gap: espaco.md }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: cores.texto }}>Recusar: {recusa?.nome}</Text>
            <Campo rotulo="Motivo (opcional)" value={motivo} onChangeText={setMotivo} multiline maxLength={500}
              style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }} />
            <Botao titulo="Recusar cadastro" variante="contorno" corTexto={cores.erro} carregando={decidir.isPending}
              onPress={() => recusa && decidir.mutate({ tipo: recusa.tipo, id: recusa.id, acao: 'rejeitar', motivo })} />
            <Botao titulo="Cancelar" variante="texto" onPress={() => setRecusa(null)} />
          </View>
        </View>
      </Modal>
    </Tela>
  );
}
