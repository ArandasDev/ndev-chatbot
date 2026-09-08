import { createLogger, env } from '@ndev/config';
import { badRequest } from '@ndev/core';

const log = createLogger('discord-bot-api');
const BASE = 'https://discord.com/api/v10';

/**
 * Chamadas feitas com o TOKEN DO BOT, nao com o token do usuario.
 *
 * Fica separado do discord-api.ts de proposito: e outra credencial, com outro
 * nivel de confianca. Misturar as duas no mesmo modulo e como se autorizacao do
 * usuario e poder do bot fossem a mesma coisa - nao sao.
 */
interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
}

/** 0 = texto, 5 = anuncios. Sao os unicos onde faz sentido anunciar uma live. */
const ANNOUNCEABLE_TYPES = new Set([0, 5]);

export interface TextChannelSummary {
  id: string;
  name: string;
}

export async function fetchGuildTextChannels(guildId: string): Promise<TextChannelSummary[]> {
  if (!env.DISCORD_TOKEN) throw badRequest('O bot não está configurado nesta instância.');

  const response = await fetch(`${BASE}/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` },
  });

  if (!response.ok) {
    log.error(`listar canais de ${guildId} -> ${response.status}`);
    throw badRequest('Não consegui listar os canais desse servidor.');
  }

  const channels = (await response.json()) as DiscordChannel[];

  return channels
    .filter((channel) => ANNOUNCEABLE_TYPES.has(channel.type))
    .sort((a, b) => a.position - b.position)
    .map((channel) => ({ id: channel.id, name: channel.name }));
}
