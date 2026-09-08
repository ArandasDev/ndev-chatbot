-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('DISCORD', 'TWITCH');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('DISCORD', 'TWITCH');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatar" TEXT,
    "twitchId" TEXT,
    "twitchLogin" TEXT,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLogin" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guilds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "prefix" TEXT NOT NULL DEFAULT '!',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twitch_channels" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "displayName" TEXT,
    "twitchUserId" TEXT,
    "prefix" TEXT NOT NULL DEFAULT '!',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twitch_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownSec" INTEGER NOT NULL DEFAULT 5,
    "modOnly" BOOLEAN NOT NULL DEFAULT false,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "guildId" TEXT,
    "twitchChannelId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_alerts" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "message" TEXT NOT NULL DEFAULT '@here {channel} ficou online jogando {game}! {title} -> {url}',
    "twitchChannelId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "discordChannelId" TEXT NOT NULL,
    "wasLive" BOOLEAN NOT NULL DEFAULT false,
    "lastAnnouncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_credentials" (
    "id" TEXT NOT NULL DEFAULT 'twitch',
    "login" TEXT,
    "twitchUserId" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_logs" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "command_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_discordId_key" ON "users"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "users_twitchId_key" ON "users"("twitchId");

-- CreateIndex
CREATE UNIQUE INDEX "twitch_channels_login_key" ON "twitch_channels"("login");

-- CreateIndex
CREATE INDEX "twitch_channels_ownerId_idx" ON "twitch_channels"("ownerId");

-- CreateIndex
CREATE INDEX "commands_guildId_idx" ON "commands"("guildId");

-- CreateIndex
CREATE INDEX "commands_twitchChannelId_idx" ON "commands"("twitchChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "commands_guildId_name_key" ON "commands"("guildId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "commands_twitchChannelId_name_key" ON "commands"("twitchChannelId", "name");

-- CreateIndex
CREATE INDEX "live_alerts_twitchChannelId_idx" ON "live_alerts"("twitchChannelId");

-- CreateIndex
CREATE INDEX "live_alerts_guildId_idx" ON "live_alerts"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "live_alerts_twitchChannelId_guildId_discordChannelId_key" ON "live_alerts"("twitchChannelId", "guildId", "discordChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_tokens_userId_provider_key" ON "oauth_tokens"("userId", "provider");

-- CreateIndex
CREATE INDEX "command_logs_platform_scopeId_createdAt_idx" ON "command_logs"("platform", "scopeId", "createdAt");

-- CreateIndex
CREATE INDEX "command_logs_createdAt_idx" ON "command_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "twitch_channels" ADD CONSTRAINT "twitch_channels_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commands" ADD CONSTRAINT "commands_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commands" ADD CONSTRAINT "commands_twitchChannelId_fkey" FOREIGN KEY ("twitchChannelId") REFERENCES "twitch_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_alerts" ADD CONSTRAINT "live_alerts_twitchChannelId_fkey" FOREIGN KEY ("twitchChannelId") REFERENCES "twitch_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_alerts" ADD CONSTRAINT "live_alerts_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

