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

## Sumário

1. [Como rodar (um comando)](#1-como-rodar-um-comando)
2. [Contas de demonstração](#2-contas-de-demonstração) (resumo em [Acessos para avaliação](#acessos-para-avaliação))
3. [Roteiro de teste (5 minutos)](#3-roteiro-de-teste-5-minutos)
4. [Stack e por quê](#4-stack-e-por-quê)
5. [Arquitetura e organização do código](#5-arquitetura-e-organização-do-código)
6. [Requisitos do desafio: onde cada um está](#6-requisitos-do-desafio-onde-cada-um-está)
7. [Histórico à prova de adulteração (a técnica)](#7-histórico-à-prova-de-adulteração-a-técnica)
8. [Regras de negócio em detalhe](#8-regras-de-negócio-em-detalhe)
9. [Resiliência da API externa](#9-resiliência-da-api-externa)
10. [Tempo real](#10-tempo-real)
11. [Privacidade](#11-privacidade)
12. [API HTTP](#12-api-http)
13. [Variáveis de ambiente](#13-variáveis-de-ambiente)
14. [Desenvolvimento sem Docker](#14-desenvolvimento-sem-docker)
15. [Testes](#15-testes)
16. [Comportamentos inesperados, decisões e limitações](#16-comportamentos-inesperados-decisões-e-limitações)
17. [Deploy na Northflank](#17-deploy-na-northflank)
18. [Uso de IA](#18-uso-de-ia)
19. [Créditos](#19-créditos)

---

## 1. Como rodar (um comando)

Pré-requisito: **Docker** com Compose v2 (`docker compose version`). Nada mais precisa estar instalado.

```bash
git clone <url-do-repositorio>
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
2. A **API** aplica as migrations (`prisma migrate deploy`), inicia e **semeia os dados de demonstração** (veja a seção 2).
3. O **front** inicia quando a API está saudável.

Não é preciso criar `.env`: o `docker-compose.yml` traz valores padrão seguros **para desenvolvimento local**. Para qualquer ambiente público, copie `.env.example` para `.env` e **troque os segredos** (seção 13).

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
(e ajuste `NEXT_PUBLIC_API_URL`/`CORS_ORIGINS`, veja a seção 13).

---

## 2. Contas de demonstração

O seed (executado a cada início quando `SEED_ON_BOOT=true`, o padrão do Compose) cria:

| Perfil | E-mail | Senha | Saldo inicial |
|---|---|---|---|
| Leiloeiro | `leiloeiro@leilao.dev` | `senha123` | R$ 0,00 |
| Licitante 1 (Ana) | `licitante1@leilao.dev` | `senha123` | R$ 100.000,00 |
| Licitante 2 (Bruno) | `licitante2@leilao.dev` | `senha123` | R$ 100.000,00 |

E os lotes:

- **Dois lotes ao vivo com lances abertos** (um com disputa entre Ana e Bruno, outro liderado por Bruno);
- **Um lote agendado** (começa em 1 hora);
- **Um lote já encerrado e liquidado**, com comprovante emitido (arrematado pela Ana).

O seed é **idempotente** e usa os mesmos caminhos do sistema real (lances passam pela regra de lance, a liquidação passa pela liquidação), então a cadeia de hashes, os saldos comprometidos e o comprovante dos dados de demonstração são genuínos. Se todos os lotes abertos já terminaram (por exemplo, a demonstração ficou parada por dias), **o próximo início cria lotes novos**, para que sempre exista algo ao vivo para testar.

Para recomeçar do zero: `docker compose down -v && docker compose up --build`.

---

## 3. Roteiro de teste (5 minutos)

Use **duas janelas** (uma anônima) para ver o tempo real.

1. Abra http://localhost:3000. Sem login você já vê a vitrine (**Ao vivo / Agendados / Encerrados**), busca e ordenação.
2. **Janela A:** entre como `licitante1@leilao.dev` e abra o lote _Virgin and Child in a Landscape_. Você verá **"Você está ganhando!"**, a contagem regressiva e o histórico.
3. **Janela B:** entre como `licitante2@leilao.dev`, abra o mesmo lote e dê um lance.
   - Na **janela A**, sem recarregar, aparece **"Você foi superado"**, o lance atual muda e o saldo comprometido volta ao disponível.
4. **Mensagens de recusa:** na janela B tente um lance muito baixo (**abaixo do mínimo**), um valor maior que seu saldo (**saldo insuficiente**), cobrir o próprio lance (**você já está ganhando**), e dê lance no lote agendado (**lote ainda não iniciado**) ou no encerrado (**lote encerrado**). Cada recusa explica o motivo.
5. **Carteira** (`/wallet`): saldo total, comprometido e disponível, e depósito simulado.
6. **Meus arremates** (`/my-bids`), logado como Ana: aba _Arrematados_ → **comprovante** e botão **Compartilhar link**. Abra o link numa janela anônima.
7. **Auditoria pública** (`/audit/<id-do-lote>`, link "Auditar histórico" na sala): mostra a cadeia de hashes e o selo **Íntegro**.
8. **Adulterar de propósito** (seção 7.4): altere um lance direto no banco e recarregue a auditoria: ela passa a indicar **Adulterado** e aponta o lance.
9. **Leiloeiro** (`leiloeiro@leilao.dev`): `/seller/new` → busque no acervo (ex.: _monet_), selecione, defina lance inicial/incremento/horário (atalho "10 min") e publique. Em `/seller` veja o total recebido, o resultado dos encerrados e **cancele** lotes.
10. **Anti-sniping:** num lote que termina em menos de 2 minutos, um lance aceito prorroga o fim para "agora + 2 min" (o aviso "Lote prorrogado" aparece para quem está na sala).
11. **Dark mode:** botão de lua/sol no cabeçalho (segue o sistema por padrão).

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
| Infra | **Docker Compose** | `db` + `api` + `web` com um comando |

Os componentes em `apps/web/src/components/ui` são o código-fonte do padrão shadcn/ui (copiado e adaptado ao projeto, como o próprio shadcn recomenda), usando o pacote `radix-ui`.

---

## 5. Arquitetura e organização do código

```
.
├── docker-compose.yml          # db + api + web (um comando)
├── docker-compose.dev.yml      # override opcional: publica o Postgres em 127.0.0.1 (dev sem Docker)
├── .env.example                # variáveis do compose (funciona sem .env); produção: veja "Deploy na Northflank"
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
│           ├── lib/            # cliente HTTP, formatação, chaves de cache
│           └── types/          # contrato da API
```

Princípios aplicados:

- **Regra de negócio pura e testável.** `bid-rules.ts`, `anti-sniping.ts`, `hash-chain.ts`, `lot-status.ts` e `pseudonym.ts` são funções sem I/O, com testes unitários. Os serviços só orquestram banco + regras.
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
| Deploy obrigatório | Preparado para a **Northflank** (2 serviços + 1 banco gerenciado); guia na seção 17; link no topo após publicar | `apps/*/Dockerfile`, `lib/runtime-config.ts` |
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
| API externa instável não derruba o app | ✅ | seção 9 |
| Primeiro lance ≥ inicial; seguintes ≥ atual + incremento; líder não cobre a si mesmo | ✅ | `bids/bid-rules.ts` (testado) |
| Saldo comprometido (disponível = total − comprometido) | ✅ | `wallet/wallet-ledger.ts` |
| Anti-sniping: lance nos últimos 2 min → fim = +2 min | ✅ | `bids/anti-sniping.ts` |
| Liquidação: debita vencedor, credita leiloeiro, gera comprovante; sem lances = sem vencedor | ✅ | `settlement/` |
| Histórico à prova de adulteração (mesmo direto no banco) **e explicar** | ✅ | seção 7 |
| Privacidade (auditoria e comprovante sem dados pessoais) | ✅ | seção 11 |
| React · Node ou Python · PostgreSQL/MySQL/NoSQL | ✅ Next.js · NestJS · PostgreSQL | seção 4 |
| Seed: 1 leiloeiro, 2 clientes, ≥ 1 lote com lances abertos | ✅ | seção 2 |
| README detalhado, comportamentos inesperados | ✅ | este arquivo, seção 16 |
| **Opcional** busca e filtro de lotes | ✅ | vitrine (busca, ordenação, abas) e acervo (busca, tipo) |
| **Opcional** cancelamento com estorno automático | ✅ | `LotsService.cancel` |
| **Opcional** Docker Compose | ✅ | `docker-compose.yml` |
| **Opcional** testes automatizados | ✅ | seção 15 |
| **Opcional** dark mode | ✅ | `components/layout/theme-toggle.tsx` |

---

## 7. Histórico à prova de adulteração (a técnica)

### 7.1 Ideia

Cada lance guarda um **hash HMAC-SHA256** calculado sobre os seus dados **e sobre o hash do lance anterior**, formando uma **cadeia por lote**:

```
GENESIS ──► lance #1 ──► lance #2 ──► lance #3 ...
            hash₁         hash₂         hash₃
hashₙ = HMAC(AUDIT_SECRET, "bid|v1|lote|nº|licitante|valor|instante|hashₙ₋₁")
```

A auditoria **recalcula tudo a partir do banco, a cada consulta**, e compara. Isso detecta:

| Adulteração direta no banco | Como é detectada |
|---|---|
| Alterar valor, autor ou instante de um lance | O hash recalculado não bate (`BID_HASH_MISMATCH`, aponta o lance) |
| Remover um lance do meio | Numeração com buraco e encadeamento quebrado (`SEQUENCE_GAP`, `CHAIN_LINK_BROKEN`) |
| Inserir um lance falso | Não há hash válido sem o segredo; numeração/encadeamento não fecham |
| Remover os **últimos** lances | A cadeia continua consistente, mas o **resumo do lote** (contagem, hash da cabeça, lance atual, líder) não bate (`LOT_SUMMARY_MISMATCH`) |
| Reescrever o resumo do lote para "fechar" com a remoção | O resumo é protegido por um **selo HMAC** (`chainSeal`); sem o segredo não dá para refazê-lo (`LOT_SEAL_MISMATCH`) |
| Alterar as regras do lote (lance inicial, incremento, início, fim, leiloeiro), por exemplo desfazer uma prorrogação | Esses campos também entram no selo do lote (`LOT_SEAL_MISMATCH`) |
| Alterar o resultado gravado na liquidação (vencedor, preço final) | Conferido contra o último lance da cadeia (`LOT_RESULT_MISMATCH`) |
| Alterar o comprovante (preço, vencedor…) | Selo HMAC do comprovante e conferência cruzada com o lote (`RECEIPT_SEAL_MISMATCH`, `RECEIPT_LOT_MISMATCH`) |

### 7.2 Por que HMAC e não um SHA-256 simples

Com SHA-256 puro, quem tem acesso ao banco altera um lance e **recalcula todos os hashes seguintes** (a fórmula é pública). Com **HMAC**, o recálculo exige o `AUDIT_SECRET`, que fica **fora do banco** (variável de ambiente da API). Quem só tem o banco não consegue "consertar" a cadeia.

### 7.3 Proteção extra e limites (honestidade)

- A **liquidação reverifica a cadeia** antes de mexer em dinheiro: um lote adulterado **não é liquidado automaticamente** (fica registrado no log para revisão).
- **Limite 1: o segredo.** Quem obtiver o `AUDIT_SECRET` _e_ o banco consegue forjar. É a premissa de qualquer MAC: proteja o segredo. Trocar o segredo depois de existirem lances faz **todos** os lotes antigos aparecerem como adulterados (veja a seção 16).
- **Limite 2: reversão para um estado antigo e válido.** Um atacante que restaure o banco inteiro (lances, resumo e selo) para um instante anterior produz um estado internamente consistente. Para cobrir isso seria necessário um **âncora externa** (por exemplo, publicar periodicamente o hash da cabeça em outro sistema). A página de auditoria e o comprovante exibem o **hash da cabeça da cadeia**, que o participante pode guardar e comparar depois.
- A verificação é feita **no servidor** (o segredo não sai de lá). A página mostra cada hash e o hash anterior para conferência visual.

### 7.4 Como ver a detecção acontecendo

Com o Compose rodando, pegue o id de um lote com lances (copie da URL da sala) e adultere um lance:

```bash
LOT=<id-do-lote>
# 1) adultera o valor do lance #1 direto no banco
docker compose exec db psql -U leilao -d leilao -c \
  "UPDATE \"Bid\" SET \"amountCents\" = 1 WHERE \"lotId\" = '$LOT' AND sequence = 1;"

# 2) a auditoria agora acusa (UI: /audit/$LOT, ou via API)
curl -s localhost:4000/audit/lots/$LOT | head -c 600     # "status":"TAMPERED", BID_HASH_MISMATCH, sequence 1

# 3) restaure o valor original (160000 no lote de demonstração) e ela volta a "INTACT"
docker compose exec db psql -U leilao -d leilao -c \
  "UPDATE \"Bid\" SET \"amountCents\" = 160000 WHERE \"lotId\" = '$LOT' AND sequence = 1;"
```

Os mesmos cenários (alterar, remover o último, inserir falso, adulterar comprovante) estão cobertos nos testes de integração.

---

## 8. Regras de negócio em detalhe

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

---

## 9. Resiliência da API externa

- Fonte dos itens: **[Cleveland Museum of Art Open Access API](https://openaccess-api.clevelandart.org)** (domínio público, CC0, sem chave).
- Ao criar um lote, o **servidor** busca o item e grava um **snapshot** (título, artista, atributos, imagem, link). O cliente envia só o id do item, nunca os dados.
- **Vitrine, salas, auditoria e comprovante leem apenas o banco.** Se a API externa cair, nada disso muda.
- A **busca do leiloeiro** é a única parte que depende da API, e é protegida por: timeout (5 s), **cache** em memória (5 min), último resultado salvo se a API falhar e, por fim, um **acervo local reduzido** (19 obras reais em `fallback-catalog.ts`), com aviso na tela ("A API do acervo está indisponível…").
- As **imagens** continuam sendo carregadas do CDN do museu. Se ele estiver fora, a interface mostra um espaço reservado (nenhum ícone quebrado e nenhuma tela travada).
- Regenerar o acervo local: `cd apps/api && npx ts-node --transpile-only scripts/generate-fallback-catalog.ts`.

> Observação: a primeira ideia foi a API do Art Institute of Chicago, mas ela bloqueia requisições de servidor com um desafio anti-bot (Cloudflare); a do Cleveland não tem esse problema e é CC0.

---

## 10. Tempo real

Socket.IO no namespace `/realtime`. Qualquer cliente (inclusive anônimo) entra na sala do lote (`lot:join`); com login, entra também na sala privada do usuário.

| Evento | Destino | Conteúdo |
|---|---|---|
| `lot:bid` | sala do lote | novo lance, lance atual, líder (pseudônimo), novo fim, se houve prorrogação |
| `lot:closed` | sala do lote | resultado final (vendido/sem lances, preço, vencedor) |
| `lot:canceled` | sala do lote | lote cancelado |
| `wallet:updated` | privado | saldo total / comprometido / disponível |
| `bid:outbid` | privado | "você foi superado" (vira um aviso na tela) |

Os eventos são emitidos **só depois do commit** da transação. Se o WebSocket cair, a sala faz **leituras periódicas** e, ao reconectar, ressincroniza por HTTP, então nenhum evento perdido deixa a tela errada. A contagem regressiva usa o **relógio do servidor** (diferença calculada a cada resposta), não o do navegador.

---

## 11. Privacidade

- A auditoria e o comprovante identificam pessoas por **pseudônimos** (`Licitante 3FA9C2`, `Leiloeiro 51338A`): HMAC com segredo do servidor.
- O pseudônimo é **diferente em cada lote**: ninguém consegue rastrear a mesma pessoa entre leilões.
- Nenhum endpoint público devolve e-mail, nome ou id de usuário (os testes de integração verificam que esses valores não aparecem nas respostas públicas).
- A situação do próprio usuário (`me`) só vai para ele, com autenticação.

---

## 12. API HTTP

Base: `http://localhost:4000`. Autenticação: `Authorization: Bearer <token>` (JWT obtido em login/cadastro). Valores em **centavos**.

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

## 13. Variáveis de ambiente

O Compose funciona sem `.env`. Para produção: `cp .env.example .env` e edite. Todas as variáveis estão comentadas em [`.env.example`](.env.example).

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

A API **não inicia** se alguma variável obrigatória estiver ausente ou inválida (falha rápida, com mensagem clara).

---

## 14. Desenvolvimento sem Docker

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

## 15. Testes

| Suíte | Comando | O que cobre |
|---|---|---|
| API, unitários | `cd apps/api && npm test` | Regras de lance (bordas de mínimo/saldo/início/fim, prioridade de mensagens), anti-sniping, cadeia de hashes (todos os tipos de adulteração), pseudônimos, status do lote |
| API, integração | `cd apps/api && npm run test:e2e` | Fluxo completo contra **PostgreSQL real** (veja abaixo) |
| Front | `cd apps/web && npm test` | Formatação de moeda/tempo e a lógica que aplica eventos em tempo real ao estado da sala |

**Integração** (23 testes): papéis, regras de lance, comprometido/liberado, **lances simultâneos**, cancelamento com estorno, anti-sniping, liquidação (idempotente), sem lances, comprovante público, auditoria, **adulteração direta no banco** (alterar lance, alterar regras do lote, remover último, inserir falso, comprovante), recusa de liquidar lote adulterado, ausência de dados pessoais nas respostas públicas e eventos WebSocket.
Ela usa um banco **separado** (`leilao_test`, criado e migrado automaticamente), nunca o da demonstração. Pré-requisito: um Postgres acessível, por exemplo:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
cd apps/api && npm ci && npm run test:e2e
# outro servidor: TEST_DATABASE_URL=postgresql://user:pass@host:5432/meu_banco_test npm run test:e2e
```

(O nome do banco de teste precisa conter `test`, como trava de segurança.)

---

## 16. Comportamentos inesperados, decisões e limitações

Para evitar surpresas, estas são as escolhas e armadilhas conhecidas:

1. **Anti-sniping = "agora + 2 min".** O enunciado diz "estende o fim do lote para +2 minutos"; interpretei como o fim passando a ser _o instante do lance + 2 minutos_ (assim o lote sempre tem 2 minutos de disputa após um lance tardio). Nunca encurta.
2. **Cancelamento: básico + opcional.** O básico pede cancelar lote que ainda não recebeu lances; o opcional pede "cancelamento com estorno automático". Os dois estão implementados: sem lances, o lote é só cancelado; com lances, o valor comprometido do líder é estornado na mesma transação. A janela de confirmação avisa qual dos dois casos vai acontecer. Lotes encerrados não podem ser cancelados.
3. **O botão de lance fica ativo mesmo em lote agendado/encerrado/cancelado, ou quando você lidera.** É proposital: o servidor recusa e a tela mostra o **motivo exato** (requisito de feedback). O servidor é quem decide, a UI não "adivinha".
4. **Status derivado do tempo.** `Agendado/Ao vivo/Encerrado` não é gravado: é calculado pela hora. Entre o fim do lote e a liquidação (≈ 1 s) a sala mostra "Apurando o resultado…".
5. **Pseudônimos mudam de lote para lote.** A mesma pessoa aparece com nomes diferentes em lotes diferentes (privacidade). Dentro de um lote, o pseudônimo é estável.
6. **Trocar o `AUDIT_SECRET` com dados existentes** faz todos os lotes antigos aparecerem como **adulterados** (os hashes foram feitos com o segredo anterior). Defina-o uma vez e guarde. No Compose de demonstração isso não ocorre, pois o padrão é fixo.
7. **Segredos padrão do Compose são só para desenvolvimento.** Em qualquer ambiente público troque `JWT_SECRET`, `AUDIT_SECRET` e `POSTGRES_PASSWORD`. Como proteção, a API **se recusa a iniciar** se `CORS_ORIGINS` apontar para um endereço que não seja `localhost` e algum desses segredos ainda for o valor de exemplo (`dev-only-…` ou `troque-…`).
   Se você já tinha um banco local criado por uma versão anterior do projeto, recrie-o (`docker compose down -v`): o formato do selo do lote mudou e os lotes antigos apareceriam como adulterados.
8. **Seed a cada início** (`SEED_ON_BOOT=true`): cria contas/lotes que faltarem e, se não houver lote aberto, novos lotes de demonstração. Para produção "limpa" use `SEED_ON_BOOT=false`.
9. **Início no passado:** ao criar um lote, um início até 5 min no passado (relógio do navegador desregulado) vira "agora"; além disso é recusado. Duração mínima de 1 minuto e máxima de 30 dias.
10. **Limites de valores:** lance e depósito até R$ 1.000.000,00 por operação; saldo total até R$ 10.000.000,00 (limites do tipo inteiro do banco, com folga).
11. **Uma instância da API.** O tempo real (Socket.IO) e o agendador de liquidação rodam no próprio processo. Para várias réplicas seria preciso um adaptador Redis para o Socket.IO e eleição do agendador (a liquidação em si já é segura contra duplicidade).
12. **Login guardado no `localStorage`.** Escolha pela simplicidade com front e API em origens diferentes; fica exposto a XSS (o app não renderiza HTML de terceiros). Em produção real, cookies `HttpOnly` + CSRF seriam o próximo passo.
13. **Sem recuperação de senha, nota fiscal, revenda ou app nativo** (fora de escopo, conforme o PDF). Pagamentos são **simulados**.
14. **Horários na tela** seguem o fuso do navegador; no banco/API são UTC.
15. **Limite de tentativas** em login/cadastro (10/min por IP): testes automatizados repetidos podem receber `429`.
16. **Imagens** vêm do CDN do museu; sem internet elas não carregam (a interface mostra um espaço reservado). A busca do leiloeiro usa o acervo local reduzido nesse caso.
17. **Listas longas:** o histórico de lances de um lote é devolvido por inteiro (adequado ao porte do desafio); a vitrine é paginada.

---

## 17. Deploy na Northflank

A [Northflank](https://northflank.com) constrói as imagens direto do GitHub (usando os `Dockerfile` do projeto), publica cada serviço com **HTTPS automático** (domínio `*.code.run`) e oferece **PostgreSQL gerenciado**. O plano gratuito (_Developer Sandbox_) inclui **2 serviços, 1 banco e 2 jobs, sempre ligados**, dentro de até US$ 20/mês de recursos, conforme a [página de preços](https://northflank.com/pricing). A aplicação usa exatamente **2 serviços + 1 banco**:

```
GitHub (master) ─ build ─► [api] NestJS :4000 ───► [addon PostgreSQL]
                └ build ─► [web] Next.js :3000

Navegador ── HTTPS ──► web (https://…code.run)
          └─ HTTPS/WSS ► api (https://…code.run)
```

Sem Vercel + banco gratuito porque a API precisa de um processo **sempre ligado** (agendador de liquidação e WebSocket) e de um banco que não durma nem expire; aqui os dois ficam sempre ativos.

> O front lê o endereço da API em **tempo de execução** (variável `API_URL`, veja `apps/web/src/lib/env.ts`), então a mesma imagem serve em qualquer ambiente e o endereço da API pode ser definido **depois** de criada. Nenhum _build argument_ é necessário.

### 17.1 Antes de começar

1. **O código precisa estar no GitHub.** A Northflank só enxerga o que foi enviado ao repositório conectado. Se, ao criar o serviço, aparecer _"No Dockerfile found"_, é porque o `git push` ainda não aconteceu (ou o caminho do Dockerfile está errado, passo 3).
   ```bash
   git add . && git commit -m "Casa de Leilões" && git push origin master
   ```
2. **Gere dois segredos** (cada um com 48+ caracteres) e guarde-os:
   ```bash
   openssl rand -base64 48   # JWT_SECRET
   openssl rand -base64 48   # AUDIT_SECRET
   ```
   Os valores de exemplo do repositório (`dev-only-…`, `troque-…`) são **recusados** pela API quando o CORS aponta para um endereço público.

### 17.2 Passo a passo

**Passo 1: projeto.** _Create project_ (nome livre). Escolha a região mais próxima dos usuários (por exemplo, _Southamerica East_); a região **não pode ser alterada** depois.

**Passo 2: banco de dados.** _Create new → Addon → PostgreSQL_. Nome: `leilao-db`. Deixe as opções padrão (TLS ligado) e escolha o plano mais baixo. Espere o status _Running_. As migrations e os dados de demonstração são criados pela própria API no primeiro início.

**Passo 3: serviço `api`.** _Create new → Service → **Build and deploy a Git repo**_ (aba _Combined_).

| Campo | Valor |
|---|---|
| Service name | `api` |
| Repository / Branch | seu repositório / `master` |
| Build type | **Dockerfile** |
| Build context | `/apps/api` |
| Dockerfile location | `/apps/api/Dockerfile` |
| Port | `4000`, protocolo **HTTP**, **Publicly expose** ligado |
| Health checks | HTTP `GET /health` na porta `4000` (readiness e liveness) |
| Resources | comece com **512 MB** de memória (veja 17.4) |

Variáveis de runtime: crie um **Secret group** (_Secrets → Create secret group_), por exemplo `api-env`, com as variáveis abaixo, e ative **Apply to specific services** para o `api`:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `JWT_SECRET` | o primeiro segredo gerado |
| `AUDIT_SECRET` | o segundo segredo gerado |
| `CORS_ORIGINS` | `http://localhost:3000` por enquanto (ajustado no passo 5) |
| `SEED_ON_BOOT` | `true` (cria contas e lotes de demonstração para a avaliação) |
| `POSTGRES_URI` | **não digite**: em _Linked addons_ do secret group, vincule o addon `leilao-db` e selecione a **connection string `POSTGRES_URI`** |

A API usa `POSTGRES_URI` como `DATABASE_URL` automaticamente (`apps/api/docker-entrypoint.sh`). Crie o serviço; quando o build terminar, copie a **URL pública** exibida no topo do serviço (algo como `https://p01--api--xxxx.code.run`) e confira `…/health` no navegador (deve responder `{"status":"ok",…}`).

**Passo 4: serviço `web`.** Mesmo caminho, com:

| Campo | Valor |
|---|---|
| Service name | `web` |
| Build context | `/apps/web` |
| Dockerfile location | `/apps/web/Dockerfile` |
| Port | `3000`, protocolo **HTTP**, **Publicly expose** ligado |
| Health checks | HTTP `GET /` na porta `3000` |
| Resources | 512 MB (ou o menor plano que sobrar no orçamento) |
| Runtime variable `API_URL` | a URL pública da API **sem barra no final** (`https://p01--api--xxxx.code.run`) |

**Passo 5: liberar o CORS.** Copie a URL pública do `web` (`https://p01--web--yyyy.code.run`), edite o secret group `api-env` e troque `CORS_ORIGINS` por ela (exatamente essa origem: `https`, sem barra no final). A Northflank reinicia a `api` com o novo valor.

**Passo 6: testar.** Abra a URL do `web`, entre com `licitante1@leilao.dev` / `senha123` e siga o roteiro da seção 3. Cole a URL do `web` em **Link do deploy**, no topo deste README.

### 17.3 Atualizar e operar

- **Deploy contínuo:** com _Continuous integration_ ligado (padrão), cada `git push` na `master` gera novo build e publica sozinho.
- **Logs e métricas:** abas _Logs_ e _Metrics_ de cada serviço (as liquidações aparecem no log da `api`).
- **Backup do banco:** no addon, aba _Backups_ (a Northflank faz dumps e restaurações pela interface).
- **Adulteração de propósito (seção 7.4) em produção:** conecte-se ao banco pelo proxy da CLI da Northflank (`northflank forward addon`, veja a documentação) e rode o `UPDATE` no `psql` local.
- **Dados de demonstração:** as senhas das contas de demonstração são públicas (`senha123`). Após a avaliação, defina `SEED_ON_BOOT=false` se for manter o ambiente no ar.
- **`AUDIT_SECRET`:** guarde-o e **nunca o troque** com dados existentes (os lotes antigos passariam a aparecer como adulterados, seção 16).

### 17.4 Plano gratuito e dimensionamento

- O Sandbox limita o total a **2 serviços e 1 banco** (é tudo o que usamos) e a **US$ 20/mês em recursos**. O formulário mostra a estimativa de custo de cada serviço; escolha planos pequenos para que a soma de `api` + `web` + banco caiba no orçamento.
- O build roda na infraestrutura da Northflank, **não** consome a memória do serviço.
- Se um serviço reiniciar sozinho com _out of memory_ (veja _Logs_/_Events_), aumente a memória dele. A `api` (NestJS + Prisma) precisa de mais que o `web`; comece com 512 MB.
- Valores e limites de plano mudam: confira sempre na página de preços e nos formulários da Northflank.

### 17.5 Problemas comuns

| Sintoma | Causa provável e solução |
|---|---|
| _No Dockerfile found_ ao criar o serviço | O código não foi enviado ao GitHub, ou **Build context** / **Dockerfile location** estão como `/` e `/Dockerfile`. Use `/apps/api` + `/apps/api/Dockerfile` (ou `/apps/web` + `/apps/web/Dockerfile`) |
| `api` reinicia em loop com _Configuração de ambiente inválida_ | Falta `JWT_SECRET`/`AUDIT_SECRET`, têm menos de 16 caracteres, ou ainda estão com o valor de exemplo (`dev-only-…`/`troque-…`) |
| `api` não conecta ao banco | O addon não está vinculado ao secret group (falta `POSTGRES_URI`), ou o secret group não foi aplicado ao serviço. Se o erro mencionar SSL/certificado, defina `DATABASE_URL` (tem prioridade sobre `POSTGRES_URI`) com a mesma string acrescida de `?sslmode=require` e, se o erro for de certificado, `&sslaccept=accept_invalid_certs` (parâmetros de conexão do Prisma; use `&` no lugar de `?` se a string já tiver parâmetros) |
| Front abre, mas "Não foi possível falar com o servidor" | `API_URL` incorreta (com barra no final, `http` em vez de `https`, serviço errado). Corrija e reinicie o `web`: não precisa de novo build |
| Erro de CORS no console do navegador | `CORS_ORIGINS` na `api` não é **exatamente** a URL do `web` |
| Badge "Reconectando…" na sala do lote | O front cai para _long-polling_ se o WebSocket falhar, mas confira se a porta da `api` está como **HTTP** e **pública** |
| Lotes antigos aparecem como "Adulterado" | O `AUDIT_SECRET` foi trocado depois que os lances existiam |
| Muitas tentativas de login seguidas retornam `429` | Limite de 10 tentativas/min por IP em login/cadastro |

### 17.6 Docker Compose local (desenvolvimento e testes)

Para rodar tudo na sua máquina continua valendo `docker compose up --build` (seção 1). Esse caminho usa `NEXT_PUBLIC_API_URL`, embutida no build, e não depende da Northflank.

---

## 18. Uso de IA

O projeto foi desenvolvido com o assistente de IA **Kiro**, em sessão guiada por mim: definição da stack e do deploy, modelagem, implementação do back-end e do front-end, testes e este README.

O que a IA fez: escreveu a maior parte do código, dos testes e da documentação a partir dos requisitos do PDF e das decisões acordadas. O que foi verificado na prática (não só "gerado"): build e typecheck dos dois apps; testes unitários e de integração contra PostgreSQL real; subida completa pelo Docker Compose; roteiro manual com navegador real (dois usuários em tempo real, recusas de lance, carteira, comprovante, auditoria pública, criação e cancelamento de lote); e adulteração direta no banco confirmando a detecção. As decisões de interpretação do enunciado estão listadas na seção 16.

> **Ajuste esta seção** antes de enviar o formulário: descreva com as suas palavras o que você revisou e alterou.

---

## 19. Créditos

- Itens dos leilões: [Cleveland Museum of Art Open Access](https://www.clevelandart.org/open-access) (CC0).
- Componentes de interface baseados no padrão [shadcn/ui](https://ui.shadcn.com) e [Radix UI](https://www.radix-ui.com); ícones [Lucide](https://lucide.dev).
- Projeto de demonstração para o processo seletivo Elite Dev (Verzel). Nenhum pagamento é real.
