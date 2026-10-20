import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { api } from '@/api';
import { Chips, GradeKpi, Kpi, Vazio } from '@/components/admin';
import { Aviso, Botao, Campo, Carregando, Cartao, Tela } from '@/components/ui';
import { useEhAdmin } from '@/store/sessao';
import { cores, espaco } from '@/theme';
import { confirmar } from '@/utils/confirmar';
import { dataHora, numero } from '@/utils/format';

type Resumo = {
  dispositivos: number;
  comLogin: number;
  enviados: { adminNome: string; resumo: string; criadoEm: string; detalhes: { mensagem?: string; enviados?: number } }[];
};

const ROTAS = [
  { valor: '/', rotulo: 'Início' }, { valor: '/premios', rotulo: 'Prêmios' }, { valor: '/cupons', rotulo: 'Meus cupons' },
  { valor: '/igrejas', rotulo: 'Igrejas' }, { valor: '/noticias', rotulo: 'Novidades' }, { valor: '/shows', rotulo: 'Shows' },
] as const;
type Rota = (typeof ROTAS)[number]['valor'];

/** Envio de avisos para o celular de quem ativou os avisos no app. */
export default function Avisos() {
  const ehAdmin = useEhAdmin();
  const qc = useQueryClient();
  const resumo = useQuery({ queryKey: ['avisos'], queryFn: () => api<Resumo>('/avisos'), enabled: ehAdmin });
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [rota, setRota] = useState<Rota>('/');

  const enviar = useMutation({
    mutationFn: () => api<{ enviados: number; falhas: number }>('/avisos', { method: 'POST', json: { titulo: titulo.trim(), mensagem: mensagem.trim(), rota } }),
    onSuccess: () => {
      setTitulo('');
      setMensagem('');
      qc.invalidateQueries({ queryKey: ['avisos'] });
    },
  });

  if (!ehAdmin) return <Vazio texto="Apenas administradores podem enviar avisos." icone="lock-closed-outline" />;

  async function aoEnviar() {
    const ok = await confirmar('Enviar aviso?', `Vai chegar no celular de ${numero(resumo.data?.dispositivos ?? 0)} pessoa(s). Não dá para desfazer.`, 'Enviar');
    if (ok) enviar.mutate();
  }

  const valido = titulo.trim().length >= 3 && mensagem.trim().length >= 5;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Tela bordas={['bottom']}>
        <Text style={{ color: cores.textoSuave }}>
          O lembrete na véspera e o resultado de cada sorteio já são enviados automaticamente. Use esta tela para avisos especiais.
        </Text>
        {resumo.isLoading ? <Carregando /> : null}
        {resumo.data ? (
          <GradeKpi>
            <Kpi icone="phone-portrait-outline" rotulo="Celulares com avisos" valor={numero(resumo.data.dispositivos)} destaque />
            <Kpi icone="person-outline" rotulo="Desses, com conta" valor={numero(resumo.data.comLogin)} />
          </GradeKpi>
        ) : null}

        <Cartao style={{ gap: espaco.md }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: cores.texto }}>Novo aviso</Text>
          {enviar.data ? <Aviso tipo="sucesso">Enviado para {numero(enviar.data.enviados)} celular(es).</Aviso> : null}
          {enviar.error ? <Aviso>{(enviar.error as Error).message}</Aviso> : null}
          <Campo rotulo={`Título (${titulo.length}/65)`} value={titulo} maxLength={65} onChangeText={setTitulo} placeholder="Ex.: Última semana para concorrer!" />
          <Campo rotulo={`Mensagem (${mensagem.length}/240)`} value={mensagem} maxLength={240} multiline onChangeText={setMensagem}
            style={{ minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }} />
          <Text style={{ fontWeight: '600', color: cores.texto }}>Ao tocar, abre</Text>
          <Chips opcoes={[...ROTAS]} valor={rota} onChange={setRota} />
          <Botao titulo="Enviar aviso" icone="notifications-outline" desabilitado={!valido || !resumo.data?.dispositivos}
            carregando={enviar.isPending} onPress={aoEnviar} />
          <Text style={{ color: cores.textoSuave, fontSize: 12 }}>Máximo de 5 avisos por hora.</Text>
        </Cartao>

        {resumo.data?.enviados.length ? (
          <Cartao style={{ gap: espaco.md }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: cores.texto }}>Últimos enviados</Text>
            {resumo.data.enviados.map((a) => (
              <View key={a.criadoEm} style={{ gap: 2, borderTopWidth: 1, borderTopColor: cores.borda, paddingTop: espaco.sm }}>
                <Text style={{ fontWeight: '700', color: cores.texto }}>{a.resumo}</Text>
                {a.detalhes.mensagem ? <Text style={{ color: cores.texto }}>{a.detalhes.mensagem}</Text> : null}
                <Text style={{ color: cores.textoSuave, fontSize: 12 }}>
                  {dataHora(a.criadoEm)} · {a.adminNome} · {numero(a.detalhes.enviados ?? 0)} recebido(s)
                </Text>
              </View>
            ))}
          </Cartao>
        ) : null}
      </Tela>
    </KeyboardAvoidingView>
  );
}
