# Publicação nas lojas (Google Play e App Store)

Respostas prontas para os formulários das lojas, de acordo com o que o app **realmente** coleta.
O passo a passo dos builds (EAS) está em [PUBLICAR.md](PUBLICAR.md), seção 10.

## Links que as lojas pedem

| Campo | Endereço |
|---|---|
| Política de Privacidade | `https://api.renovandoavinhadosenhor.com/privacidade` |
| Termos de Uso | `https://api.renovandoavinhadosenhor.com/termos` |
| Excluir conta (sem o app) | `https://api.renovandoavinhadosenhor.com/excluir-conta` |
| Suporte / contato | `contato@renovandoavinhadosenhor.com` |

As duas primeiras páginas mostram o mesmo texto que o admin edita em **Páginas legais**.

## App dos ofertantes ("Renovando")

### Google Play: Segurança dos dados

- **O app coleta ou compartilha dados?** Coleta. **Não compartilha** com terceiros (o PIX é pago no app do banco da pessoa).
- **Criptografia em trânsito:** sim (só https).
- **A pessoa pode pedir a exclusão dos dados?** Sim, no app (Mais → Excluir minha conta) e pelo link acima.

| Tipo de dado (categoria do Google) | Coletado | Obrigatório? | Para quê |
|---|---|---|---|
| Informações pessoais → Nome | sim | sim | Conta, cupons e comprovante |
| Informações pessoais → Número de telefone | sim (WhatsApp) | sim | Login por código e conta |
| Informações pessoais → E-mail | sim | não (só no Fale conosco e no pedido de show) | Atendimento |
| Informações pessoais → Outras (CPF) | sim | não (só no cadastro de semeador) | Cadastro e repasses do semeador |
| Informações financeiras → Histórico de compras | sim (ofertas) | sim, para concorrer | Funcionalidade do app (cupons e sorteios) |
| Informações financeiras → Outras (chave PIX) | sim | não (só semeador/igreja) | Repasses |
| Mensagens → Outras mensagens | sim | não | Fale conosco |
| Fotos e vídeos / Arquivos | sim | não (anexo do Fale conosco) | Atendimento |
| IDs do dispositivo ou outros | sim (token de avisos) | não (só se aceitar avisos) | Avisos de sorteio |

Não coleta: localização, contatos, agenda, dados de saúde, histórico de navegação, IDs de publicidade.
Não usa dados para publicidade nem para análise de terceiros.

### App Store: Privacidade do app ("rótulos")

- **Dados usados para rastrear você:** nenhum.
- **Dados vinculados a você:**
  - Informações de contato: nome, telefone, e-mail
  - Compras: histórico de compras (ofertas)
  - Informações financeiras: outras (chave PIX, só semeadores)
  - Conteúdo do usuário: outros (mensagens e anexos do Fale conosco)
  - Identificadores: ID do usuário
  - Outros dados: CPF (só semeadores)
- **Finalidade de todos:** funcionalidade do app. Nenhum para publicidade.

### Sorteio (regras das lojas)

- **App Store, diretriz 5.3:** o sorteio é promovido pelo projeto, com regulamento oficial, e o app diz que a Apple
  não patrocina. O aviso já está na tela **Prêmios**. Falta o **regulamento** (com o advogado), que precisa estar
  acessível no app; quando estiver pronto, ele entra em **Páginas legais** e ganha um link na tela Prêmios.
- **Google Play:** sorteio com oferta paga entra em "jogos de azar com dinheiro real" se o prêmio depender só de sorte
  e da compra. Decida com o advogado se a oferta fica no app ou só fora dele (ver PUBLICAR.md). Se ficar no app,
  o Google pode pedir autorização/licença do sorteio.
- Doação/oferta pelo app: a Apple permite pagamento fora do sistema da Apple (PIX) para doações a organizações
  sem fins lucrativos aprovadas; confirme o enquadramento da campanha com o advogado.

### Textos sugeridos

- **Nome:** Renovando a Vinha do Senhor
- **Descrição curta (80):** Oferte para a sua igreja, receba números da sorte e acompanhe os sorteios.
- **Descrição:** Participe da campanha Renovando a Vinha do Senhor: escolha a sua igreja, faça a sua oferta por PIX
  e receba números da sorte para os sorteios da edição. Acompanhe os prêmios e os resultados, baixe seus cupons,
  conheça os artistas dos shows gospel e o projeto Palmas para Jesus. Pastores e semeadores acompanham as ofertas
  das suas igrejas no "Meu painel".
- **Categoria:** Estilo de vida (Google) / Estilo de vida (Apple).
- **Classificação etária:** responda "sim" para sorteio/concurso; a classificação final é dada pela loja.

## App admin ("Renovando Admin")

É de uso interno da equipe. **Não publique na loja aberta:**
- Google Play: use **teste interno** (lista de e-mails da equipe) ou distribuição privada.
- Apple: **distribuição não listada** (link direto) ou TestFlight para a equipe.

Formulário de dados: coleta nome e e-mail da equipe (login) e mostra dados das igrejas e ofertantes para gestão.
Protegido por senha + verificação em duas etapas e por bloqueio com digital, rosto ou senha do celular.
