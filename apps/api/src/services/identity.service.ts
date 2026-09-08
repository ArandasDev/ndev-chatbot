import { env } from '@ndev/config';
import { conflict } from '@ndev/core';
import { prisma } from '@ndev/db';

/**
 * Regras de identidade multi-provedor.
 *
 * Um usuario pode nascer pelo Discord ou pela Twitch e depois vincular o outro
 * lado. As duas armadilhas desse modelo estao tratadas aqui:
 *
 *  1. Vincular uma conta que ja pertence a OUTRO usuario. Recusamos em vez de
 *     mesclar: mesclar duas contas com servidores e canais configurados e
 *     irreversivel, e um erro de clique nao pode custar isso.
 *  2. Perder o vinculo existente ao logar de novo pelo outro provedor. Por isso
 *     login sempre procura o usuario pelo id do provedor antes de criar.
 */

export interface DiscordIdentity {
  discordId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface TwitchIdentity {
  twitchId: string;
  twitchLogin: string;
  displayName: string;
  avatarUrl: string | null;
}

function isOwnerByDiscord(discordId: string): boolean {
  return env.ownerDiscordIds.includes(discordId);
}

function isOwnerByTwitch(login: string): boolean {
  return env.ownerTwitchLogins.includes(login.toLowerCase());
}

/** Login pelo Discord: acha pelo discordId ou cria um usuario novo. */
export async function loginWithDiscord(identity: DiscordIdentity) {
  const owner = isOwnerByDiscord(identity.discordId);

  return prisma.user.upsert({
    where: { discordId: identity.discordId },
    create: {
      discordId: identity.discordId,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      isOwner: owner,
    },
    update: {
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      // isOwner nunca e rebaixado por login: quem saiu de OWNER_DISCORD_IDS
      // pode ainda estar em OWNER_TWITCH_LOGINS.
      ...(owner ? { isOwner: true } : {}),
      lastLogin: new Date(),
    },
  });
}

/** Login pela Twitch: acha pelo twitchId ou cria um usuario novo. */
export async function loginWithTwitch(identity: TwitchIdentity) {
  const owner = isOwnerByTwitch(identity.twitchLogin);

  return prisma.user.upsert({
    where: { twitchId: identity.twitchId },
    create: {
      twitchId: identity.twitchId,
      twitchLogin: identity.twitchLogin,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      isOwner: owner,
    },
    update: {
      twitchLogin: identity.twitchLogin,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      ...(owner ? { isOwner: true } : {}),
      lastLogin: new Date(),
    },
  });
}

/** Vincula o Discord a uma conta que ja existe. */
export async function linkDiscord(userId: string, identity: DiscordIdentity) {
  const taken = await prisma.user.findUnique({ where: { discordId: identity.discordId } });
  if (taken && taken.id !== userId) {
    throw conflict('Esta conta do Discord já está vinculada a outro usuário do painel.');
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      discordId: identity.discordId,
      ...(isOwnerByDiscord(identity.discordId) ? { isOwner: true } : {}),
    },
  });
}

/** Vincula a Twitch a uma conta que ja existe. */
export async function linkTwitch(userId: string, identity: TwitchIdentity) {
  const taken = await prisma.user.findUnique({ where: { twitchId: identity.twitchId } });
  if (taken && taken.id !== userId) {
    throw conflict('Esta conta da Twitch já está vinculada a outro usuário do painel.');
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      twitchId: identity.twitchId,
      twitchLogin: identity.twitchLogin,
      ...(isOwnerByTwitch(identity.twitchLogin) ? { isOwner: true } : {}),
    },
  });
}

/**
 * Garante que existe o registro do canal da Twitch do usuario.
 *
 * Criado DESATIVADO de proposito: provar que o canal e seu e uma coisa, mandar
 * o bot entrar no seu chat e outra. A segunda precisa de um clique.
 */
export async function ensureTwitchChannel(userId: string, identity: TwitchIdentity) {
  const login = identity.twitchLogin.toLowerCase();

  const existing = await prisma.twitchChannel.findUnique({ where: { login } });
  if (existing && existing.ownerId && existing.ownerId !== userId) {
    throw conflict('Este canal já está vinculado a outra conta do painel.');
  }

  return prisma.twitchChannel.upsert({
    where: { login },
    create: {
      login,
      displayName: identity.displayName,
      twitchUserId: identity.twitchId,
      ownerId: userId,
    },
    update: {
      displayName: identity.displayName,
      twitchUserId: identity.twitchId,
      ownerId: userId,
    },
  });
}
