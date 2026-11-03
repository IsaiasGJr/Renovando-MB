# Dia da virada: do site antigo para o sistema novo

Roteiro para trocar o site antigo pelo sistema novo **sem perder nenhuma oferta**. Siga na ordem.
O passo a passo técnico de cada item está em [PUBLICAR.md](PUBLICAR.md).

## Uma semana antes

- [ ] Servidor contratado e configurado (PUBLICAR.md, seções 1 a 5), com `api.renovandoavinhadosenhor.com` funcionando.
- [ ] Endereço do painel decidido: o mesmo do admin antigo (troca no dia) ou um novo (ex.: `painel.`), que já pode ficar no ar.
- [ ] WhatsApp Business aprovado e testado: o código chega no celular (PUBLICAR.md, seção 6).
- [ ] Gateway PIX integrado e testado no **modo de teste** do gateway, com uma oferta de ponta a ponta.
- [ ] `npm test` passando no computador de desenvolvimento.
- [ ] Equipe com usuário no painel e verificação em duas etapas ativa.
- [ ] Planilha com o WhatsApp dos pastores enviada em **Importar planilhas → Igrejas** (assim os pastores já entram no "Meu painel").
- [ ] Apps gerados pelo EAS e testados em teste interno (Google Play "teste interno" e TestFlight).
- [ ] Combinado com o responsável pelo site antigo: no dia, ele exporta as **ofertas pagas da Edição 2026** no formato do
      modelo de **Importar planilhas → Ofertas da Edição 2026** (baixe o modelo e envie para ele).

## No dia

1. **Backup** do servidor novo: `docker compose exec backup node scripts/backup.mjs` (PUBLICAR.md, seção 8).
2. **Fechar as ofertas no site antigo** (aviso no topo: "estamos atualizando o sistema, volte em algumas horas").
   A partir daqui nenhuma oferta nova entra no sistema antigo.
3. **Exportar** do sistema antigo as ofertas pagas da Edição 2026 (com o código de cada oferta e os números da sorte).
4. No painel novo: **Importar planilhas → Ofertas da Edição 2026** → escolher o arquivo → **Conferir**.
   - Corrija na planilha o que aparecer como erro (igreja não encontrada, número repetido...) e confira de novo.
   - Quando não houver erro: **Importar**. Importar de novo o mesmo arquivo não duplica nada.
   - Confira o total: soma das ofertas e quantidade de cupons devem bater com o relatório do sistema antigo.
5. Trazer o conteúdo mais recente do site (prêmios, resultados, igrejas novas):
   `docker compose exec api npm run importar-conteudo`, `... importar-igrejas` e `... importar-artistas`
   (só leem as páginas públicas do site; fazem backup do banco antes).
6. **Ligar o PIX de verdade**: `PIX_PROVEDOR=<gateway>` no `.env` da API e reiniciar (`docker compose up -d`).
7. **Teste de fumaça** com uma pessoa da equipe:
   - entrar no app com o WhatsApp (o código chega);
   - fazer uma oferta real de R$ 20 e pagar;
   - ver o número da sorte em "Meus cupons" e a oferta no painel (Relatórios e Repasses);
   - pastor de uma igreja entra no "Meu painel" e baixa o panfleto.
8. **Apontar o DNS** do endereço do painel para o servidor novo (se for o mesmo do admin antigo).
9. **Publicar os apps** nas lojas (sair do teste interno).
10. **Avisar** pastores e semeadores: o novo link de cada igreja e o panfleto com QR Code ficam no "Meu painel".

## Depois

- [ ] Conferir o backup do dia seguinte (PUBLICAR.md, seção 8).
- [ ] Acompanhar a auditoria do painel nos primeiros dias (ofertas, logins, alterações).
- [ ] Próximo sorteio: confira em **Prêmios** a data e faça o sorteio pelo painel (ou pelo número da Loteria Federal).
- [ ] Repasses: as ofertas importadas do sistema antigo **não** geram repasses aqui (já foram tratadas lá).
      Os repasses começam a contar a partir das ofertas feitas no sistema novo.

## Se algo der errado

- Antes do passo 8, nada mudou para o público: é só reabrir as ofertas no site antigo.
- Depois: voltar o DNS para o endereço antigo e restaurar o backup do passo 1 (PUBLICAR.md, "Restaurar um backup").
- As ofertas pagas no sistema novo nesse meio tempo continuam registradas no banco novo (não se perdem).
