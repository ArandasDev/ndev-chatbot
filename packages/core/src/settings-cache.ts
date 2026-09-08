import { prisma } from '@ndev/db';

import type { Platform, ScopeSettings } from './types.js';

const TTL_MS = 30_000;

interface Entry {
  value: ScopeSettings | null;
  expiresAt: number;
}

const cache = new Map<string, Entry>();

function cacheKey(platform: Platform, key: string): string {
  return `${platform}:${key.toLowerCase()}`;
}

async function load(platform: Platform, key: string): Promise<ScopeSettings | null> {
  if (platform === 'DISCORD') {
    const guild = await prisma.guild.findUnique({ where: { id: key } });
    if (!guild) return null;
    return {
      platform: 'DISCORD',
      dbId: guild.id,
      key: guild.id,
      name: guild.name,
      prefix: guild.prefix,
      enabled: guild.enabled,
    };
  }

  const channel = await prisma.twitchChannel.findUnique({ where: { login: key.toLowerCase() } });
  if (!channel) return null;
  return {
    platform: 'TWITCH',
    dbId: channel.id,
    key: channel.login,
    name: channel.displayName ?? channel.login,
    prefix: channel.prefix,
    enabled: channel.enabled,
  };
}

/**
 * Resolve o escopo de uma mensagem, com cache curto.
 *
 * O resultado negativo tambem e cacheado: sem isso, um servidor onde o bot foi
 * adicionado mas nunca registrado geraria uma query por mensagem.
 */
export async function getScope(platform: Platform, key: string): Promise<ScopeSettings | null> {
  const id = cacheKey(platform, key);
  const hit = cache.get(id);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const value = await load(platform, key);
  cache.set(id, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

/** Chamado pelo listener do bus quando o painel altera alguma configuracao. */
export function invalidateScope(platform: Platform, key: string): void {
  cache.delete(cacheKey(platform, key));
}

export function invalidateAllScopes(): void {
  cache.clear();
}
