# syntax=docker/dockerfile:1.7
# API NestJS em 4 estágios: dependências -> build -> dependências de produção -> imagem final enxuta.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
# OpenSSL é exigido pelo engine do Prisma.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- 1) todas as dependências (inclui as de build) ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- 2) compila TypeScript e gera o Prisma Client ----
FROM deps AS build
COPY prisma ./prisma
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npx prisma generate && npx nest build

# ---- 3) só dependências de produção (o CLI do Prisma fica: roda as migrations no start) ----
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate

# ---- 4) imagem final ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY package.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
# Roda sem privilégios de root.
USER node
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
