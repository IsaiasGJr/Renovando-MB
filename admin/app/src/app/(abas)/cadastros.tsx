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

      <Grupo titulo="Rede">
        {item('igrejas', p?.igrejas)}
        {item('semeadores', p?.semeadores)}
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

      {ehAdmin ? (
        <Grupo titulo="Sistema">
          {item('admins')}
          {item('paginas')}
          <ItemMenu icone="list-outline" texto="Registro de atividades" onPress={() => router.push('/auditoria')} />
        </Grupo>
      ) : null}
    </Tela>
  );
}
