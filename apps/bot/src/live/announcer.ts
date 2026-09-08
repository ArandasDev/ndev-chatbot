import { createLogger } from '@ndev/config';
import { sanitizeReply } from '@ndev/core';
import { prisma } from '@ndev/db';

import type { DiscordAdapter } from '../adapters/discord.adapter.js';
import type { LiveStream } from './live-source.js';

const log = createLogger('announcer');

/**
 * Variaveis do anuncio de live. Allowlist fechada, igual as dos comandos:
 * substituicao textual, nunca execucao.
 */
function renderAnnouncement(template: string, stream: LiveStream): string {
  return template
    .replace(/\{channel\}/gi, stream.displayName)
    .replace(/\{title\}/gi, stream.title || 'sem título')
    .replace(/\{game\}/gi, stream.gameName || 'sem categoria')
    .replace(/\{url\}/gi, `https://twitch.tv/${stream.login}`)
    .trim();
}

/**
 * Envia o anuncio para cada canal do Discord ligado aquele canal da Twitch.
 * Um destino que falha nao impede os outros.
 */
export function createAnnouncer(discord: DiscordAdapter | null) {
  return async function announce(stream: LiveStream): Promise<void> {
    if (!discord?.isReady()) {
      log.warn(`${stream.login} ficou online, mas o Discord nao esta conectado.`);
      return;
    }

    const alerts = await prisma.liveAlert.findMany({
      where: {
        enabled: true,
        twitchChannel: { login: stream.login },
        guild: { enabled: true },
      },
    });

    await Promise.all(
      alerts.map(async (alert) => {
        try {
          const text = sanitizeReply(renderAnnouncement(alert.message, stream), 'DISCORD');
          await discord.say(alert.discordChannelId, text);
          log.info(`anunciado em ${alert.discordChannelId}`);
        } catch (err) {
          log.error(`falha ao anunciar em ${alert.discordChannelId}:`, (err as Error).message);
        }
      }),
    );
  };
}
