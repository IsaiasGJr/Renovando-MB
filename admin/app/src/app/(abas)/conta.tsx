import { router } from 'expo-router';
import { Alert, Platform, Text } from 'react-native';
import { BASE_URL } from '@/api';
import { Info } from '@/components/admin';
import { Botao, Cartao, Tela } from '@/components/ui';
import { useSessao } from '@/store/sessao';
import { cores } from '@/theme';

export default function Conta() {
  const { admin, sair } = useSessao();

  function confirmarSaida() {
    if (Platform.OS === 'web') {
      if (confirm('Sair do admin?')) sair();
      return;
    }
    Alert.alert('Sair do admin?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: sair },
    ]);
  }

  return (
    <Tela>
      <Text style={{ fontSize: 24, fontWeight: '800', color: cores.texto }}>Conta</Text>
      <Cartao>
        <Text style={{ fontSize: 18, fontWeight: '700', color: cores.texto }}>{admin?.nome}</Text>
        <Info rotulo="E-mail">{admin?.email ?? ''}</Info>
        <Info rotulo="Papel">{admin?.papel === 'admin' ? 'Administrador' : 'Editor'}</Info>
        <Info rotulo="Servidor">{BASE_URL}</Info>
      </Cartao>
      {admin?.papel === 'admin' ? (
        <Botao titulo="Trocar senha / gerenciar usuários" variante="contorno" icone="key-outline"
          onPress={() => router.push({ pathname: '/[recurso]', params: { recurso: 'admins' } })} />
      ) : null}
      <Botao titulo="Sair" variante="contorno" icone="log-out-outline" onPress={confirmarSaida} />
    </Tela>
  );
}
