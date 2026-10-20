# Renovando a Vinha do Senhor: avaliação do site e plano do app mobile

*Levantamento feito em 13/10/2026 em renovandoavinhadosenhor.com (só leitura, nenhum formulário foi enviado).*

---

## 1. O que o sistema atual tem

### 1.1 Tecnologia identificada
- **Frontend:** Next.js (App Router) hospedado na **Vercel** (com Vercel Analytics e Speed Insights).
- **Painel administrativo separado:** `admin.renovandoavinhadosenhor.com`.
- **Mini-sites satélites** também na Vercel: The Voice Renovando Gospel, DiscoveryDet (shows), "Seja um doador".
- **Login sem senha:** cadastro com nome, sobrenome e WhatsApp, depois um **código de acesso enviado pelo WhatsApp** (OTP).

### 1.2 Módulos / funcionalidades

| # | Módulo | O que faz |
|---|--------|-----------|
| 1 | **Campanha / Oferta (home)** | Seletor de valor (múltiplos de R$ 20 = nº de "números da sorte"), botões **Ofertar e Concorrer** e **Ofertar Anonimamente** (doa sem concorrer). |
| 2 | **Premiação** | R$ 135 mil em prêmios, 5 sorteios com datas: iPhone 17 (30/09, 30/10, 30/11/2026), PIX R$ 20.000 (31/12/2026), VW Tera 0 km (05/02/2027). |
| 3 | **Cupons / números da sorte** | Cada R$ 20 = 1 cupom = 1 chance. Números entregues ao ofertante. |
| 4 | **Sorteio ao vivo** | Transmissão do sorteio, divulgação de ganhadores. |
| 5 | **Igrejas participantes** | Lista de igrejas credenciadas (o site mostra "69 igrejas" em um lugar e "500+" em outro). O ofertante vincula a oferta a uma igreja. |
| 6 | **Cadastro de igreja** (`/cadastro/igreja`) | Wizard em 4 etapas: Igreja (CNPJ opcional com consulta automática, razão social, nome fantasia, CEP com busca de endereço) → Financeiro (chave PIX) → Pastor (WhatsApp) → Confirmação. Status **pendente até aprovação**. Aceita `?ref=CODIGO` de semeador. |
| 7 | **Página "Traga sua igreja"** | Explica a divisão: 80% igreja, 5% missões, 5% administração, 10% projetos sociais. **Simulador** (10–100 cupons → retorno da igreja). FAQ. |
| 8 | **Rede de Semeadores** (`/seja-um-semeador`, `/cadastro/semeador`) | Indicadores que cadastram igrejas e ganham **7%** das ofertas pagas das igrejas vinculadas. Cadastro em 3 etapas (dados + CPF + confirmação por WhatsApp → financeiro → confirmação). Links de indicação `?ref=`; **dois níveis (N1 indica N2)**. Simulador de ganhos. |
| 9 | **Split das ofertas** | Distribuição automática por oferta paga (ex.: Igreja 80 / Semeador 7 / Parceiro 5 / Plataforma 8). Repasse via PIX da congregação. |
| 10 | **Fundo social / Palmas para Jesus** | Página institucional do Centro de Convivência Cristã (100.000 m², hotel, praia para batismo, escolas, arena, camping etc.). Botão "Quero apoiar". |
| 11 | **Sobre o projeto** (`/projeto`) | Missão, visão, linha do tempo (2022, 2023/24, 2025), impacto, parceiros, contato, vídeo de apresentação. |
| 12 | **Shows gospel** (`/shows-gospel`) | Catálogo de 47 artistas (DiscoveryDet) com formulário de proposta (nome, WhatsApp, e-mail, igreja, cidade/UF, data, tipo, público, artistas). |
| 13 | **Depoimentos** | Carrossel de testemunhos. |
| 14 | **Novidades / Blog** | Cards de posts (data, tempo de leitura). |
| 15 | **FAQ** | "Para onde vai minha oferta?", "Como recebo os cupons?", "Posso ofertar anonimamente?". |
| 16 | **Legal** | Política de Privacidade e Termos de Uso (jan/2025). |
| 17 | **Contato** | E-mail e WhatsApp. |
| 18 | **Admin** | Aprovação de igrejas e semeadores, campanhas, sorteios, conteúdo (inferido; não acessei). |

### 1.3 Problemas e pontos de atenção encontrados
1. **Números inconsistentes:** "500+ igrejas" e "69 igrejas" na mesma página; a divisão do dinheiro muda de página para página (80/5/5/10 contra 80/7/5/8).
2. **FAQ diz que a plataforma está "em desenvolvimento (matérias ilustrativas)"**, o que tira credibilidade de uma página que recebe dinheiro.
3. **Depoimentos sem nome completo** ("Pr.", "P", "I"), o que enfraquece a prova social.
4. **Links quebrados:** `/igrejas` e `/blog` retornam 404; "Ver todas as igrejas" só leva a uma âncora.
5. **Termos de Uso praticamente vazios** (só a cláusula 1).
6. **Risco regulatório (o mais importante):** oferta com valor fixo que dá direito a sorteio de prêmios funciona, na prática, como **distribuição gratuita de prêmios/sorteio**. Isso exige **autorização da Secretaria de Prêmios e Apostas (Ministério da Fazenda)**, conforme a Lei 5.768/71 e normas posteriores. Também falta o regulamento com nº de certificado de autorização. O modelo de semeadores em **2 níveis com comissão** também merece revisão jurídica.

---

## 2. Plano do app mobile

### 2.1 Objetivo
Um app (Android + iOS) com as mesmas funções do site, mais o que o celular faz melhor: **notificações** (sorteio ao vivo, resultado, aprovação de cadastro), **carteira de cupons** sempre à mão, **PIX copia-e-cola/QR** e **compartilhamento do link de indicação** em 1 toque.

### 2.2 Perfis de usuário
- **Ofertante:** oferta, recebe cupons, acompanha sorteios.
- **Pastor / gestor da igreja:** acompanha arrecadação e repasses da igreja.
- **Semeador:** cadastra igrejas, acompanha rede e comissões.
- **Admin:** fica no painel web, sem necessidade de app.

### 2.3 Stack recomendada
| Camada | Escolha | Por quê |
|---|---|---|
| App | **React Native + Expo (TypeScript)** | O site já é React/Next.js, então dá para reaproveitar tipos, validações (zod) e lógica. Um código para Android e iOS. Atualizações OTA com EAS Update. |
| Navegação | Expo Router | Rotas por arquivo, parecido com o Next.js. |
| Estado / dados | TanStack Query + Zustand | Cache, refetch e estado leve. |
| UI | NativeWind (Tailwind) ou Tamagui | Mantém a identidade visual do site. |
| Backend | **Reaproveitar a API atual** do Next.js/admin; se não houver API pública, criar uma camada REST (Next.js Route Handlers ou NestJS) + PostgreSQL | O app e o site devem usar o mesmo backend. |
| Auth | OTP via **WhatsApp Cloud API** (mesmo fluxo do site) + JWT/refresh token em `expo-secure-store` | Mantém o login sem senha. |
| Pagamentos | Gateway com **PIX + split automático**: Asaas, Pagar.me, Efí (Gerencianet) ou Mercado Pago | O split 80/7/5/8 acontece no gateway, sem passar pelo caixa da plataforma. Webhook confirma o pagamento e gera os cupons. |
| Push | Expo Notifications (FCM/APNs) | Lembretes de sorteio, resultado, aprovação. |
| Vídeo ao vivo | Embed YouTube Live / player HLS | Para os sorteios ao vivo. |
| Conteúdo (blog, depoimentos, prêmios) | CMS headless (Sanity, Strapi) ou o próprio admin | O admin publica e o app e o site mostram. |
| Monitoramento | Sentry + analytics (PostHog/Firebase) | |

### 2.4 Telas do app

**Público (sem login)**
1. Splash / onboarding (3 telas: oferte, concorra, fortaleça sua igreja)
2. **Home da campanha**: banner da edição, contador do próximo sorteio, prêmios, botão Ofertar
3. Prêmios e calendário de sorteios
4. Igrejas participantes (busca por nome/cidade, mapa opcional)
5. Sobre o projeto / Palmas para Jesus / Fundo social
6. Novidades (lista + leitura do post)
7. Depoimentos
8. Shows gospel (catálogo + formulário de proposta)
9. FAQ, Termos, Privacidade, Contato (abre o WhatsApp)

**Ofertante (logado)**
10. Login / cadastro: nome + WhatsApp → código OTP
11. **Fluxo de oferta**: escolher a igreja → valor (+/− R$ 20) → anônimo ou concorrer → aceite do regulamento → **PIX (QR + copia-e-cola)** → aguardando → confirmado
12. **Meus cupons**: números da sorte agrupados por sorteio, com status
13. Histórico de ofertas + comprovante
14. Sorteio ao vivo + resultados ("seu número foi sorteado?")
15. Perfil e notificações

**Pastor / igreja**
16. Cadastro de igreja (wizard em 4 etapas: dados/CNPJ/CEP → PIX → pastor → confirmação)
17. Status da aprovação
18. Painel da igreja: total arrecadado, cupons emitidos, repasses recebidos, link/QR da igreja para divulgar
19. Simulador de retorno

**Semeador**
20. Cadastro (dados + CPF + OTP → financeiro → confirmação)
21. Painel: igrejas vinculadas (pendente/ativa), volume, comissão prevista/paga
22. **Meu link de indicação** (compartilhar no WhatsApp, QR code)
23. Simulador de ganhos

### 2.5 Modelo de dados (resumo)
`Usuario` (nome, whatsapp, cpf?, papel) · `Igreja` (cnpj?, razão social, fantasia, endereço, pix, pastor_id, semeador_id, status) · `Semeador` (usuario_id, codigo_ref, pai_id [N1/N2], pix, status) · `Campanha` (edição, valor_cupom, regras_split, datas) · `Premio` (campanha_id, descrição, data_sorteio, ganhador_cupom_id) · `Oferta` (usuario_id?, igreja_id, valor, anonima, status_pagamento, txid_pix) · `Cupom` (oferta_id, numero, sorteio_id) · `Repasse` (oferta_id, destinatario, %, valor, status) · `Post`, `Depoimento`, `Artista`, `SolicitacaoShow`.

### 2.6 Fluxo crítico: oferta → cupom
```
App → POST /ofertas (igreja, valor, anonima)
API → cria cobrança PIX no gateway com split → devolve QR/copia-e-cola
Usuário paga no app do banco
Gateway → webhook /pagamentos/confirmado
API → marca a oferta como paga → gera N cupons (valor/20) com números únicos → registra repasses
API → push "Pagamento confirmado! Seus números: ..." → app atualiza "Meus cupons"
```
A geração dos números tem de ser **idempotente** (webhook pode chegar duas vezes) e **auditável**: guardar log de quem recebeu qual número e quando.

### 2.7 Lojas de aplicativos (atenção)
- **Apple e Google restringem apps com sorteio pago.** A Apple exige que o desenvolvedor seja o patrocinador, que haja regulamento oficial e que fique claro que a Apple não participa. Sorteio com pagamento para participar exige licença/autorização. O Google Play trata como "real-money gambling/contests" e pede documentação.
- **Recomendação:** ter a **autorização da SPA/Ministério da Fazenda em mãos antes de enviar para as lojas**. Publicar a conta como organização (CNPJ), não pessoa física.
- Como plano B para lançar mais rápido, dá para fazer um **PWA** (o próprio site instalável), que não passa pela revisão das lojas.

### 2.8 Cronograma sugerido (equipe de 1–2 devs)
| Fase | Duração | Entregas |
|---|---|---|
| 0. Jurídico e definição | 1–2 sem (em paralelo) | Regulamento, autorização do sorteio, split definitivo, revisão do modelo de semeadores, Termos completos |
| 1. Fundação | 2 sem | Projeto Expo, design system, navegação, API de auth OTP, CI/EAS |
| 2. Conteúdo público | 2 sem | Home, prêmios, igrejas, sobre, novidades, FAQ, shows |
| 3. Oferta e cupons | 3 sem | Fluxo PIX + split + webhook, Meus cupons, histórico, push |
| 4. Igreja e semeador | 3 sem | Cadastros em etapas, painéis, link de indicação, simuladores |
| 5. Sorteio ao vivo | 1 sem | Player, resultados, notificação de ganhador |
| 6. Testes e lojas | 2 sem | Beta (TestFlight / teste interno), LGPD, envio às lojas |
| **Total** | **~13 semanas** | MVP nas duas lojas |

**MVP mínimo (6–7 semanas):** login OTP, home, prêmios, oferta PIX, meus cupons, push e cadastro de igreja. Semeador, shows e conteúdo institucional entram na v1.1.

### 2.9 LGPD e segurança
- Dados sensíveis (CPF, PIX, WhatsApp) ficam só no backend, criptografados em repouso. No app, só tokens no `secure-store`.
- Consentimento explícito no cadastro, tela "excluir minha conta" (exigida pelas duas lojas) e exportação de dados.
- Rate-limit no envio de OTP e checagem de dispositivo (Play Integrity / App Attest) para evitar fraude nos cupons.

### 2.10 Antes de começar, corrigir no site atual
1. Unificar o número de igrejas e a tabela de divisão.
2. Remover o aviso "em desenvolvimento" do FAQ, ou não receber ofertas enquanto ele existir.
3. Publicar o regulamento completo do sorteio, com o número de autorização.
4. Completar os Termos de Uso.
5. Corrigir os 404 (`/igrejas`, `/blog`) e criar a lista real de igrejas.
