import { router } from 'expo-router';
import { ListaIgrejas } from '@/components/ListaIgrejas';
import { Botao, Tela, Titulo } from '@/components/ui';

export default function Igrejas() {
  return (
    <Tela>
      <Titulo sub="Só aparecem igrejas aprovadas pela equipe.">Igrejas participantes</Titulo>
      <ListaIgrejas />
      <Botao titulo="Cadastrar minha igreja" variante="contorno" icone="add-circle-outline"
        onPress={() => router.push('/cadastro-igreja')} />
    </Tela>
  );
}
