import { voltar } from '@/utils/navegacao';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { api } from '@/api';
import { Aviso, Botao, Campo, Cartao, Tela, Titulo } from '@/components/ui';
import type { NovaIgreja } from '@/types';
import { cores, espaco, raio } from '@/theme';
import { buscarCep, buscarCnpj } from '@/utils/consultas';
import { mascaraCep, mascaraCnpj, mascaraTelefone, soDigitos } from '@/utils/format';

const ETAPAS = ['Igreja', 'Financeiro', 'Pastor', 'Confirmação'] as const;
const TIPOS_PIX: { valor: NovaIgreja['tipoChavePix']; rotulo: string }[] = [
  { valor: 'cnpj', rotulo: 'CNPJ' },
  { valor: 'cpf', rotulo: 'CPF' },
  { valor: 'email', rotulo: 'E-mail' },
  { valor: 'telefone', rotulo: 'Telefone' },
  { valor: 'aleatoria', rotulo: 'Aleatória' },
];

const VAZIO: NovaIgreja = {
  cnpj: '', razaoSocial: '', nomeFantasia: '', cep: '', endereco: '', cidade: '', uf: '',
  tipoChavePix: 'cnpj', chavePix: '', pastorNome: '', pastorWhatsapp: '', codigoSemeador: '',
};

export default function CadastroIgreja() {
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const [etapa, setEtapa] = useState(0);
  // Link de indicação do semeador (renovando://cadastro-igreja?ref=CODIGO) já preenche o código.
  const [f, setF] = useState<NovaIgreja>({ ...VAZIO, codigoSemeador: (ref ?? '').toUpperCase() });
  const [consultando, setConsultando] = useState<'cep' | 'cnpj' | null>(null);
  const [erroConsulta, setErroConsulta] = useState('');
  const set = (p: Partial<NovaIgreja>) => setF((v) => ({ ...v, ...p }));

  const enviar = useMutation({ mutationFn: () => api.cadastrarIgreja(f) });

  async function consultar(tipo: 'cep' | 'cnpj') {
    setErroConsulta('');
    setConsultando(tipo);
    try {
      if (tipo === 'cep') set(await buscarCep(f.cep));
      else {
        const d = await buscarCnpj(f.cnpj ?? '');
        set({ ...d, cep: mascaraCep(d.cep) });
      }
    } catch (e) {
      setErroConsulta((e as Error).message);
    } finally {
      setConsultando(null);
    }
  }

  const valido = [
    f.razaoSocial.trim() && f.nomeFantasia.trim() && f.cidade.trim() && f.uf.trim().length === 2,
    f.chavePix.trim().length >= 5,
    f.pastorNome.trim().length >= 3 && soDigitos(f.pastorWhatsapp).length === 11,
    true,
  ][etapa];

  if (enviar.data) {
    return (
      <Tela bordas={['bottom']}>
        <View style={{ alignItems: 'center', gap: espaco.md, paddingTop: espaco.xl }}>
          <Ionicons name="hourglass-outline" size={64} color={cores.primaria} />
          <Titulo>Cadastro enviado!</Titulo>
          <Text style={{ textAlign: 'center', color: cores.textoSuave, fontSize: 15 }}>
            Protocolo {enviar.data.protocolo}. A igreja fica pendente até a equipe aprovar. O retorno chega no WhatsApp
            do pastor.
          </Text>
        </View>
        <Botao titulo="Concluir" onPress={voltar} />
      </Tela>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Tela
        bordas={['bottom']}
        rodape={
          <View style={{ flexDirection: 'row', gap: espaco.sm }}>
            {etapa > 0 ? (
              <Botao titulo="Voltar" variante="contorno" style={{ flex: 1 }} onPress={() => setEtapa(etapa - 1)} />
            ) : null}
            <Botao
              titulo={etapa === ETAPAS.length - 1 ? 'Enviar cadastro' : 'Continuar'}
              style={{ flex: 2 }}
              desabilitado={!valido}
              carregando={enviar.isPending}
              onPress={() => (etapa === ETAPAS.length - 1 ? enviar.mutate() : setEtapa(etapa + 1))}
            />
          </View>
        }
      >
        {/* Indicador de etapas */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {ETAPAS.map((e, i) => (
            <View key={e} style={{ flex: 1, gap: 4 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= etapa ? cores.primaria : cores.borda }} />
              <Text style={{ fontSize: 11, color: i === etapa ? cores.primaria : cores.textoSuave }}>{e}</Text>
            </View>
          ))}
        </View>

        {etapa === 0 ? (
          <>
            <Titulo sub="O CNPJ é opcional, mas preenche os dados automaticamente.">Dados da igreja</Titulo>
            <View style={{ flexDirection: 'row', gap: espaco.sm, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Campo rotulo="CNPJ (opcional)" value={f.cnpj} keyboardType="number-pad" placeholder="00.000.000/0000-00"
                  onChangeText={(t) => set({ cnpj: mascaraCnpj(t) })} />
              </View>
              <Botao titulo="Consultar" variante="secundario" carregando={consultando === 'cnpj'}
                desabilitado={soDigitos(f.cnpj ?? '').length !== 14} onPress={() => consultar('cnpj')} />
            </View>
            <Campo rotulo="Razão social *" value={f.razaoSocial} onChangeText={(t) => set({ razaoSocial: t })} />
            <Campo rotulo="Nome fantasia *" value={f.nomeFantasia} onChangeText={(t) => set({ nomeFantasia: t })}
              ajuda="É o nome que aparece para os ofertantes." />
            <View style={{ flexDirection: 'row', gap: espaco.sm, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Campo rotulo="CEP" value={f.cep} keyboardType="number-pad" placeholder="00000-000"
                  onChangeText={(t) => set({ cep: mascaraCep(t) })} />
              </View>
              <Botao titulo="Buscar" variante="secundario" carregando={consultando === 'cep'}
                desabilitado={soDigitos(f.cep).length !== 8} onPress={() => consultar('cep')} />
            </View>
            {erroConsulta ? <Aviso>{erroConsulta}</Aviso> : null}
            <Campo rotulo="Endereço" value={f.endereco} onChangeText={(t) => set({ endereco: t })} />
            <View style={{ flexDirection: 'row', gap: espaco.sm }}>
              <View style={{ flex: 3 }}>
                <Campo rotulo="Cidade *" value={f.cidade} onChangeText={(t) => set({ cidade: t })} />
              </View>
              <View style={{ flex: 1 }}>
                <Campo rotulo="UF *" value={f.uf} maxLength={2} autoCapitalize="characters"
                  onChangeText={(t) => set({ uf: t.toUpperCase() })} />
              </View>
            </View>
          </>
        ) : null}

        {etapa === 1 ? (
          <>
            <Titulo sub="A parte da igreja em cada oferta paga cai direto nesta chave.">PIX da congregação</Titulo>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm }}>
              {TIPOS_PIX.map((t) => {
                const ativo = f.tipoChavePix === t.valor;
                return (
                  <Pressable key={t.valor} onPress={() => set({ tipoChavePix: t.valor })}
                    style={{
                      paddingHorizontal: espaco.lg, paddingVertical: espaco.sm, borderRadius: raio.pill,
                      borderWidth: 1, borderColor: ativo ? cores.primaria : cores.borda,
                      backgroundColor: ativo ? cores.primariaClara : cores.superficie,
                    }}>
                    <Text style={{ color: ativo ? cores.primaria : cores.texto, fontWeight: '600' }}>{t.rotulo}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Campo rotulo="Chave PIX *" value={f.chavePix} autoCapitalize="none"
              keyboardType={f.tipoChavePix === 'email' ? 'email-address' : f.tipoChavePix === 'aleatoria' ? 'default' : 'number-pad'}
              onChangeText={(t) => set({ chavePix: t })} />
            <Aviso>Use uma chave em nome da igreja. Chaves de pessoa física podem atrasar a aprovação.</Aviso>
          </>
        ) : null}

        {etapa === 2 ? (
          <>
            <Titulo sub="O status da aprovação é enviado para este WhatsApp.">Pastor responsável</Titulo>
            <Campo rotulo="Nome completo *" value={f.pastorNome} onChangeText={(t) => set({ pastorNome: t })} />
            <Campo rotulo="WhatsApp do pastor *" value={f.pastorWhatsapp} keyboardType="phone-pad" placeholder="(99) 99999-9999"
              onChangeText={(t) => set({ pastorWhatsapp: mascaraTelefone(t) })} />
            <Campo rotulo="Código do semeador (opcional)" value={f.codigoSemeador} autoCapitalize="characters"
              ajuda="Se alguém te convidou, informe o código dessa pessoa."
              onChangeText={(t) => set({ codigoSemeador: t.toUpperCase() })} />
          </>
        ) : null}

        {etapa === 3 ? (
          <>
            <Titulo sub="Confira antes de enviar.">Confirmação</Titulo>
            <Cartao>
              {[
                ['Igreja', f.nomeFantasia],
                ['Razão social', f.razaoSocial],
                ['CNPJ', f.cnpj || '—'],
                ['Cidade', `${f.cidade}/${f.uf}`],
                ['Chave PIX', `${TIPOS_PIX.find((t) => t.valor === f.tipoChavePix)?.rotulo}: ${f.chavePix}`],
                ['Pastor', f.pastorNome],
                ['WhatsApp', f.pastorWhatsapp],
                ['Semeador', f.codigoSemeador || '—'],
              ].map(([k, v]) => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espaco.md }}>
                  <Text style={{ color: cores.textoSuave }}>{k}</Text>
                  <Text style={{ color: cores.texto, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{v}</Text>
                </View>
              ))}
            </Cartao>
            {enviar.error ? <Aviso>{(enviar.error as Error).message}</Aviso> : null}
          </>
        ) : null}
      </Tela>
    </KeyboardAvoidingView>
  );
}
