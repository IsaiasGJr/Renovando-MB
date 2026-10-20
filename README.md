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

## Antes de colocar no ar

1. **Pagamento real:** integrar um gateway com PIX e split (Asaas, Pagar.me, Efí ou Mercado Pago). A API do app já tem o webhook `POST /api/webhooks/pix` (protegido por `WEBHOOK_SEGREDO`).
2. **Código por WhatsApp:** integrar a WhatsApp Cloud API em `api/src/rotas/publico.ts` (procure o `TODO`).
3. **Chaves de criptografia:** gere com `npm run gerar-chaves` e coloque as **mesmas** `CHAVE_CRIPTOGRAFIA` e `CHAVE_INDICE` em `api/.env` e `admin/servidor/.env`. **Guarde uma cópia em local seguro (cofre de senhas)**: sem a `CHAVE_CRIPTOGRAFIA`, CPF e WhatsApp não podem ser recuperados. Nunca troque a chave sem migrar os dados.
4. **Configuração de produção:**
   - Nos dois `.env`: `NODE_ENV=production` e um `JWT_SEGREDO` diferente em cada um (32+ caracteres aleatórios). Na API, `WEBHOOK_SEGREDO` com 24+ caracteres.
   - Atrás de proxy ou hospedagem (Nginx, Cloudflare, Render...): `TRUST_PROXY=1`, para os limites usarem o IP real.
   - **HTTPS** obrigatório nos endereços públicos e backup diário da pasta `dados/`.
   - No admin, uma `ADMIN_SENHA` nova.
   - Apagar `dados/` para começar sem os dados de exemplo.
   - Os dois servidores precisam enxergar a mesma pasta `dados/` (ou `DADOS_DIR`).
5. **Lojas:** no Google Play Console (Segurança dos dados → Exclusão de conta), informe o link `https://SEU-DOMINIO-DA-API/excluir-conta`.
6. **App:** definir `EXPO_PUBLIC_API_URL` com o endereço público da API e gerar os builds com EAS.
7. **Jurídico:** autorização do sorteio (Ministério da Fazenda) e regulamento publicado.
