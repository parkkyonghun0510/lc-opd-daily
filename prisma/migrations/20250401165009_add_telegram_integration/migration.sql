-- CreateTable
CREATE TABLE "TelegramSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "username" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLinkingCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLinkingCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramSubscription_userId_key" ON "TelegramSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramSubscription_chatId_key" ON "TelegramSubscription"("chatId");

-- CreateIndex
CREATE INDEX "TelegramSubscription_userId_idx" ON "TelegramSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLinkingCode_code_key" ON "TelegramLinkingCode"("code");

-- CreateIndex
CREATE INDEX "TelegramLinkingCode_userId_idx" ON "TelegramLinkingCode"("userId");

-- CreateIndex
CREATE INDEX "TelegramLinkingCode_expiresAt_idx" ON "TelegramLinkingCode"("expiresAt");

-- AddForeignKey
ALTER TABLE "TelegramSubscription" ADD CONSTRAINT "TelegramSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLinkingCode" ADD CONSTRAINT "TelegramLinkingCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
