# Renovando: app mobile

App em React Native (Expo SDK 57 + Expo Router + TypeScript) da campanha Renovando a Vinha do Senhor.

## Rodar

```bash
npm install
npx expo start          # escaneie o QR com o app Expo Go no celular
npx expo start --web    # ou abra no navegador
```

O app consome a API da pasta `../api` (o admin é um sistema separado, em `../admin`) (veja o README principal). Em desenvolvimento ele usa o IP do computador que roda o Expo, na porta 3333. Em produção, defina `EXPO_PUBLIC_API_URL`.

## Estrutura

```
src/
  app/                 rotas (cada arquivo é uma tela)
    (tabs)/            Início, Prêmios, Igrejas, Meus cupons, Mais
    projeto, palmas-para-jesus, traga-sua-igreja, seja-semeador,
    shows, faq, noticias/   páginas institucionais (mesmo conteúdo do site)
    login.tsx          login sem senha (código pelo WhatsApp)
    ofertar/index.tsx  escolha de modo, quantidade e igreja
    ofertar/[id].tsx   pagamento PIX (QR + copia e cola) e confirmação
    cadastro-igreja.tsx  cadastro em 4 etapas (CNPJ/CEP automáticos)
  api/contrato.ts      tudo que o app consome da API
  api/http.ts          cliente HTTP (descobre o endereço da API)
  components/          UI reutilizável
  store/               sessão (secure-store) e rascunho da oferta (zustand)
  utils/               máscaras, formatação, consultas CEP/CNPJ
```
