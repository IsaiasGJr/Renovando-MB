# Como colocar no ar

Guia passo a passo para publicar a API do app e o sistema administrativo num servidor próprio,
com HTTPS automático e backup diário. Os apps (ofertantes e admin) vão para as lojas pelo EAS (Expo).

## 1. O que contratar

| Item | Sugestão | Custo aproximado |
|---|---|---|
| Servidor (VPS) Linux | Ubuntu 24.04, 2 GB de RAM, 40 GB de disco (Hostinger, Contabo, DigitalOcean, Hetzner…) | R$ 30–60/mês |
| Domínio | o atual `renovandoavinhadosenhor.com` (só criar os subdomínios) | já existe |
| Conta Meta Business + WhatsApp Cloud API | número dedicado para enviar os códigos | mensagens de autenticação são cobradas por envio |
| Gateway PIX com divisão (split) | Asaas, Efí, Mercado Pago ou Pagar.me | taxa por PIX recebido |
| Google Play Console | conta de desenvolvedor | US$ 25 (uma vez) |
| Apple Developer | conta de desenvolvedor | US$ 99/ano |
| Expo (EAS) | conta gratuita serve para começar | grátis |

## 2. DNS

No painel do domínio, crie dois registros **tipo A** apontando para o IP do servidor:

- `api.renovandoavinhadosenhor.com`
- `admin.renovandoavinhadosenhor.com`

## 3. Preparar o servidor (uma vez)

```bash
# no servidor, como root
curl -fsSL https://get.docker.com | sh
adduser renovando && usermod -aG docker renovando
ufw allow OpenSSH && ufw allow 80 && ufw allow 443/tcp && ufw allow 443/udp && ufw enable
```

Entre como `renovando` e copie o projeto (pelo GitHub privado ou `scp`):

```bash
git clone <endereço-do-repositório-privado> renovando && cd renovando
```

## 4. Configuração (segredos)

No seu computador, gere as chaves de criptografia **uma única vez**:

```bash
npm run gerar-chaves
```

> Guarde `CHAVE_CRIPTOGRAFIA` e `CHAVE_INDICE` num cofre de senhas (Bitwarden, 1Password…).
> Sem elas, CPF, WhatsApp e chaves PIX do banco **não podem ser recuperados**, nem com backup.

No servidor, crie os três arquivos a partir dos modelos:

```bash
cp .env.exemplo .env                                  # domínios e e-mail do HTTPS
cp api/.env.exemplo api/.env                          # API do app
cp admin/servidor/.env.exemplo admin/servidor/.env    # admin
nano api/.env   # e os outros
```

- `JWT_SEGREDO` diferente em cada um (32+ caracteres aleatórios):
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
- As **mesmas** `CHAVE_CRIPTOGRAFIA` e `CHAVE_INDICE` nos dois.
- `ADMIN_EMAIL` / `ADMIN_SENHA`: o primeiro administrador (troque a senha depois do primeiro acesso).
- `NODE_ENV=production` nos dois. **Nunca** `development` no servidor (ativaria o código 123456).

## 5. Subir

```bash
docker compose up -d --build
docker compose ps          # todos "healthy"
docker compose logs -f api # acompanhar
```

Abra `https://admin.renovandoavinhadosenhor.com`, entre e ative a **verificação em duas etapas**
(Minha conta). Com `ADMIN_2FA_OBRIGATORIO=1`, todos os usuários do painel precisam ativar.

Os dados ficam em `./dados` (banco, imagens e anexos). Para levar o conteúdo que já está pronto
(75 igrejas, 47 artistas, prêmios, textos), copie a pasta `dados/` do seu computador para o servidor
**antes** de subir, junto com as mesmas chaves de criptografia.

## 6. WhatsApp (código de login)

1. Em business.facebook.com crie o app do tipo *Business* e adicione o produto **WhatsApp**.
2. Cadastre e verifique o número que vai enviar os códigos.
3. Em *Modelos de mensagem*, crie um modelo da categoria **Autenticação**, nome `codigo_login`, idioma Português (BR), com o botão **Copiar código**. Aguarde a aprovação.
4. Crie um **usuário do sistema** com permissão no WhatsApp e gere um token **permanente**.
5. No `api/.env`: `WHATSAPP_TOKEN`, `WHATSAPP_NUMERO_ID` (o *Phone number ID*), e reinicie: `docker compose up -d api`.

## 7. Pagamento PIX

Até configurar um gateway, `PIX_PROVEDOR=desligado` mantém as ofertas fechadas
(o app mostra "As ofertas pelo app ainda não estão abertas").

### Qual gateway

| Gateway | Pede dados de quem paga? | Encaixe neste sistema |
|---|---|---|
| **Efí** (antiga Gerencianet) | **Não**: o PIX sai só com valor e chave | **Pronto no sistema** (`PIX_PROVEDOR=efi`). Combina com oferta anônima e cadastro só por WhatsApp |
| Mercado Pago | E-mail do pagador | Precisaria pedir e-mail no app |
| Asaas | Cliente com CPF/CNPJ | Precisaria pedir CPF de todo ofertante |
| Pagar.me | Cliente com CPF/CNPJ | Precisaria pedir CPF de todo ofertante |

Se escolher outro, a integração é um arquivo novo no padrão de `compartilhado/src/pix-efi.ts`.

### Efí (pronto)

1. Abra a conta PJ na Efí e, no painel, crie uma **aplicação** com os escopos da API Pix
   (`cob.write`, `cob.read`, `webhook.write`, `webhook.read`).
2. Baixe o **certificado** (.p12) de **homologação** (testes) e, depois, o de **produção**.
   Copie para o servidor, por exemplo `api/certificados/efi.p12` (a pasta não vai para o GitHub).
3. Cadastre uma **chave PIX** na conta (de preferência a aleatória).
4. No `api/.env`:
   ```
   PIX_PROVEDOR=efi
   EFI_CLIENT_ID=...
   EFI_CLIENT_SECRET=...
   EFI_CERTIFICADO=/app/api/certificados/efi.p12
   EFI_CHAVE_PIX=...
   EFI_HOMOLOGACAO=1        # tire esta linha ao passar para produção
   ```
5. `docker compose up -d` e cadastre o aviso de pagamento (uma vez por ambiente):
   ```bash
   docker compose exec api npm run efi-webhook -w renovando-api
   ```
6. Teste: no ambiente de homologação da Efí, cobranças **até R$ 10,00** são pagas sozinhas
   (para testar, use um cupom de R$ 10 numa campanha de teste). O cupom deve aparecer no app.
7. Produção: troque as credenciais e o certificado pelos de produção, tire `EFI_HOMOLOGACAO`,
   rode o passo 5 de novo e faça uma oferta real de R$ 20.

Segurança: o aviso de pagamento leva o `WEBHOOK_SEGREDO` no endereço e, mesmo assim, o sistema
**consulta a cobrança na Efí** e só libera os cupons se ela estiver paga. Um aviso falso não libera nada.

## 8. Backup

O serviço `backup` faz, todo dia, uma cópia compactada do banco em `backups/banco/` (guarda 30 dias)
e espelha imagens e anexos em `backups/uploads` e `backups/anexos`.

**Copie a pasta `backups/` para fora do servidor** todo dia. Exemplo com o rclone (Google Drive):

```bash
rclone config                                   # uma vez: cria o "drive"
crontab -e
# 30 4 * * * rclone copy /home/renovando/renovando/backups drive:renovando-backups
```

### Restaurar um backup

```bash
docker compose down
gunzip -c backups/banco/renovando-AAAA-MM-DD-HH-MM.db.gz > dados/renovando.db
rm -f dados/renovando.db-wal dados/renovando.db-shm
cp -n backups/uploads/* dados/uploads/ ; cp -n backups/anexos/* dados/anexos/
docker compose up -d
```

## 9. Atualizar o sistema

```bash
git pull
docker compose up -d --build
```

O banco é atualizado sozinho ao iniciar (colunas novas são criadas sem perder dados).

## 10. Apps nas lojas (EAS)

Os endereços de produção já estão em `renovando-app/eas.json` e `admin/app/eas.json`.

```bash
npm install -g eas-cli
cd renovando-app
eas login
eas init                                   # liga o app ao projeto na Expo (necessário para os avisos no celular)
eas build --platform android --profile production
eas build --platform ios --profile production
eas submit --platform android              # envia para a Play Store
```

Faça o mesmo em `admin/app` (o app admin pode ficar só como "teste interno" na Play Store, para a equipe).

Na Play Console, em **Segurança dos dados → Exclusão de conta**, informe
`https://api.renovandoavinhadosenhor.com/excluir-conta`.

Identificadores dos apps (não dá para mudar depois de publicar): `com.renovandoavinhadosenhor.app`
e `com.renovandoavinhadosenhor.admin` (em `app.json`, troque antes do primeiro envio se quiser outros).
