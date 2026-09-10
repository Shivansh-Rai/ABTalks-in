-- T-228: recruiter credits, as an append-only ledger, plus the runtime
-- configuration table that holds the numbers so changing them is a row edit
-- rather than a deployment.
--
-- Purely additive: three new tables and one new type. No existing column is
-- altered and no existing row is touched.

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('GRANT_ONBOARDING', 'PURCHASE', 'UNLOCK_CONTACT', 'ADMIN_ADJUSTMENT', 'REFUND');

-- CreateTable
CREATE TABLE "PlatformConfig" (
    "key" TEXT NOT NULL,
    "intValue" INTEGER,
    "stringValue" TEXT,
    "description" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CreditAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
    "lifetimeSpent" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "reconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recruiterUserId" TEXT NOT NULL,
    "candidateUserId" TEXT,
    "amount" INTEGER NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditAccount_organizationId_key" ON "CreditAccount"("organizationId");

-- CreateIndex
CREATE INDEX "CreditAccount_balance_idx" ON "CreditAccount"("balance" DESC);

-- CreateIndex
-- The constraint that makes double-granting and double-charging structurally
-- impossible rather than merely unlikely.
CREATE UNIQUE INDEX "CreditTransaction_idempotencyKey_key" ON "CreditTransaction"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_seq_key" ON "CreditTransaction"("seq");

-- CreateIndex
CREATE INDEX "CreditTransaction_organizationId_seq_idx" ON "CreditTransaction"("organizationId", "seq" DESC);

-- CreateIndex
CREATE INDEX "CreditTransaction_recruiterUserId_createdAt_idx" ON "CreditTransaction"("recruiterUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CreditTransaction_candidateUserId_idx" ON "CreditTransaction"("candidateUserId");

-- CreateIndex
CREATE INDEX "CreditTransaction_type_createdAt_idx" ON "CreditTransaction"("type", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_recruiterUserId_fkey" FOREIGN KEY ("recruiterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
