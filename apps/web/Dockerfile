# syntax=docker/dockerfile:1.7
# Front Next.js em 3 estágios, gerando um servidor "standalone" (imagem final pequena).

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
# Opcional: NEXT_PUBLIC_* é embutido no JavaScript do navegador NA HORA DO BUILD (usado no
# docker-compose local). Em produção prefira a variável de RUNTIME `API_URL` no serviço:
# ela vale sem refazer o build (veja src/lib/env.ts, src/lib/runtime-config.ts e o README, seção Deploy).
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
# Em Kubernetes (Northflank) a variável HOSTNAME é preenchida com o nome do pod e sobrescreveria
# o ENV acima, fazendo o Next escutar só nesse nome. Forçamos 0.0.0.0 no próprio comando.
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 exec node server.js"]
