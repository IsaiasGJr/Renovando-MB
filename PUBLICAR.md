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

Proteção do servidor (faça antes de colocar dados reais):

```bash
# 1. Entrar só com chave SSH (no SEU computador: ssh-keygen e ssh-copy-id renovando@IP-DO-SERVIDOR)
#    Depois de testar que a chave funciona, no servidor:
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/; s/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh
# 2. Atualizações de segurança automáticas
apt-get install -y unattended-upgrades && dpkg-reconfigure -f noninteractive unattended-upgrades
# 3. Bloqueio automático de quem tenta adivinhar a senha do SSH
apt-get install -y fail2ban && systemctl enable --now fail2ban
```

Só o Caddy (portas 80 e 443) fica exposto. A API e o admin ficam na rede interna do Docker:
**não acrescente `ports:` neles** no `docker-compose.yml` (o Docker passa por cima do firewall `ufw`).

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
# Pastas de dados com o dono certo (os serviços rodam como usuário comum, uid 1000)
mkdir -p dados backups api/certificados && sudo chown -R 1000:1000 dados backups
docker compose up -d --build
docker compose ps          # todos "healthy"
docker compose logs -f api # acompanhar
```

Abra `https://admin.renovandoavinhadosenhor.com`, entre e ative a **verificação em duas etapas**
(Minha conta). Com `ADMIN_2FA_OBRIGATORIO=1`, todos os usuários do painel precisam ativar.

Os dados ficam em `./dados` (banco, imagens e anexos). A instalação nova começa **limpa** (só a campanha,
os prêmios e os textos legais). Traga o conteúdo do site com os importadores (só leem as páginas públicas):

```bash
docker compose exec api npm run importar-igrejas    # 76 igrejas, com logo
docker compose exec api npm run importar-artistas   # 47 artistas, com fotos
docker compose exec api npm run importar-conteudo   # prêmios e resultados, notícias, banners, parcerias...
```

Não copie a pasta `dados/` do computador de desenvolvimento: ela tem contas de teste e usa outras chaves.

## 6. WhatsApp (código de login)

1. Em business.facebook.com crie o app do tipo *Business* e adicione o produto **WhatsApp**.
2. Cadastre e verifique o número que vai enviar os códigos.
3. Em *Modelos de mensagem*, crie um modelo da categoria **Autenticação**, nome `codigo_login`, idioma Português (BR), com o botão **Copiar código**. Aguarde a aprovação.
4. Crie um **usuário do sistema** com permissão no WhatsApp e gere um token **permanente**.
5. No `api/.env`: `WHATSAPP_TOKEN`, `WHATSAPP_NUMERO_ID` (o *Phone number ID*), e reinicie: `docker compose up -d api`.

## 7. Pagamento PIX

Até configurar um gateway, `PIX_PROVEDOR=desligado` mantém as ofertas fechadas
(o app mostra "As ofertas pelo app ainda não estão abertas").

### Qual banco ou gateway

| Opção | Pede dados de quem paga? | Situação |
|---|---|---|
| **Banco Inter** (conta PJ, API Pix do próprio banco) | **Não** | **Pronto** (`PIX_PROVEDOR=inter`). O PIX cai direto na conta do Inter, sem gateway no meio |
| **Efí** (antiga Gerencianet) | **Não** | **Pronto** (`PIX_PROVEDOR=efi`) |
| Mercado Pago | E-mail do pagador | Precisaria pedir e-mail no app |
| Asaas / Pagar.me | CPF/CNPJ do pagador | Precisaria pedir CPF de todo ofertante |

Inter e Efí usam a **API Pix padrão do Banco Central** (`compartilhado/src/pix-bacen.ts`). Outro banco com a
mesma API entra ali com poucas linhas.

### Banco Inter (recomendado: é o banco do projeto)

1. No **Internet Banking PJ** do Inter: **Soluções para sua empresa → Nova Integração**.
   Marque a **API Pix** com as permissões de cobrança imediata e webhook
   (`cob.write`, `cob.read`, `webhook.write`, `webhook.read`) e aceite.
2. Na lista de integrações, **baixe a chave e o certificado** (arquivos `.key` e `.crt`) e **ative**.
   Copie os dois para o servidor em `api/certificados/` (a pasta não vai para o GitHub).
3. Tenha uma **chave PIX** na conta (de preferência a aleatória).
4. No `api/.env`:
   ```
   PIX_PROVEDOR=inter
   INTER_CLIENT_ID=...
   INTER_CLIENT_SECRET=...
   INTER_CERTIFICADO=/app/api/certificados/inter.crt
   INTER_CHAVE_PRIVADA=/app/api/certificados/inter.key
   INTER_CHAVE_PIX=...
   # INTER_CONTA=12345678   só se a integração estiver ligada a mais de uma conta (número com dígito)
   # INTER_HOMOLOGACAO=1    para usar o ambiente de testes (sandbox) do Inter
   ```
5. `docker compose up -d` e cadastre o aviso de pagamento (uma vez):
   ```bash
   docker compose exec api npm run pix-webhook -w renovando-api
   ```
6. Faça uma oferta real de R$ 20, pague e confira o cupom no app e a oferta no painel.

### Efí

1. Abra a conta PJ na Efí e, no painel, crie uma **aplicação** com os escopos da API Pix
   (`cob.write`, `cob.read`, `webhook.write`, `webhook.read`).
2. Baixe o **certificado** (.p12) de **homologação** (testes) e, depois, o de **produção**, para `api/certificados/`.
3. Cadastre uma **chave PIX** na conta.
4. No `api/.env`: `PIX_PROVEDOR=efi`, `EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `EFI_CERTIFICADO=/app/api/certificados/efi.p12`,
   `EFI_CHAVE_PIX` e, para testes, `EFI_HOMOLOGACAO=1` (na homologação, cobranças até R$ 10,00 são pagas sozinhas).
5. Cadastre o aviso de pagamento: `docker compose exec api npm run pix-webhook -w renovando-api`.

Segurança: o aviso de pagamento leva o `WEBHOOK_SEGREDO` no endereço e, mesmo assim, o sistema
**consulta a cobrança no banco** e só libera os cupons se ela estiver paga. Um aviso falso não libera nada.

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

## Homologação: pessoas de fora testando antes do lançamento

Um servidor **igual ao de produção** (mesmas proteções), mas com **contas de demonstração** e **pagamento simulado**,
para enviar o app a testadores. Nenhum PIX de verdade e nenhum WhatsApp são necessários.

1. **Servidor:** qualquer máquina Linux com Docker. Opção gratuita: Oracle Cloud "Always Free" (VM ARM;
   pede cartão só para verificar). Faça as seções 3 a 5 deste guia nela.
2. **Endereços:** no DNS do domínio, crie `teste-api` e `teste-admin` apontando para o IP da máquina, e no
   `.env` da pasta: `DOMINIO_API=teste-api.renovandoavinhadosenhor.com` e `DOMINIO_ADMIN=teste-admin.renovandoavinhadosenhor.com`.
   (São os endereços do perfil de build `teste` dos apps.)
3. **`api/.env` e `admin/servidor/.env`** (as linhas de demonstração iguais nos dois):
   ```
   NODE_ENV=production
   URL_PUBLICA=https://teste-api.renovandoavinhadosenhor.com      # só no api/.env
   PAGAMENTO_SIMULADO=1                                         # só no api/.env: botão "Simular pagamento"
   CONTAS_DEMONSTRACAO=63900000001,63900000002                  # celulares dos testadores (até 10)
   CODIGO_DEMONSTRACAO=482915                                   # escolha 6 dígitos não óbvios
   ```
   Esses números entram com o código fixo, sem WhatsApp; qualquer outro número continua precisando do WhatsApp.
   `PAGAMENTO_SIMULADO` é recusado no endereço oficial `api.renovandoavinhadosenhor.com`.
4. `docker compose up -d --build` e os importadores (seção 5).
5. **Apps de teste** (APK para Android, para mandar o link a quem vai testar):
   ```bash
   cd renovando-app && npx eas-cli@latest build --profile teste --platform android
   cd admin/app && npx eas-cli@latest build --profile teste --platform android
   ```
6. Mande ao testador: o link do APK, o número de demonstração dele e o código. No app admin/painel, crie um
   usuário de editor para ele (não de administrador).

Ao lançar: use outro servidor (ou apague `dados/` desta máquina), **tire** `PAGAMENTO_SIMULADO` e deixe
`CONTAS_DEMONSTRACAO` só com o número que a Apple e o Google usam na revisão (as lojas pedem um login de demonstração).

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
