import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { Botao } from '@/components/ui';
import { useSessao } from '@/store/sessao';
import { cores, espaco } from '@/theme';

/** Tempo fora do app (em segundo plano) depois do qual é preciso desbloquear de novo. */
const LIMITE_FORA_MS = 2 * 60_000;

/**
 * Proteção do app admin (tem chaves PIX, CPFs e dados de ofertantes):
 * - pede a digital, o rosto ou a senha do celular ao abrir e ao voltar depois de 2 minutos fora;
 * - cobre a tela enquanto o app está em segundo plano (a lista de apps recentes não mostra os dados).
 * Se o celular não tiver nenhuma trava configurada, não bloqueia (não há como conferir), mas avisa.
 */
export function Bloqueio({ children, pedirAoAbrir }: { children: ReactNode; pedirAoAbrir: boolean }) {
  const sair = useSessao((s) => s.sair);
  const [travaDisponivel, setTravaDisponivel] = useState<boolean | null>(null);
  // Logo depois do login não pede de novo; só ao abrir o app com a sessão já salva.
  const [bloqueado, setBloqueado] = useState(Platform.OS !== 'web' && pedirAoAbrir);
  const [coberto, setCoberto] = useState(false);
  const [erro, setErro] = useState('');
  const saiuEm = useRef<number | null>(null);
  const pedindo = useRef(false);

  const desbloquear = useCallback(async () => {
    if (pedindo.current) return;
    pedindo.current = true;
    setErro('');
    try {
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Desbloquear o Renovando Admin',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar a senha do celular',
      });
      if (r.success) setBloqueado(false);
      else if (r.error !== 'user_cancel' && r.error !== 'system_cancel' && r.error !== 'app_cancel') {
        setErro(r.error === 'lockout' ? 'Muitas tentativas. Use a senha do celular ou tente mais tarde.' : 'Não foi possível confirmar. Tente de novo.');
      }
    } finally {
      pedindo.current = false;
    }
  }, []);

  // O celular tem alguma trava (digital, rosto, PIN ou padrão)?
  useEffect(() => {
    if (Platform.OS === 'web') return;
    LocalAuthentication.getEnrolledLevelAsync()
      .then((nivel) => {
        const tem = nivel !== LocalAuthentication.SecurityLevel.NONE;
        setTravaDisponivel(tem);
        if (!tem) setBloqueado(false);
        else if (pedirAoAbrir) void desbloquear();
      })
      .catch(() => (setTravaDisponivel(false), setBloqueado(false)));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao montar
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') {
        setCoberto(true);
        saiuEm.current ??= Date.now();
        return;
      }
      setCoberto(false);
      const fora = saiuEm.current ? Date.now() - saiuEm.current : 0;
      saiuEm.current = null;
      // O próprio pedido de digital deixa o app "inativo" por um instante: não conta como saída.
      if (travaDisponivel && fora > LIMITE_FORA_MS && !pedindo.current) {
        setBloqueado(true);
        void desbloquear();
      }
    });
    return () => assinatura.remove();
  }, [travaDisponivel, desbloquear]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {bloqueado || coberto ? (
        <View style={[StyleSheet.absoluteFill, st.capa]} accessibilityViewIsModal>
          <Text style={st.titulo}>Renovando Admin</Text>
          {bloqueado && !coberto ? (
            <View style={{ gap: espaco.md, alignSelf: 'stretch' }}>
              <Text style={st.texto}>Confirme que é você para ver os dados.</Text>
              {erro ? <Text style={[st.texto, { color: '#FFD6D6' }]}>{erro}</Text> : null}
              <Botao titulo="Desbloquear" onPress={() => void desbloquear()} />
              <Botao titulo="Sair da conta" variante="texto" corTexto="#fff" onPress={() => void sair()} />
            </View>
          ) : null}
        </View>
      ) : null}
      {travaDisponivel === false && !bloqueado ? (
        <View style={st.aviso} pointerEvents="none">
          <Text style={st.avisoTexto}>Proteja o painel: configure uma senha, digital ou rosto no celular.</Text>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  capa: { backgroundColor: cores.primariaEscura, alignItems: 'center', justifyContent: 'center', padding: espaco.xl, gap: espaco.xl },
  titulo: { color: '#fff', fontSize: 24, fontWeight: '800' },
  texto: { color: '#F1DCE8', fontSize: 15, textAlign: 'center' },
  aviso: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#8A5A00', paddingVertical: 6, paddingHorizontal: espaco.md },
  avisoTexto: { color: '#fff', fontSize: 12, textAlign: 'center' },
});
