import { router, type Href } from 'expo-router';
import { Text, View } from 'react-native';
import { ItemMenu } from '@/components/admin';
import { Cartao, Tela } from '@/components/ui';
import { RECURSOS } from '@/recursos';
import { useEhAdmin } from '@/store/sessao';
import { cores, espaco } from '@/theme';
import { useDashboard } from '@/tipos';

const abrir = (recurso: string) => router.push({ pathname: '/[recurso]', params: { recurso } });

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: espaco.xs }}>
      <Text style={{ color: cores.textoSuave, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>{titulo}</Text>
      <Cartao style={{ paddingVertical: 2, gap: 0 }}>{children}</Cartao>
    </View>
  );
}

export default function Cadastros() {
  const ehAdmin = useEhAdmin();
  const p = useDashboard().data?.pendencias;
  const item = (recurso: string, contador?: number) => {
    const r = RECURSOS[recurso];
    if (r.soAdmin && !ehAdmin) return null;
    return <ItemMenu key={recurso} icone={r.icone} texto={r.titulo} contador={contador} onPress={() => abrir(recurso)} />;
  };

  return (
    <Tela>
      <Text style={{ fontSize: 24, fontWeight: '800', color: cores.texto }}>Cadastros</Text>

      <Grupo titulo="Campanha">
        {ehAdmin ? <ItemMenu icone="flag-outline" texto="Campanhas" onPress={() => router.push('/campanhas' as Href)} /> : null}
        {item('premios')}
      </Grupo>

      {ehAdmin ? (
        <Grupo titulo="Financeiro">
          <ItemMenu icone="wallet-outline" texto="Repasses" onPress={() => router.push('/repasses' as Href)} />
          <ItemMenu icone="add-circle-outline" texto="Registrar oferta recebida fora do app" onPress={() => router.push('/registrar-oferta' as Href)} />
        </Grupo>
      ) : null}

      <Grupo titulo="Rede">
        <ItemMenu icone="checkmark-done-outline" texto="Aprovações" contador={(p?.igrejas ?? 0) + (p?.semeadores ?? 0)} onPress={() => router.push('/aprovacoes' as Href)} />
        {item('igrejas')}
        {item('semeadores')}
        <ItemMenu icone="person-outline" texto="Ofertantes" onPress={() => router.push('/ofertantes')} />
      </Grupo>

      <Grupo titulo="Conteúdo do app">
        {item('banners')}
        {item('noticias')}
        {item('depoimentos')}
        {item('faqs')}
        {item('parceiros')}
        {item('galeria')}
        {item('mensagens', p?.mensagens)}
      </Grupo>

      <Grupo titulo="Shows gospel">
        {item('solicitacoes-show', p?.shows)}
        {item('artistas')}
      </Grupo>

      <Grupo titulo="Ajuda">
        <ItemMenu icone="help-buoy-outline" texto="Central de ajuda" onPress={() => router.push('/ajuda' as Href)} />
      </Grupo>

      {ehAdmin ? (
        <Grupo titulo="Sistema">
          <ItemMenu icone="notifications-outline" texto="Avisos no celular" onPress={() => router.push('/avisos')} />
          {item('admins')}
          {item('paginas')}
          <ItemMenu icone="list-outline" texto="Registro de atividades" onPress={() => router.push('/auditoria')} />
        </Grupo>
      ) : null}
    </Tela>
  );
}
