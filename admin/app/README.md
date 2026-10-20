# Renovando · App admin (React Native)

App da equipe para administrar a campanha pelo celular. Usa o **servidor do admin** (`../servidor`, porta 4000), separado da API do app dos ofertantes.

## Rodar
```bash
npm install
npx expo start
```
Escaneie o QR Code com o **Expo Go**. O celular precisa estar no mesmo Wi-Fi do computador, e o servidor do admin precisa estar ligado (`npm run admin` na pasta principal). O login é o mesmo do painel web.

## Telas
- **Início:** indicadores, pendências, gráfico de arrecadação (toque na barra para ver o dia), igrejas que mais arrecadaram, divisão e sorteios.
- **Relatórios:** período (7/30/90 dias, tudo ou datas), filtros por campanha, igreja e situação, gráficos, lista de ofertas e repasses por igreja. Exporta CSV pelo menu de compartilhar (WhatsApp, e-mail, Drive).
- **Cadastros:**
  - Campanhas, com a divisão em %.
  - Prêmios, com sorteio pelo sistema ou número da Loteria Federal.
  - Igrejas e semeadores, com Aprovar/Rejeitar.
  - Ofertantes.
  - Notícias, depoimentos e perguntas frequentes.
  - Pedidos de show e artistas.
  - Usuários do admin.
- **Conta:** dados do usuário e sair.

Imagens (notícias, prêmios, artistas) são escolhidas da galeria do celular e enviadas para o servidor.

## Estrutura
```
src/
  app/(abas)/        Início, Relatórios, Cadastros, Conta
  app/[recurso]/     lista e formulário genéricos (igrejas, notícias, prêmios...)
  app/campanhas/     campanhas e divisão das ofertas
  app/sorteio.tsx    sorteio de prêmio
  recursos.tsx       configuração de cada cadastro (campos, filtros, cartões)
  api.ts             conexão com o servidor do admin, envio de imagem e CSV
```
