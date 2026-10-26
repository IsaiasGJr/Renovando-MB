import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, Modal, Pressable, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { enviarImagem, urlImagem } from '@/api';
import { Chips } from '@/components/admin';
import { Aviso, Campo } from '@/components/ui';
import { cores, espaco, raio } from '@/theme';
import { brParaIso, isoParaBr, mascaraData } from '@/utils/format';

export type CampoDef = {
  nome: string;
  rotulo: string;
  tipo?: 'texto' | 'textarea' | 'numero' | 'checkbox' | 'select' | 'data' | 'datahora' | 'imagem' | 'galeria' | 'senha' | 'email' | 'telefone';
  opcoes?: { valor: string; rotulo: string }[];
  /** Opções vindas da API (ex.: semeadores N1 para ligar um N2). */
  carregarOpcoes?: () => Promise<{ valor: string; rotulo: string }[]>;
  ajuda?: string;
  obrigatorio?: boolean;
  padrao?: unknown;
};

export type Valores = Record<string, unknown>;

export function valoresIniciais(campos: CampoDef[], registro?: Valores): Valores {
  const v: Valores = {};
  for (const c of campos) {
    const atual = registro?.[c.nome];
    if (c.tipo === 'datahora') v[c.nome] = isoParaBr(atual as string, true);
    else if (c.tipo === 'data') v[c.nome] = isoParaBr(atual as string, false);
    else if (c.tipo === 'checkbox') v[c.nome] = atual === undefined ? (c.padrao ?? false) : !!atual;
    else if (c.tipo === 'senha') v[c.nome] = '';
    else if (c.tipo === 'numero') v[c.nome] = atual == null ? String(c.padrao ?? '') : String(atual);
    else if (c.tipo === 'galeria') v[c.nome] = Array.isArray(atual) ? atual : [];
    else v[c.nome] = atual ?? c.padrao ?? (c.tipo === 'select' ? c.opcoes?.[0]?.valor : '');
  }
  return v;
}

/** Converte os valores do formulário para o que a API espera. Lança erro com mensagem amigável. */
export function paraPayload(campos: CampoDef[], v: Valores): Valores {
  const out: Valores = {};
  for (const c of campos) {
    const valor = v[c.nome];
    if (c.obrigatorio && (valor === '' || valor == null)) throw new Error(`Preencha "${c.rotulo}".`);
    if (c.tipo === 'numero') out[c.nome] = valor === '' ? 0 : Number(String(valor).replace(',', '.'));
    else if (c.tipo === 'datahora' || c.tipo === 'data') {
      const iso = valor ? brParaIso(String(valor), c.tipo === 'datahora') : '';
      if (valor && !iso) throw new Error(`"${c.rotulo}" está inválida. Use ${c.tipo === 'datahora' ? 'dd/mm/aaaa hh:mm' : 'dd/mm/aaaa'}.`);
      out[c.nome] = iso || null;
    } else if (c.tipo === 'senha') {
      if (valor) out[c.nome] = valor;
    } else out[c.nome] = typeof valor === 'string' ? valor.trim() : valor;
  }
  return out;
}

/** Várias fotos (ex.: galeria do artista): adiciona da galeria do celular e remove tocando no X. */
function CampoGaleria({ rotulo, ajuda, valor, onChange }: { rotulo: string; ajuda?: string; valor: string[]; onChange: (v: string[]) => void }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function adicionar() {
    setErro('');
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true, selectionLimit: 20 - valor.length });
    if (r.canceled) return;
    setEnviando(true);
    try {
      const novas: string[] = [];
      for (const a of r.assets.slice(0, 20 - valor.length)) novas.push(await enviarImagem({ uri: a.uri, nome: a.fileName, tipo: a.mimeType, largura: a.width, altura: a.height }));
      onChange([...valor, ...novas]);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={{ gap: espaco.xs }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: cores.texto }}>{rotulo}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm }}>
        {valor.map((url) => (
          <View key={url}>
            <Image source={urlImagem(url)} style={{ width: 86, height: 66, borderRadius: raio.sm, backgroundColor: '#EEE8EC' }} contentFit="cover" cachePolicy="memory-disk" recyclingKey={url} />
            <Pressable onPress={() => onChange(valor.filter((u) => u !== url))} accessibilityLabel="Remover foto" hitSlop={8}
              style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#fff', borderRadius: 12 }}>
              <Ionicons name="close-circle" size={22} color={cores.erro} />
            </Pressable>
          </View>
        ))}
        {valor.length < 20 ? (
          <Pressable onPress={adicionar} disabled={enviando} accessibilityRole="button"
            style={{ width: 86, height: 66, borderRadius: raio.sm, borderWidth: 1.5, borderStyle: 'dashed', borderColor: cores.primariaSuave, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={enviando ? 'hourglass-outline' : 'add'} size={24} color={cores.primaria} />
          </Pressable>
        ) : null}
      </View>
      {ajuda ? <Text style={{ color: cores.textoSuave, fontSize: 13 }}>{ajuda}</Text> : null}
      {erro ? <Aviso>{erro}</Aviso> : null}
    </View>
  );
}

export function CampoImagem({ rotulo, valor, onChange, finalidade }: { rotulo: string; valor: string; onChange: (u: string) => void; finalidade?: 'cupom' | 'panfleto' }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function escolher() {
    setErro('');
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (r.canceled) return;
    const a = r.assets[0];
    setEnviando(true);
    try {
      onChange(await enviarImagem({ uri: a.uri, nome: a.fileName, tipo: a.mimeType, largura: a.width, altura: a.height }, finalidade));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={{ gap: espaco.xs }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: cores.texto }}>{rotulo}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md }}>
        <View style={{ width: 88, height: 66, borderRadius: raio.sm, backgroundColor: '#EEE8EC', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          {valor ? <Image source={urlImagem(valor)} style={{ width: 88, height: 66 }} contentFit="cover" cachePolicy="memory-disk" recyclingKey={valor} /> : <Ionicons name="image-outline" size={26} color={cores.textoSuave} />}
        </View>
        <View style={{ flex: 1, gap: espaco.xs }}>
          <Pressable onPress={escolher} disabled={enviando}
            style={{ borderWidth: 1, borderColor: cores.borda, borderRadius: raio.sm, paddingVertical: 10, alignItems: 'center', backgroundColor: cores.superficie }}>
            <Text style={{ color: cores.primaria, fontWeight: '600' }}>{enviando ? 'Enviando…' : valor ? 'Trocar imagem' : 'Escolher imagem'}</Text>
          </Pressable>
          {valor ? (
            <Pressable onPress={() => onChange('')} style={{ alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{ color: cores.erro, fontSize: 13 }}>Remover</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {erro ? <Aviso>{erro}</Aviso> : null}
    </View>
  );
}

/** Seletor para listas longas (ex.: UF): mostra o valor atual e abre a lista completa. */
export function SeletorLista({ rotulo, opcoes, valor, onChange }: {
  rotulo: string; opcoes: { valor: string; rotulo: string }[]; valor: string; onChange: (v: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const atual = opcoes.find((o) => o.valor === valor);
  return (
    <View style={{ gap: espaco.xs }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: cores.texto }}>{rotulo}</Text>
      <Pressable onPress={() => setAberto(true)} accessibilityRole="button" accessibilityLabel={`${rotulo}: ${atual?.rotulo ?? 'escolher'}`}
        style={{ minHeight: 48, borderWidth: 1, borderColor: cores.borda, borderRadius: raio.sm, paddingHorizontal: espaco.md,
          backgroundColor: cores.superficie, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 16, color: atual ? cores.texto : cores.textoSuave }}>{atual?.rotulo ?? 'Escolher'}</Text>
        <Ionicons name="chevron-down" size={18} color={cores.textoSuave} />
      </Pressable>
      <Modal visible={aberto} animationType="slide" onRequestClose={() => setAberto(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: cores.fundo }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: espaco.lg }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: cores.texto }}>{rotulo}</Text>
            <Pressable onPress={() => setAberto(false)} hitSlop={10} accessibilityLabel="Fechar">
              <Ionicons name="close" size={26} color={cores.texto} />
            </Pressable>
          </View>
          <FlatList
            data={opcoes}
            keyExtractor={(o) => o.valor}
            renderItem={({ item: o }) => (
              <Pressable onPress={() => (onChange(o.valor), setAberto(false))}
                style={{ paddingHorizontal: espaco.lg, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between',
                  backgroundColor: o.valor === valor ? cores.primariaClara : 'transparent' }}>
                <Text style={{ fontSize: 16, color: cores.texto }}>{o.rotulo}</Text>
                {o.valor === valor ? <Ionicons name="checkmark" size={20} color={cores.primaria} /> : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

export function Formulario({ campos, valores, onChange }: { campos: CampoDef[]; valores: Valores; onChange: (v: Valores) => void }) {
  const set = (nome: string, valor: unknown) => onChange({ ...valores, [nome]: valor });

  return (
    <View style={{ gap: espaco.lg }}>
      {campos.map((c) => {
        const rotulo = `${c.rotulo}${c.obrigatorio ? ' *' : ''}`;
        const valor = valores[c.nome];

        if (c.tipo === 'checkbox') {
          return (
            <View key={c.nome} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco.md }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: cores.texto, fontWeight: '600' }}>{c.rotulo}</Text>
                {c.ajuda ? <Text style={{ color: cores.textoSuave, fontSize: 13 }}>{c.ajuda}</Text> : null}
              </View>
              <Switch value={!!valor} onValueChange={(b) => set(c.nome, b)} trackColor={{ true: cores.primaria, false: cores.borda }} />
            </View>
          );
        }
        if (c.tipo === 'select' && c.carregarOpcoes) {
          return <SelectDaApi key={c.nome} rotulo={rotulo} carregar={c.carregarOpcoes} valor={String(valor ?? '')} onChange={(v) => set(c.nome, v)} ajuda={c.ajuda} />;
        }
        if (c.tipo === 'select' && (c.opcoes?.length ?? 0) > 6) {
          return <SeletorLista key={c.nome} rotulo={rotulo} opcoes={c.opcoes ?? []} valor={String(valor ?? '')} onChange={(v) => set(c.nome, v)} />;
        }
        if (c.tipo === 'select') {
          return (
            <View key={c.nome} style={{ gap: espaco.xs }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: cores.texto }}>{rotulo}</Text>
              <Chips opcoes={c.opcoes ?? []} valor={String(valor ?? '')} onChange={(v) => set(c.nome, v)} />
              {c.ajuda ? <Text style={{ color: cores.textoSuave, fontSize: 13 }}>{c.ajuda}</Text> : null}
            </View>
          );
        }
        if (c.tipo === 'galeria') {
          return <CampoGaleria key={c.nome} rotulo={c.rotulo} ajuda={c.ajuda} valor={(valor as string[]) ?? []} onChange={(v) => set(c.nome, v)} />;
        }
        if (c.tipo === 'imagem') {
          return <CampoImagem key={c.nome} rotulo={c.rotulo} valor={String(valor ?? '')} onChange={(u) => set(c.nome, u)} />;
        }
        const ehData = c.tipo === 'data' || c.tipo === 'datahora';
        return (
          <Campo
            key={c.nome}
            rotulo={rotulo}
            ajuda={c.ajuda ?? (c.tipo === 'datahora' ? 'Formato dd/mm/aaaa hh:mm' : c.tipo === 'data' ? 'Formato dd/mm/aaaa' : undefined)}
            value={String(valor ?? '')}
            onChangeText={(t) => set(c.nome, ehData ? mascaraData(t, c.tipo === 'datahora') : t)}
            placeholder={c.tipo === 'datahora' ? 'dd/mm/aaaa hh:mm' : c.tipo === 'data' ? 'dd/mm/aaaa' : undefined}
            multiline={c.tipo === 'textarea'}
            secureTextEntry={c.tipo === 'senha'}
            autoCapitalize={c.tipo === 'email' || c.tipo === 'senha' ? 'none' : 'sentences'}
            keyboardType={
              c.tipo === 'numero' ? 'decimal-pad' : ehData ? 'number-pad' : c.tipo === 'email' ? 'email-address' : c.tipo === 'telefone' ? 'phone-pad' : 'default'
            }
            style={c.tipo === 'textarea' ? { minHeight: 140, textAlignVertical: 'top', paddingTop: 12 } : undefined}
          />
        );
      })}
    </View>
  );
}

/** Lista de opções carregada da API (ex.: semeadores N1). */
function SelectDaApi({ rotulo, carregar, valor, onChange, ajuda }: {
  rotulo: string; carregar: () => Promise<{ valor: string; rotulo: string }[]>; valor: string; onChange: (v: string) => void; ajuda?: string;
}) {
  const q = useQuery({ queryKey: ['opcoes', rotulo], queryFn: carregar });
  return (
    <View style={{ gap: espaco.xs }}>
      <SeletorLista rotulo={rotulo} opcoes={q.data ?? []} valor={valor} onChange={onChange} />
      {ajuda ? <Text style={{ color: cores.textoSuave, fontSize: 13 }}>{ajuda}</Text> : null}
    </View>
  );
}
