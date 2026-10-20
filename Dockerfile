# Imagem única dos dois servidores (API do app e admin). O docker-compose escolhe qual roda.
# Os apps (renovando-app e admin/app) NÃO entram aqui: eles são gerados com o EAS (Expo).

FROM node:24-bookworm-slim AS base
WORKDIR /app
# Fontes para o bilhete do cupom (texto desenhado no servidor) e certificados para HTTPS de saída.
RUN apt-get update \
  && apt-get install -y --no-install-recommends fonts-dejavu-core fontconfig ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*

# Dependências primeiro (aproveita o cache quando só o código muda).
FROM base AS deps
COPY package.json package-lock.json ./
COPY compartilhado/package.json compartilhado/
COPY api/package.json api/
COPY admin/servidor/package.json admin/servidor/
COPY admin/painel/package.json admin/painel/
RUN npm ci --no-audit --no-fund

# Gera as telas do painel web (admin/painel/dist).
FROM deps AS painel
COPY admin/painel admin/painel
RUN npm run build -w renovando-admin-painel

FROM deps AS final
ENV NODE_ENV=production \
    DADOS_DIR=/app/dados \
    PAINEL_DIST=/app/admin/painel/dist
COPY compartilhado compartilhado
COPY api api
COPY admin/servidor admin/servidor
COPY scripts scripts
COPY --from=painel /app/admin/painel/dist admin/painel/dist
# Roda sem privilégios de administrador do sistema.
RUN mkdir -p /app/dados /app/backups && chown -R node:node /app/dados /app/backups
USER node
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "start", "-w", "renovando-api"]
