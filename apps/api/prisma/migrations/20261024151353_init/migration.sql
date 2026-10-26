-- CreateEnum
CREATE TYPE "Role" AS ENUM ('AUCTIONEER', 'BIDDER');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('DEPOSIT', 'PURCHASE_DEBIT', 'SALE_CREDIT');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "userId" UUID NOT NULL,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "committedCents" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "balanceAfterCents" INTEGER NOT NULL,
    "lotId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "startingBidCents" INTEGER NOT NULL,
    "minIncrementCents" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "originalEndsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "currentBidCents" INTEGER,
    "leaderId" UUID,
    "bidCount" INTEGER NOT NULL DEFAULT 0,
    "chainHeadHash" TEXT,
    "chainSeal" TEXT NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "winnerId" UUID,
    "finalPriceCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "bidderId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "lotId" UUID NOT NULL,
    "winnerId" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "finalPriceCents" INTEGER NOT NULL,
    "bidCount" INTEGER NOT NULL,
    "chainHeadHash" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "seal" TEXT NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_createdAt_idx" ON "WalletTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Lot_sellerId_createdAt_idx" ON "Lot"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "Lot_startsAt_idx" ON "Lot"("startsAt");

-- CreateIndex
CREATE INDEX "Lot_endsAt_idx" ON "Lot"("endsAt");

-- CreateIndex
CREATE INDEX "Lot_settledAt_canceledAt_endsAt_idx" ON "Lot"("settledAt", "canceledAt", "endsAt");

-- CreateIndex
CREATE INDEX "Bid_bidderId_lotId_idx" ON "Bid"("bidderId", "lotId");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_lotId_sequence_key" ON "Bid"("lotId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_code_key" ON "Receipt"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_lotId_key" ON "Receipt"("lotId");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Wallet"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Regras de integridade que o Prisma não modela: defesa em profundidade no
-- próprio banco (valem mesmo para quem escrever direto no PostgreSQL).
-- ---------------------------------------------------------------------------

-- Carteira: saldo nunca negativo e comprometido nunca maior que o saldo.
ALTER TABLE "Wallet"
  ADD CONSTRAINT "Wallet_balance_non_negative" CHECK ("balanceCents" >= 0),
  ADD CONSTRAINT "Wallet_committed_within_balance" CHECK ("committedCents" >= 0 AND "committedCents" <= "balanceCents");

-- Lote: valores positivos, janela de tempo coerente e contador de lances válido.
ALTER TABLE "Lot"
  ADD CONSTRAINT "Lot_starting_bid_positive" CHECK ("startingBidCents" > 0),
  ADD CONSTRAINT "Lot_min_increment_positive" CHECK ("minIncrementCents" > 0),
  ADD CONSTRAINT "Lot_time_window_valid" CHECK ("endsAt" > "startsAt" AND "endsAt" >= "originalEndsAt"),
  ADD CONSTRAINT "Lot_bid_count_non_negative" CHECK ("bidCount" >= 0);

-- Lance: valor positivo e sequência a partir de 1.
ALTER TABLE "Bid"
  ADD CONSTRAINT "Bid_amount_positive" CHECK ("amountCents" > 0),
  ADD CONSTRAINT "Bid_sequence_positive" CHECK ("sequence" >= 1);
