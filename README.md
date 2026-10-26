# Renovando a Vinha do Senhor

Mesma divisão do site: o público (app) e o **administrativo** são sistemas separados, como
`renovandoavinhadosenhor.com` e `admin.renovandoavinhadosenhor.com`.

```
renovando_a_vinha_MB/
├── api/               API do app: só rotas públicas · porta 3333
├── admin/             SISTEMA ADMINISTRATIVO (separado)
│   ├── servidor/      servidor do admin: login, segredo e .env próprios · porta 4000
│   ├── app/           APP ADMIN em React Native (Expo) para a equipe, no celular
│   └── painel/        painel admin na web (em produção, entregue pelo servidor do admin)
├── compartilhado/     banco de dados e regras de negócio usados pelos dois servidores
├── dados/             banco SQLite (renovando.db) e imagens enviadas (uploads/)
└── renovando-app/     app mobile (Expo / React Native)
```

**O que é separado:**
- Cada servidor tem processo, porta, `.env` e segredo de login próprios.
- Um login do app não abre o admin, e um login do admin não serve no app.
- A API do app não tem nenhuma rota administrativa.
- Em produção o admin roda em outro endereço, por exemplo `admin.seudominio.com`, apontando para o servidor do admin.

**O que é compartilhado:**
- O banco de dados (`dados/`). É o que faz o que o admin cadastra aparecer no app.

## Como rodar (desenvolvimento)

Na primeira vez, na pasta principal:
```bash
npm install
```
E dentro de `renovando-app`:
```bash
npm install
```

E dentro de `admin/app`:
```bash
npm install
```

Depois, na pasta principal, abra um terminal para cada parte:

| Terminal | Comando | Endereço |
|---|---|---|
| 1. API do app | `npm run api` | http://localhost:3333/api |
| 2. Admin (servidor + painel web) | `npm run admin` | http://localhost:5173 |
| 3. App dos ofertantes | `npm run app` | QR Code para o Expo Go |
| 4. App admin (React Native) | `npm run admin:app` | QR Code para o Expo Go |

O app admin precisa do servidor do admin ligado (terminal 2). Ele encontra o servidor sozinho pelo IP do computador, na porta 4000. Em produção, defina `EXPO_PUBLIC_ADMIN_URL` (ex.: `https://admin.seudominio.com`).

- Na primeira execução o banco é criado com dados de exemplo (campanha 2026, prêmios, igrejas, notícias e ofertas fictícias para os gráficos).
- O e-mail e a senha do primeiro administrador ficam em `admin/servidor/.env` (`ADMIN_EMAIL` / `ADMIN_SENHA`).
- No app, em desenvolvimento, o código de login é sempre **123456** e o PIX tem o botão "Simular pagamento". O celular precisa estar no mesmo Wi-Fi do computador.

### Catálogo de shows gospel

Os 47 artistas do site (nome, biografia, capa e galeria) já foram importados. Para atualizar o catálogo com o site:
```bash
npm run importar-artistas
```
Pode rodar de novo quando quiser: atualiza nomes e biografias e só baixa as fotos que faltam. Depois disso, tudo se edita pelo admin.

### Igrejas credenciadas

As 75 igrejas do site (nome, razão social, cidade, endereço, logo e chave PIX) já foram cadastradas; as 6 igrejas de exemplo da instalação ficaram ocultas no app (os dados delas continuam nos relatórios). Para atualizar com o site:
```bash
npm run importar-igrejas
```
Só lê a lista pública do site, nunca envia nada. Não duplica: atualiza nome, cidade, endereço e logo das que já existem, sem mexer em situação, pastor, semeador ou ofertas.

### Otimizar imagens já cadastradas

```bash
npm run otimizar-imagens
```
Deixa as imagens antigas no mesmo padrão dos envios novos (WEBP, até 1600 px, logos até 512 px, sem metadados). Antes de trocar qualquer arquivo, guarda os originais **e uma cópia do banco** em `dados/uploads-originais/<data>/`. Arquivos que nada usa vão para a subpasta `sem-uso` (não são apagados). Pode rodar de novo: o que já está otimizado é pulado.

### Cupom no formato do site

Em **Meus cupons** o app mostra o mesmo que o site: resumo (total, premiados, último cupom), filtro por oferta e, em cada cupom, campanha, igreja, emissão, número (`#123456`), situação (Ativo/Expirado) e selo Premiado. **Baixar cupom** gera o bilhete da campanha com o número, a igreja, o nome e a data (a arte de cada campanha é trocada em Campanhas → Arte do cupom; sem arte, sai um bilhete com as cores da marca). Só o dono do cupom consegue baixar.

### Se o app não abrir no celular

1. **A API está ligada?** Sem o terminal do `npm run api` aberto, o app não carrega nada. Teste no computador: http://localhost:3333/api/saude
2. **Feche o Expo antigo** (Ctrl+C no terminal dele) e abra de novo com `npm run app`. O comando já limpa o cache e coloca no QR Code o IP do Wi-Fi (este computador tem placas virtuais do VirtualBox e do WSL, e o Expo às vezes escolhia uma delas, que o celular não alcança).
3. Celular e computador **no mesmo Wi-Fi**. Se o Windows perguntar sobre o firewall do Node.js, permita.
4. Avisos no celular (notificações) **não funcionam no Expo Go**: aparecem só no app gerado pelo EAS. No Expo Go o resto funciona normalmente.

## Admin em modo produção (um único servidor)

```bash
npm run admin:producao
```
Gera as telas do painel e sobe o servidor do admin em http://localhost:4000, entregando painel e API juntos. É assim que ele vai para `admin.seudominio.com`.

## O que o painel admin faz

- **Visão geral:** arrecadação, cupons, ticket médio, conversão do PIX, gráfico dos últimos 30 dias, igrejas que mais arrecadaram, divisão do dinheiro e pendências.
- **Relatórios:** filtros por campanha, igreja, situação e período; gráficos; lista paginada; **exportação CSV**; repasse que cada igreja tem a receber.
- **Ofertantes:** quem oferta, quantos cupons e quanto ofertou.
- **Campanhas:** valor do cupom, divisão (%) e qual campanha aparece no app.
- **Prêmios e sorteios:** prêmios com imagem e data; sorteio pelo sistema ou pelo número da Loteria Federal.
- **Igrejas e semeadores:** aprovar ou rejeitar cadastros feitos pelo app.
- **Conteúdo do app:** notícias, depoimentos, perguntas frequentes, artistas e pedidos de show.
- **Usuários do painel:** *Administrador* (tudo) e *Editor* (sem campanhas, sorteios e usuários).
- **Banners do topo**, **Parcerias**, **Galeria do Palmas para Jesus**, **Páginas legais** (Privacidade e Termos) e **Mensagens** do "Fale conosco" (com anexos que só o admin baixa).
- **Igrejas** com logo, mensagem e endereço da página (`/igreja/<endereco>`); **artistas** com biografia e galeria de fotos.

## O que o app dos ofertantes tem

- Início com banners, campanha, prêmios, "Por que participar?", igrejas participantes (com logo), como funciona, depoimentos, novidades e perguntas frequentes.
- **Página de cada igreja** na campanha: a igreja divulga o link `SEU-DOMINIO-DA-API/igreja/<endereco>` (abre o app direto nela) e a oferta já vai com a igreja escolhida.
- **Meu painel**: quem entra com o WhatsApp de pastor vê a arrecadação e o repasse da igreja; quem é semeador vê o código, as igrejas indicadas e a comissão, e envia o link de convite `SEU-DOMINIO-DA-API/indicacao/<codigo>`.
- Shows gospel com **página de cada artista**, Fale conosco com anexos, Palmas para Jesus com galeria, Política de Privacidade e Termos de Uso.

## Segurança

| Proteção | Onde |
|---|---|
| Admin separado (servidor, segredo e login próprios) | `admin/servidor` |
| Senhas com bcrypt; bloqueio após muitas tentativas de login | servidor do admin |
| Trocar senha, desativar ou mudar o papel de alguém **derruba todas as sessões abertas** dessa pessoa | servidor do admin |
| Ofertante: login vale 30 dias e pode **sair de todos os aparelhos** (Mais) | app + API |
| **Exportar planilha fica registrado** (quem, quando, filtros) | auditoria |
| **Só administradores** definem/alteram chave PIX de igrejas e semeadores | servidor do admin |
| **Registro de atividades**: quem criou, editou, excluiu, sorteou ou entrou (com antes → depois e IP) | menu Sistema (web e app) |
| Imagens: só PNG/JPG/WEBP/GIF verdadeiros (conteúdo conferido), servidas sem poder executar nada | `compartilhado/src/seguranca.ts` |
| Fotos enviadas pelo admin perdem os metadados (EXIF: local do GPS, modelo do celular) | servidor do admin |
| Limites contra abuso (gravados no banco, não zeram ao reiniciar): código de login (3 por número / 15 min), cadastros públicos (5 por hora por IP), ofertas, login do admin | os dois servidores |
| CSV protegido contra fórmulas maliciosas no Excel | relatórios |
| **CPF, WhatsApp, chave PIX e e-mail criptografados no banco** (AES-256-GCM), com exclusão segura (dados apagados são sobrescritos). O login acha a conta por um índice irreversível (HMAC), sem guardar o número aberto. O admin vê os dados normalmente; a auditoria nunca guarda esses valores | `compartilhado/src/cripto.ts` |
| Cabeçalhos de segurança (CSP no painel, nosniff, anti-iframe, HSTS em produção) | os dois servidores |
| **Exclusão de conta** pelo próprio ofertante (Mais → Excluir minha conta): apaga nome, sobrenome e WhatsApp; ofertas pagas ficam sem identificação; cupons saem dos sorteios futuros | app + API (`DELETE /api/me`) |
| **Página web de exclusão** (sem o app): WhatsApp → código → digitar EXCLUIR. Nunca cria conta e responde igual exista ou não a conta | `https://SEU-DOMINIO-DA-API/excluir-conta` (link para o Google Play) |
| Modo de teste (código 123456, simular pagamento) **só** com `NODE_ENV=development` explícito; sem isso o servidor exige segredos fortes | os dois `.env` |

## Desempenho

| O quê | Onde |
|---|---|
| Consultas SQL compiladas uma vez e reaproveitadas; índices nas consultas de cupons, relatórios, painéis e listas | `compartilhado/src/db.ts` |
| SQLite ajustado (WAL + `synchronous=NORMAL`, cache de 16 MB, leitura por mapeamento de memória) | `compartilhado/src/db.ts` |
| Relatórios e dashboard somam no banco (antes liam oferta por oferta); "Meu painel" faz uma consulta para todas as igrejas | servidores |
| Respostas compactadas (gzip); conteúdo público com cache de 1 min + ETag (o que não mudou volta sem corpo) | os dois servidores |
| **Fotos enviadas pelo admin são reduzidas**: o app admin já reduz no celular antes de enviar (upload rápido no 4G) e o servidor sempre grava em WEBP, no máximo 1600 px, qualidade 80, endireitada. Uma foto de celular de ~8 MB fica com ~250 KB. Aceita originais de até 15 MB | `admin/servidor/src/rotas/admin.ts`, `admin/app/src/api.ts` |
| Imagens enviadas com cache de 1 ano (cada envio tem nome novo, então nunca fica desatualizado) | `/uploads` |
| Apps: imagens com cache em memória e disco (`expo-image`), dados guardados por 1 min entre telas, cupons em lista virtualizada, busca de igrejas sem chamar a API a cada letra | `renovando-app`, `admin/app` |
| Painel web dividido por página: carregamento inicial de 724 KB → 316 KB (os gráficos só baixam quando abertos) | `admin/painel` |

## Testes

Com `npm run api` e `npm run admin` ligados (modo de desenvolvimento):

```bash
npm test
```

Roda 209 verificações: segurança, criptografia, exclusão de conta, envio de imagens, painéis, verificação em duas etapas,
WhatsApp, avisos no celular e mais. Os testes **nunca mexem em igrejas reais** (cada um cria uma igreja temporária e apaga
tudo no fim) e se recusam a rodar se a API não estiver em modo de desenvolvimento.

## Conteúdo vindo do site

| Comando | O que traz |
|---|---|
| `npm run importar-igrejas` | as igrejas credenciadas (com logo e chave PIX cifrada) |
| `npm run importar-artistas` | o catálogo de shows gospel |
| `npm run importar-conteudo` | prêmios (valores e fotos), perguntas frequentes, Política de Privacidade, depoimentos, notícias, parcerias, banners e galeria do Palmas para Jesus |
| `npm run otimizar-imagens` | deixa as imagens no padrão (WEBP, até 1600 px) e guarda as sem uso |

Todos só leem as páginas públicas do site e podem rodar de novo sem duplicar. Os Termos de Uso não são importados
(no site estão incompletos).

## Panfleto de cada igreja

A campanha tem a arte do panfleto (1200 × 470, a mesma do site, com o quadro branco no canto direito). Cada igreja aprovada
baixa um **PDF A4 com o QR Code da página dela** nesse quadro, em dois formatos:

- **1 por folha**: panfleto grande (27,7 × 10,9 cm), para cartaz e mural;
- **6 por folha**: 2 colunas × 3 linhas (13,7 × 5,4 cm cada), com linha tracejada para recortar e distribuir.

Quem baixa: o **pastor** (e o semeador que indicou a igreja) em *Meu painel* no app, e a equipe em **Igrejas** no painel web
e no app admin. A arte é trocada em **Campanhas → Panfleto**. O QR Code abre a página da igreja (`URL_PUBLICA` na API e
`URL_PUBLICA_API` no admin).

## Entrada no painel pelo WhatsApp (como no site)

O painel administrativo (`admin.`) tem a mesma entrada do site: **WhatsApp → código → escolha do perfil**.

| Perfil | O que vê no painel |
|---|---|
| Equipe (Administrador / Editor) | o painel completo. O número fica em **Usuários do painel → WhatsApp de acesso**. Quem tem verificação em duas etapas digita também o código do aplicativo. E-mail e senha continuam valendo |
| Pastor | a igreja (saldo, arrecadação, membros contribuintes), **Minha igreja** (logo, mensagem e endereço; nunca PIX) e os panfletos |
| Semeador N1 | igrejas, rede de N2, saldo e movimentações; **cadastra igrejas** e **semeadores N2** |
| Semeador N2 | igrejas sob sua responsabilidade, saldo e movimentações; cadastra igrejas |
| Parceiro | portal com saldo, campanhas e movimentações (sem dados de ofertantes) |

- A mesma pessoa pode ter vários perfis (ex.: pastor e semeador) e escolhe com qual entrar.
- Cadastro em análise ou recusado aparece na própria tela de entrada.
- Token de perfil tem "audiência" própria: **nunca abre as rotas da equipe**, e é conferido a cada acesso (semeador desativado perde o acesso na hora).
- O código só é enviado para números que têm algum acesso; a resposta é sempre a mesma (não revela quem tem acesso). Em desenvolvimento o código é **123456**.
- O app admin (celular) também entra pelo WhatsApp, só para a equipe.

## Rede, repasses e financeiro

> O sistema **não transfere dinheiro** e não acessa banco nenhum. Ele calcula e registra quanto cada um tem a receber;
> a equipe paga por fora (banco/gateway) e depois registra o pagamento com a referência do comprovante.

- **Semeadores N1 e N2:** quem se cadastra sem código é N1; quem usa o convite de um N1 (`/semeador/<codigo>`, no *Meu painel*) entra como N2 da rede dele. N2 não convida (rede de 2 níveis). Admin vê nível, rede e corrige a ligação.
- **Duas regras de divisão por campanha:** "sem N2" e "com N2" (a parte de semeador se divide entre N2 e N1). Cada parte tem um tipo (igreja, semeador N1/N2, parceiro, plataforma). A regra vale no momento da oferta e fica gravada nela. **Os percentuais de "com N2" que vieram preenchidos são exemplos: confira com a diretoria.**
- **Parceiro da campanha:** cadastrado em Parcerias com WhatsApp e chave PIX (cifrados); vê saldo e movimentações no app (*Meu painel*), sem dados de quem ofertou.
- **Transações:** em Repasses, a aba *Todas as movimentações* lista cada lançamento com filtros por beneficiário, situação e período.
- **Repasses** (`compartilhado/src/repasses.ts`): cada oferta paga gera lançamentos "a pagar" (os centavos do arredondamento vão para a plataforma, e a soma sempre bate). Em **Repasses** (só administradores) a equipe vê quanto pagar e a chave PIX, e registra o pagamento. Igreja, semeador e parceiro veem "a receber" e "já recebido" no app.
- **Ofertas:** detalhe com cupons e divisão, planilha dos cupons de cada oferta e **registro manual** de oferta recebida fora do app (só administradores; entra paga e gera números e repasses).
- **Aprovações** num lugar só, com motivo da recusa e aviso no celular de quem se cadastrou. **Meta de ofertas** com barra de progresso, **resumo dos sorteios**, **conferência do formato das artes** (cupom 640 × 930, panfleto 1200 × 470) e **Central de ajuda** (painel web e app admin).

## Pronto para produção

| O quê | Como funciona |
|---|---|
| **Código de login pelo WhatsApp** | WhatsApp Cloud API (`api/src/whatsapp.ts`). Liga com `WHATSAPP_TOKEN` e `WHATSAPP_NUMERO_ID`. O código fica no banco só como resumo (hash) |
| **Pagamento PIX** | todo gateway passa por `compartilhado/src/pagamentos.ts`. `PIX_PROVEDOR=desligado` (padrão em produção) mantém as ofertas fechadas até o gateway ser integrado. Cobranças vencidas expiram sozinhas a cada 5 min |
| **Avisos no celular** | o app pede para ativar (em "Mais" e depois do pagamento). Automáticos: lembrete na véspera do sorteio, resultado para todos e mensagem especial para o ganhador. O admin envia avisos em **Sistema → Avisos no celular** |
| **Verificação em duas etapas no admin** | código do aplicativo autenticador (Google Authenticator etc.), em **Minha conta**. `ADMIN_2FA_OBRIGATORIO=1` obriga todos. Outro administrador desliga para quem perdeu o celular |
| **Hospedagem** | `docker compose up -d --build`: API, admin, HTTPS automático (Caddy) e backup diário. Passo a passo em **[PUBLICAR.md](PUBLICAR.md)** |
| **Apps nas lojas** | `eas.json` com os endereços de produção nos dois apps |

## O que ainda depende de você

1. **Gateway PIX:** escolher (Asaas, Efí, Mercado Pago ou Pagar.me) e mandar as chaves de teste para integrar.
2. **WhatsApp:** conta Meta Business, número e modelo `codigo_login` aprovado (ver PUBLICAR.md).
3. **Jurídico:** autorização do sorteio, regulamento, revisão dos Termos e da Política de Privacidade (a do site tem telefone e endereço de exemplo).
4. **Lojas:** Google Play e Apple exigem regras próprias para apps com sorteio pago; decidir com o advogado se a oferta fica no app ou só no site.
5. **Dados das igrejas:** WhatsApp dos pastores (para o "Meu painel") e conferência das chaves PIX antes de repassar dinheiro.
6. **Migração da Edição 2026:** ofertas, cupons e contas que já estão no site atual.
7. **Equipe:** criar um usuário do painel para cada pessoa e ativar a verificação em duas etapas.
