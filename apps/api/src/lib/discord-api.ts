import { createLogger, decryptSecret, encryptSecret, env } from '@ndev/config';
import { forbidden, unauthorized } from '@ndev/core';
import { prisma } from '@ndev/db';

/** Falta o vinculo com o Discord - situacao normal para quem entrou pela Twitch. */
const discordNotLinked = (message = 'Vincule sua conta do Discord para gerenciar servidores.') =>
  forbidden(message);

const log = createLogger('discord-api');
const BASE = 'https://discord.com/api/v10';

/** MANAGE_GUILD (1 << 5) e ADMINISTRATOR (1 << 3). */
const MANAGE_GUILD = 1n << 5n;
const ADMINISTRATOR = 1n << 3n;

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export interface DiscordGuildSummary {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface DiscordTokenSet {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

async function discordFetch<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 401) throw unauthorized('Sua sessão com o Discord expirou.');
  if (!response.ok) {
    log.error(`GET ${path} -> ${response.status}`);
    throw new Error(`Discord respondeu ${response.status} em ${path}`);
  }

  return (await response.json()) as T;
}

export async function exchangeDiscordCode(code: string): Promise<DiscordTokenSet> {
  const response = await fetch(`${BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID!,
      client_secret: env.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${env.API_URL}/auth/discord/callback`,
    }),
  });

  if (!response.ok) {
    // Nunca logamos o corpo: ele carrega o code e o client_secret ecoado.
    log.error('troca de code falhou com status', response.status);
    throw unauthorized('Não consegui concluir o login com o Discord.');
  }

  return (await response.json()) as DiscordTokenSet;
}

async function refreshDiscordToken(refreshToken: string): Promise<DiscordTokenSet> {
  const response = await fetch(`${BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID!,
      client_secret: env.DISCORD_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) throw discordNotLinked('Sua conexão com o Discord expirou. Reconecte.');
  return (await response.json()) as DiscordTokenSet;
}

export function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  return discordFetch<DiscordUser>('/users/@me', accessToken);
}

/**
 * Devolve um access token valido do usuario, renovando se necessario.
 * O token vive cifrado no banco e nunca sai daqui.
 */
async function getValidAccessToken(userId: string): Promise<string> {
  const stored = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: 'DISCORD' } },
  });

  // Deliberadamente NAO e 401: quem entrou pela Twitch tem sessao valida, so
  // nao tem Discord vinculado. Um 401 aqui deslogaria o usuario num loop.
  if (!stored) throw discordNotLinked();

  const expired = stored.expiresAt !== null && stored.expiresAt.getTime() < Date.now() + 60_000;
  if (!expired) return decryptSecret(stored.accessToken);

  if (!stored.refreshToken) throw discordNotLinked('Reconecte sua conta do Discord.');

  const refreshed = await refreshDiscordToken(decryptSecret(stored.refreshToken));
  await prisma.oAuthToken.update({
    where: { id: stored.id },
    data: {
      accessToken: encryptSecret(refreshed.access_token),
      refreshToken: encryptSecret(refreshed.refresh_token),
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      scopes: refreshed.scope.split(' '),
    },
  });

  return refreshed.access_token;
}

interface CacheEntry {
  guilds: DiscordGuildSummary[];
  expiresAt: number;
}

const guildCache = new Map<string, CacheEntry>();
const GUILD_CACHE_TTL_MS = 60_000;

/**
 * Servidores que o usuario administra, direto do Discord.
 *
 * Esta e a fonte da verdade da autorizacao. Guardar "quem administra o que" no
 * nosso banco significaria continuar autorizando alguem que ja perdeu o cargo.
 * Cache curto so para nao estourar o rate limit do Discord.
 */
export async function getManageableGuilds(userId: string): Promise<DiscordGuildSummary[]> {
  const cached = guildCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.guilds;

  const accessToken = await getValidAccessToken(userId);
  const all = await discordFetch<DiscordGuildSummary[]>('/users/@me/guilds', accessToken);

  const manageable = all.filter((guild) => {
    if (guild.owner) return true;
    const permissions = BigInt(guild.permissions || '0');
    return (permissions & MANAGE_GUILD) !== 0n || (permissions & ADMINISTRATOR) !== 0n;
  });

  guildCache.set(userId, { guilds: manageable, expiresAt: Date.now() + GUILD_CACHE_TTL_MS });
  return manageable;
}

export async function assertManagesGuild(userId: string, guildId: string): Promise<void> {
  const guilds = await getManageableGuilds(userId);
  if (!guilds.some((guild) => guild.id === guildId)) {
    // Mesma mensagem para "nao existe" e "nao e seu": diferenciar transformaria
    // a rota num verificador de existencia de servidor.
    throw forbidden('Você não administra este servidor.');
  }
}

export function invalidateGuildCache(userId: string): void {
  guildCache.delete(userId);
}

/** URL para adicionar o bot num servidor. */
export function botInviteUrl(guildId?: string): string {
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID ?? '',
    scope: 'bot applications.commands',
    // Ler/enviar mensagens, ver histórico e mencionar.
    permissions: '274877991936',
  });
  if (guildId) params.set('guild_id', guildId);
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}
