# Casa de Leilões

Casa de Leilões online feita para o **teste técnico Elite Dev da Verzel**. Um **leiloeiro** monta lotes a partir de itens de uma API pública de acervo de museu; **licitantes** depositam saldo simulado, disputam os lotes com lances **ao vivo** e, ao vencer, recebem um **comprovante compartilhável por link**. Qualquer pessoa, **sem login**, pode **auditar** o histórico de lances de um lote e ver se ele foi adulterado.

- **Link do deploy:** https://p01--web--28jn9rcnlbfp.code.run
- **API (deploy):** https://p01--nestjs-api--28jn9rcnlbfp.code.run/health
- **Repositório:** este (monorepo: `apps/api` + `apps/web`)

### Acessos para avaliação

Todas as contas usam a senha **`senha123`** (no deploy e no Docker local):

| Perfil | E-mail | O que dá para ver |
|---|---|---|
| Leiloeiro | `leiloeiro@leilao.dev` | Painel com lotes ao vivo, agendados para as próximas semanas, vendidos e sem vencedor; criação e cancelamento de lotes |
| Licitante 1 (Ana) | `licitante1@leilao.dev` | Lotes em que está ganhando ou foi superada, arremates com comprovante, carteira |
| Licitante 2 (Bruno) | `licitante2@leilao.dev` | Idem, do lado do outro licitante (use em outra janela para ver o tempo real) |

A auditoria (`/audit/<id-do-lote>`) e os comprovantes (`/receipts/<código>`) são públicos e não exigem login.

---

## 1. Como rodar (um comando)

Pré-requisito: **Docker** com Compose v2 (`docker compose version`). Nada mais precisa estar instalado.

```bash
git clone https://github.com/Claudio-16dv/desafio-elite-dev-2026-2.git
cd desafio-elite-dev-2026-2
docker compose up --build
```

Na primeira vez o build leva alguns minutos. Quando os três serviços estiverem saudáveis:

| Serviço | URL | O que é |
|---|---|---|
| Front-end | http://localhost:3000 | Next.js (a aplicação) |
| API | http://localhost:4000 | NestJS (`/health` para checar) |
| Banco | _não publicado_ | PostgreSQL 17, acessível só pela rede interna do Compose |

O que acontece ao subir:

1. O **Postgres** inicia e passa no healthcheck.
2. A **API** aplica as migrations (`prisma migrate deploy`), inicia e **semeia os dados de demonstração** (seção 2).
3. O **front** inicia quando a API está saudável.

Não é preciso criar `.env`: o `docker-compose.yml` traz valores padrão seguros **para desenvolvimento local**. Para qualquer ambiente público, copie `.env.example` para `.env` e **troque os segredos** (seção 10).

Comandos úteis:

```bash
docker compose up --build -d          # em segundo plano
docker compose logs -f api            # logs da API (liquidações, erros)
docker compose ps                     # estado e healthchecks
docker compose down                   # para tudo (mantém os dados)
docker compose down -v                # para tudo E APAGA o banco (volume leilao_pgdata)
docker compose exec db psql -U leilao -d leilao   # console SQL
```

Se as portas 3000/4000 estiverem ocupadas: `WEB_PORT=3100 API_PORT=4100 docker compose up --build`
(e ajuste `NEXT_PUBLIC_API_URL`/`CORS_ORIGINS`, seção 10).

---

## 2. Contas de demonstração

O seed roda a cada início quando `SEED_ON_BOOT=true` (o padrão do Compose) e cria as três contas listadas no topo, com estes saldos iniciais:

| Conta | Saldo inicial |
|---|---|
| Leiloeiro | R$ 0,00 |
| Licitante 1 (Ana) | R$ 100.000,00 |
| Licitante 2 (Bruno) | R$ 100.000,00 |

E os lotes:

- **dois lotes ao vivo com lances abertos** (um com disputa entre Ana e Bruno, outro liderado por Bruno);
- **um lote agendado** (começa em 1 hora);
- **um lote já encerrado e liquidado**, com comprovante emitido (arrematado pela Ana).

No **deploy** há mais lotes, criados pela própria API como um leiloeiro faria: agendados para as próximas duas semanas, ao vivo com disputas em andamento e encerrados com vitórias e derrotas de cada licitante (e um sem lances).

O seed é **idempotente** e usa os mesmos caminhos do sistema real (lances passam pela regra de lance, a liquidação passa pela liquidação), então a cadeia de hashes, os saldos comprometidos e o comprovante dos dados de demonstração são genuínos. Se todos os lotes abertos já terminaram (por exemplo, a demonstração ficou parada por dias), **o próximo início cria lotes novos**, para que sempre exista algo ao vivo para testar.

Para recomeçar do zero: `docker compose down -v && docker compose up --build`.

---

## 3. Roteiro de teste (5 minutos)

Use o [link do deploy](https://p01--web--28jn9rcnlbfp.code.run) ou http://localhost:3000, com **duas janelas** (uma anônima) para ver o tempo real.

1. Sem login você já vê a vitrine (**Ao vivo / Agendados / Encerrados**), com busca e ordenação.
2. **Janela A:** entre como `licitante1@leilao.dev` e abra um lote ao vivo. Você vê a situação (**"Você está ganhando!"** ou **"Você foi superado"**), a contagem regressiva e o histórico.
3. **Janela B:** entre como `licitante2@leilao.dev`, abra o mesmo lote e dê um lance.
   - Na **janela A**, sem recarregar, o lance atual muda, aparece **"Você foi superado"** e o saldo comprometido volta ao disponível.
4. **Mensagens de recusa:** tente um lance muito baixo (**abaixo do mínimo**), um valor maior que seu saldo (**saldo insuficiente**), cobrir o próprio lance (**você já está ganhando**), e dê lance num lote agendado (**lote ainda não iniciado**) ou encerrado (**lote encerrado**). Cada recusa explica o motivo.
5. **Carteira** (`/wallet`): saldo total, comprometido e disponível, e depósito simulado.
6. **Meus arremates** (`/my-bids`): aba _Arrematados_ → **comprovante** e botão **Compartilhar link**. Abra o link numa janela anônima.
7. **Auditoria pública** (`/audit/<id-do-lote>`, link "Auditar histórico" na sala): mostra a cadeia de hashes e o selo **Íntegro**.
8. **Leiloeiro** (`leiloeiro@leilao.dev`): `/seller/new` → busque no acervo (ex.: _monet_), selecione, defina lance inicial, incremento e horário (atalho "10 min") e publique. Em `/seller` veja o total recebido, o resultado dos encerrados e **cancele** lotes.
9. **Anti-sniping:** num lote que termina em menos de 2 minutos, um lance aceito prorroga o fim para "agora + 2 min" (o aviso "Lote prorrogado" aparece para quem está na sala).
10. **Dark mode:** botão de lua/sol no cabeçalho (segue o sistema por padrão).

---

## 4. Stack e por quê

| Camada | Tecnologia | Motivo |
|---|---|---|
| Front-end | **Next.js 15** (App Router), React 19, TypeScript | Roteamento por arquivos para as várias telas; build `standalone` para imagem Docker pequena |
| UI | **Tailwind CSS 4** + componentes no padrão **shadcn/ui** (Radix) | Acessíveis por padrão (foco, ARIA, teclado), tema claro/escuro por variáveis CSS |
| Dados no front | **TanStack Query** | Cache, revalidação e atualização otimista; combina bem com eventos de WebSocket |
| Back-end | **NestJS 11** (Node 22, TypeScript) | Módulos, injeção de dependência e guards impõem a separação de responsabilidades |
| Banco | **PostgreSQL 17** + **Prisma 6** | Transações e `SELECT … FOR UPDATE` (essenciais para lances concorrentes), `CHECK` constraints |
| Tempo real | **Socket.IO** (gateway do Nest) | Salas por lote e por usuário, reconexão automática |
| Infra | **Docker Compose** (local) e **Northflank** (deploy) | `db` + `api` + `web` com um comando; mesmos Dockerfiles em produção |

Os componentes em `apps/web/src/components/ui` são o código-fonte do padrão shadcn/ui (copiado e adaptado ao projeto, como o próprio shadcn recomenda), usando o pacote `radix-ui`.

---

## 5. Arquitetura e organização do código

```
.
├── docker-compose.yml          # db + api + web (um comando)
├── docker-compose.dev.yml      # override opcional: publica o Postgres em 127.0.0.1 (dev sem Docker)
├── .env.example                # variáveis do compose (funciona sem .env)
├── apps/
│   ├── api/                    # NestJS
│   │   ├── prisma/             # schema.prisma + migrations (inclui CHECK constraints)
│   │   ├── src/
│   │   │   ├── main.ts, app.module.ts
│   │   │   ├── config/         # validação das variáveis de ambiente (falha ao iniciar se inválidas)
│   │   │   ├── common/         # relógio injetável, erros de domínio, guards JWT/papéis, validação
│   │   │   ├── prisma/         # PrismaService
│   │   │   ├── health/
│   │   │   ├── database/seed/  # dados de demonstração
│   │   │   └── modules/
│   │   │       ├── auth/        # cadastro, login, JWT
│   │   │       ├── wallet/      # carteira e WalletLedger (ÚNICO lugar que altera saldos)
│   │   │       ├── catalog/     # API externa: cliente HTTP, cache, plano B local
│   │   │       ├── lots/        # vitrine, detalhe, criação, cancelamento, painel do leiloeiro
│   │   │       ├── bids/        # regras de lance (puras), anti-sniping, caso de uso "dar lance"
│   │   │       ├── settlement/  # liquidação + agendador que encerra lotes
│   │   │       ├── integrity/   # cadeia de hashes HMAC, selos, pseudônimos (funções puras)
│   │   │       ├── audit/       # endpoint público de auditoria
│   │   │       ├── receipts/    # comprovante público por link
│   │   │       └── realtime/    # gateway Socket.IO e eventos
│   │   └── test/               # testes de integração (Postgres real)
│   └── web/                    # Next.js
│       └── src/
│           ├── app/            # rotas (páginas finas que só montam features)
│           ├── components/
│           │   ├── ui/         # componentes base (shadcn/ui)
│           │   ├── layout/     # cabeçalho, tema, provedores
│           │   └── shared/     # estados vazio/erro, campo de dinheiro, título de página
│           ├── features/       # uma pasta por funcionalidade: api + hooks + componentes
│           │   ├── auth/  lots/  auction-room/  wallet/  bids/
│           │   └── seller/  audit/  receipts/  realtime/
│           ├── hooks/          # contagem regressiva, debounce
│           ├── lib/            # cliente HTTP, configuração de runtime, formatação, chaves de cache
│           └── types/          # contrato da API
```

Princípios aplicados:

- **Regra de negócio pura e testável.** `bid-rules.ts`, `anti-sniping.ts`, `hash-chain.ts`, `lot-status.ts` e `pseudonym.ts` são funções sem I/O, com testes unitários. Os serviços só orquestram banco e regras.
- **Um único ponto altera dinheiro:** `WalletLedger`. Todas as operações (lance, cancelamento, liquidação, depósito) recebem a transação do chamador, então cada caso de uso é atômico.
- **Camadas do back-end:** controller (HTTP e autorização) → service (caso de uso) → regras puras / ledger / Prisma. Módulos de domínio não conhecem Socket.IO: publicam por `RealtimeService`, **depois** do commit.
- **Camadas do front-end:** página fina → componente de _feature_ → hook (TanStack Query / socket) → `*-api.ts` (chamadas HTTP) → `lib/api-client`. O estado em tempo real é atualizado por funções puras (`lot-room-state.ts`, testadas).
- **Banco como última linha de defesa:** `CHECK` constraints (saldo ≥ 0, 0 ≤ comprometido ≤ saldo, valores positivos, janela de tempo coerente), chaves estrangeiras `RESTRICT`, unicidade `(lote, sequência)`.

### Modelo de dados

`User` (papel `AUCTIONEER`/`BIDDER`) → `Wallet` (saldo total + comprometido) → `WalletTransaction` (extrato) · `Lot` (snapshot do item + regras + resumo dos lances) → `Bid` (cadeia de hashes) · `Receipt` (comprovante selado, 1 por lote vendido).

Todos os valores monetários são **inteiros em centavos** (nunca ponto flutuante). Datas em UTC.

---

## 6. Requisitos do desafio: onde cada um está

| Requisito do PDF | Situação | Onde |
|---|---|---|
| Deploy obrigatório | ✅ Northflank (2 serviços + 1 banco gerenciado); link no topo | seção 13 |
| Dois papéis (leiloeiro não dá lances) | ✅ | `common/auth`, `@Roles(...)`; UI esconde o que não cabe ao perfil |
| Itens vindos de **API pública** | ✅ Cleveland Museum of Art Open Access | `modules/catalog` |
| Lote com lance inicial, incremento, início/fim e outros campos | ✅ (+ título e observações opcionais) | `modules/lots`, `features/seller` |
| Vitrine: ao vivo / agendados / encerrados; cancelados fora | ✅ | `GET /lots`, `features/lots/showcase.tsx` |
| Painel do leiloeiro: buscar na API, criar lote, cancelar, resultado e total recebido | ✅ | `features/seller`, `GET /seller/*` |
| Sala ao vivo: lance atual, histórico, posição, contagem regressiva, "ganhando/superado", sem recarregar | ✅ | `features/auction-room` + Socket.IO |
| Carteira: total, comprometido, disponível, depósito simulado | ✅ | `features/wallet`, `modules/wallet` |
| Meus arremates com comprovante e link de compartilhamento | ✅ | `features/bids`, `features/receipts` |
| Página de auditoria pública, informa íntegro/adulterado | ✅ | `features/audit`, `GET /audit/lots/:id` |
| Mensagens claras para lance recusado (5 motivos) | ✅ (+ lote cancelado) | `bids/bid-rules.ts` |
| API externa instável não derruba o app | ✅ | seção 8 |
| Primeiro lance ≥ inicial; seguintes ≥ atual + incremento; líder não cobre a si mesmo | ✅ | `bids/bid-rules.ts` (testado) |
| Saldo comprometido (disponível = total − comprometido) | ✅ | `wallet/wallet-ledger.ts` |
| Anti-sniping: lance nos últimos 2 min → fim = +2 min | ✅ | `bids/anti-sniping.ts` |
| Liquidação: debita vencedor, credita leiloeiro, gera comprovante; sem lances = sem vencedor | ✅ | `settlement/` |
| Histórico à prova de adulteração (mesmo direto no banco) **e explicar** | ✅ | seção 7, `integrity/hash-chain.ts` |
| Privacidade (auditoria e comprovante sem dados pessoais) | ✅ pseudônimos por lote | `integrity/pseudonym.ts` |
| React · Node ou Python · PostgreSQL/MySQL/NoSQL | ✅ Next.js · NestJS · PostgreSQL | seção 4 |
| Seed: 1 leiloeiro, 2 clientes, ≥ 1 lote com lances abertos | ✅ | seção 2 |
| README detalhado, comportamentos inesperados | ✅ | este arquivo, seção 7 |
| **Opcional** busca e filtro de lotes | ✅ | vitrine (busca, ordenação, abas) e acervo (busca, tipo) |
| **Opcional** cancelamento com estorno automático | ✅ | `LotsService.cancel` |
| **Opcional** Docker Compose | ✅ | `docker-compose.yml` |
| **Opcional** testes automatizados | ✅ | seção 12 |
| **Opcional** dark mode | ✅ | `components/layout/theme-toggle.tsx` |

---

## 7. Regras de negócio em detalhe

**Lance** (`POST /lots/:id/bids`, só licitante). Ordem de verificação, que define a mensagem vista:

1. lote **cancelado**;
2. lote **ainda não iniciado**;
3. lote **encerrado** (passou do fim ou já liquidado);
4. **você já está ganhando** (o líder não cobre o próprio lance);
5. **abaixo do mínimo**: primeiro lance ≥ lance inicial; seguintes ≥ lance atual + incremento mínimo;
6. **saldo insuficiente**: o lance precisa caber no saldo disponível.

**Saldo comprometido.** `disponível = saldo total − comprometido`. Ao assumir a liderança, o valor do lance fica comprometido; quando alguém cobre, o valor do líder anterior **volta ao disponível imediatamente** (mesma transação). O saldo total só muda no depósito e na liquidação.

**Anti-sniping.** Lance aceito quando faltam **2 minutos ou menos** muda o fim para **agora + 2 minutos** (nunca encurta). O fim original é preservado (`originalEndsAt`) e o lote é marcado como prorrogado.

**Liquidação.** Um agendador no servidor roda **a cada segundo**, independentemente de alguém estar com a página aberta. Ao encerrar um lote com lances: debita o vencedor (saldo e comprometido), credita o leiloeiro, grava o extrato e emite o comprovante, tudo na mesma transação com o lote travado (rodar duas vezes não liquida em duplicidade). Lote sem lances fecha **sem vencedor** e sem comprovante.

**Cancelamento.** O leiloeiro dono cancela lotes **agendados ou ao vivo**. Se já houver líder, o valor comprometido dele é **liberado automaticamente (estorno)** na mesma transação. Lotes cancelados somem da vitrine, mas o histórico continua auditável.

**Concorrência.** Cada lance roda em uma transação que trava, nesta ordem fixa, a linha do **lote** e depois as **carteiras** (ordenadas por id, o que evita deadlock). Dois lances simultâneos no mesmo lote são processados em fila; o teste de integração dispara dois lances idênticos ao mesmo tempo e confirma que exatamente um é aceito e que a soma do comprometido continua igual ao lance atual.

**Histórico à prova de adulteração.** Cada lance guarda um hash **HMAC-SHA256** calculado sobre os seus dados e sobre o hash do lance anterior, formando uma cadeia por lote. O resumo do lote (quantidade de lances, último hash, lance atual, líder e regras) e o comprovante têm um selo HMAC próprio. A auditoria recalcula tudo a partir do banco a cada consulta, então alterar, remover ou inserir um lance direto no banco quebra a cadeia ou o selo e o lote aparece como **Adulterado**. Usamos HMAC, e não um SHA-256 simples, porque o segredo (`AUDIT_SECRET`) fica fora do banco: quem só tem acesso ao banco não consegue recalcular os hashes. A liquidação reverifica a cadeia e não mexe em dinheiro de um lote adulterado.

**Comportamentos que podem surpreender:**

- O botão de lance fica ativo mesmo em lote agendado, encerrado ou cancelado, e quando você lidera. É proposital: o servidor recusa e a tela mostra o motivo exato.
- O status (agendado, ao vivo, encerrado) é calculado pela hora. Entre o fim do lote e a liquidação (cerca de 1 s) a sala mostra "Apurando o resultado…".
- Os pseudônimos mudam de lote para lote, para que ninguém rastreie a mesma pessoa entre leilões.
- Trocar o `AUDIT_SECRET` depois de existirem lances faz os lotes antigos aparecerem como adulterados. Defina-o uma vez e guarde.
- A API roda em **uma instância**: o tempo real e o agendador de liquidação vivem no próprio processo.
- Login e cadastro aceitam até 10 tentativas por minuto por IP; acima disso a API responde `429`.

---

## 8. Resiliência da API externa

- Fonte dos itens: **[Cleveland Museum of Art Open Access API](https://openaccess-api.clevelandart.org)** (domínio público, CC0, sem chave).
- Ao criar um lote, o **servidor** busca o item e grava um **snapshot** (título, artista, atributos, imagem, link). O cliente envia só o id do item, nunca os dados.
- **Vitrine, salas, auditoria e comprovante leem apenas o banco.** Se a API externa cair, nada disso muda.
- A **busca do leiloeiro** é a única parte que depende da API, e é protegida por: timeout (5 s), **cache** em memória (5 min), último resultado salvo se a API falhar e, por fim, um **acervo local reduzido** (19 obras reais em `fallback-catalog.ts`), com aviso na tela ("A API do acervo está indisponível…").
- As **imagens** continuam sendo carregadas do CDN do museu. Se ele estiver fora, a interface mostra um espaço reservado (nenhum ícone quebrado e nenhuma tela travada).
- Regenerar o acervo local: `cd apps/api && npx ts-node --transpile-only scripts/generate-fallback-catalog.ts`.

> A primeira ideia foi a API do Art Institute of Chicago, mas ela bloqueia requisições de servidor com um desafio anti-bot (Cloudflare); a do Cleveland não tem esse problema e é CC0.

---

## 9. API HTTP

Base: `http://localhost:4000` (local) ou a URL da API do deploy. Autenticação: `Authorization: Bearer <token>` (JWT obtido em login/cadastro). Valores em **centavos**.

| Método e rota | Acesso | Descrição |
|---|---|---|
| `POST /auth/register` · `POST /auth/login` | público | Cadastro (com perfil) e login; devolvem `{ accessToken, user }` |
| `GET /auth/me` | logado | Usuário atual |
| `GET /lots?status=live\|scheduled\|closed&q=&sort=&page=&pageSize=` | público | Vitrine (cancelados nunca aparecem). `sort`: `ending_soon`, `newest`, `most_bids` |
| `GET /lots/:id` | público (com token inclui `me`) | Sala do lote com histórico de lances |
| `POST /lots` | leiloeiro | Cria lote (servidor busca o snapshot do item) |
| `POST /lots/:id/cancel` | leiloeiro dono | Cancela (com estorno ao líder, se houver) |
| `POST /lots/:id/bids` | licitante | Dá lance `{ amountCents }` |
| `GET /catalog/items?q=&type=&page=` | leiloeiro | Busca no acervo externo (com plano B) |
| `GET /seller/lots` · `GET /seller/summary` | leiloeiro | Meus lotes e totais (inclui total recebido) |
| `GET /bidder/participations` | licitante | Meus arremates (ganhando/superado/vencido/…) |
| `GET /wallet` · `POST /wallet/deposit` | logado · licitante | Carteira e depósito simulado |
| `GET /audit/lots/:id` | **público** | Histórico + verificação de integridade |
| `GET /receipts/:code` | **público por link** | Comprovante + verificação |
| `GET /health` | público | Saúde da API e do banco |

**Formato de erro** (sempre o mesmo): `{ "statusCode": 422, "code": "BID_BELOW_MINIMUM", "message": "Lance abaixo do mínimo. …", "details": { … } }`.
`code` é para o programa; `message` já vem em português para o usuário. Códigos de recusa de lance: `LOT_CANCELED`, `LOT_NOT_STARTED`, `LOT_ENDED`, `ALREADY_LEADING`, `BID_BELOW_MINIMUM`, `INSUFFICIENT_BALANCE`.

Segurança: senhas com bcrypt; JWT; papéis verificados no servidor (a UI é só conveniência); validação rigorosa (campos desconhecidos são rejeitados); `helmet`; CORS restrito; limite de **10 tentativas/min por IP** em login/cadastro (600 req/min geral).

---

## 10. Variáveis de ambiente

O Compose funciona sem `.env`. Para um servidor público: `cp .env.example .env` e edite. Todas as variáveis estão comentadas em [`.env.example`](.env.example).

| Variável | Para quê |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Credenciais do banco do Compose |
| `JWT_SECRET` | Assina os logins (≥ 16 caracteres) |
| `AUDIT_SECRET` | Segredo do HMAC da cadeia de hashes e dos pseudônimos (≥ 16). **Defina uma vez e guarde** |
| `JWT_EXPIRES_IN` | Duração do login (padrão `7d`) |
| `CORS_ORIGINS` | Origem(ns) do front aceitas pela API |
| `NEXT_PUBLIC_API_URL` | **Docker Compose local:** URL da API como o navegador a vê. É embutida no build do front: ao mudar, rode `docker compose up --build` |
| `API_URL` | **Serviço `web` em produção (runtime):** URL pública da API, lida a cada requisição. Tem prioridade sobre `NEXT_PUBLIC_API_URL` e dispensa rebuild |
| `POSTGRES_URI` | **Serviço `api` na Northflank:** string de conexão do banco gerenciado. Se `DATABASE_URL` não existir, a API usa esta |
| `WEB_PORT` / `API_PORT` | Portas publicadas no host (só no compose local) |
| `SEED_ON_BOOT` | `true` cria os dados de demonstração a cada início |
| `CATALOG_API_URL` / `CATALOG_TIMEOUT_MS` | API externa de itens e timeout |

A API **não inicia** se alguma variável obrigatória estiver ausente ou inválida (falha rápida, com mensagem clara). Também se recusa a iniciar se `CORS_ORIGINS` apontar para um endereço público e algum segredo ainda for o valor de exemplo (`dev-only-…` ou `troque-…`).

---

## 11. Desenvolvimento sem Docker

Requer Node 22+. O Postgres vem do Compose, publicado só em `127.0.0.1`:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db

# API
cd apps/api
cp .env.example .env
npm ci
npx prisma migrate deploy        # aplica as migrations
npm run start:dev                # http://localhost:4000 (semeia a demonstração)

# Front (outro terminal)
cd apps/web
cp .env.example .env.local
npm ci
npm run dev                      # http://localhost:3000
```

Útil: `npm run seed` (cria o que faltar) e `npm run seed -- --reset` (**apaga tudo** e recria a demonstração) em `apps/api` após `npm run build`.

---

## 12. Testes

| Suíte | Comando | O que cobre |
|---|---|---|
| API, unitários | `cd apps/api && npm test` | Regras de lance (bordas de mínimo/saldo/início/fim, prioridade de mensagens), anti-sniping, cadeia de hashes (todos os tipos de adulteração), pseudônimos, status do lote |
| API, integração | `cd apps/api && npm run test:e2e` | Fluxo completo contra **PostgreSQL real** (veja abaixo) |
| Front | `cd apps/web && npm test` | Formatação de moeda/tempo, configuração de runtime e a lógica que aplica eventos em tempo real ao estado da sala |

**Integração** (23 testes): papéis, regras de lance, comprometido/liberado, **lances simultâneos**, cancelamento com estorno, anti-sniping, liquidação (idempotente), sem lances, comprovante público, auditoria, **adulteração direta no banco** (alterar lance, alterar regras do lote, remover último, inserir falso, comprovante), recusa de liquidar lote adulterado, ausência de dados pessoais nas respostas públicas e eventos WebSocket.

Ela usa um banco **separado** (`leilao_test`, criado e migrado automaticamente), nunca o da demonstração. Pré-requisito: um Postgres acessível, por exemplo:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
cd apps/api && npm ci && npm run test:e2e
# outro servidor: TEST_DATABASE_URL=postgresql://user:pass@host:5432/meu_banco_test npm run test:e2e
```

O nome do banco de teste precisa conter `test`, como trava de segurança.

---

## 13. Deploy na Northflank

A [Northflank](https://northflank.com) constrói as imagens direto do GitHub (usando os `Dockerfile` do projeto), publica cada serviço com **HTTPS automático** (domínio `*.code.run`) e oferece **PostgreSQL gerenciado**. O plano gratuito (_Developer Sandbox_) inclui **2 serviços, 1 banco e 2 jobs, sempre ligados**, dentro de até US$ 20/mês de recursos, conforme a [página de preços](https://northflank.com/pricing). A aplicação usa exatamente **2 serviços + 1 banco**:

```
GitHub (master) ─ build ─► [api] NestJS :4000 ───► [addon PostgreSQL 17]
                └ build ─► [web] Next.js :3000

Navegador ── HTTPS ──► web (https://…code.run)
          └─ HTTPS/WSS ► api (https://…code.run)
```

> O front lê o endereço da API em **tempo de execução** (variável `API_URL`, veja `apps/web/src/lib/env.ts`), então a mesma imagem serve em qualquer ambiente e o endereço da API pode ser definido **depois** de criada. Nenhum _build argument_ é necessário.
