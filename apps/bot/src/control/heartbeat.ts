import type { Bus, BotStatus } from '@ndev/bus';

import type { DiscordAdapter } from '../adapters/discord.adapter.js';
import type { TwitchAdapter } from '../adapters/twitch.adapter.js';

const INTERVAL_MS = 10_000;

export interface HeartbeatTargets {
  discord: DiscordAdapter | null;
  twitch: TwitchAdapter | null;
}

/**
 * Publica o estado do worker numa chave do Redis com TTL.
 *
 * A API le essa chave sob demanda. Se o bot morrer, a chave expira e o painel
 * mostra "offline" sozinho - sem precisar de pub/sub reverso nem de a API
 * guardar estado.
 */
export function startHeartbeat(bus: Bus, targets: HeartbeatTargets): () => void {
  const startedAt = new Date().toISOString();

  const publish = () => {
    const status: BotStatus = {
      startedAt,
      updatedAt: new Date().toISOString(),
      discord: {
        ready: targets.discord?.isReady() ?? false,
        guildCount: targets.discord?.guildCount() ?? 0,
        pingMs: targets.discord?.pingMs() ?? null,
      },
      twitch: {
        ready: targets.twitch?.isReady() ?? false,
        channels: targets.twitch?.connectedChannels() ?? [],
      },
    };

    void bus.setStatus(status);
  };

  publish();
  const timer = setInterval(publish, INTERVAL_MS);
  timer.unref();

  return () => clearInterval(timer);
}
