import { createLogger, env } from '@ndev/config';
import { prisma } from '@ndev/db';
import { ApiClient } from '@twurple/api';
import { AppTokenAuthProvider } from '@twurple/auth';

import type { LiveEventSource, LiveHandler, LiveStream } from './live-source.js';

const log = createLogger('live');

/** Limite do endpoint /helix/streams por requisicao. */
const BATCH_SIZE = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Deteccao de live por polling do Helix.
 *
 * Escolhido no lugar do EventSub por webhook porque nao exige URL publica nem
 * validacao de assinatura, e um app token cobre todos os canais (multi-tenant
 * de verdade). Custo: ate um ciclo de atraso no anuncio.
 *
 * A transicao offline -> online e derivada de `LiveAlert.wasLive`, que fica no
 * Postgres: reiniciar o worker nao reanuncia uma live que ja estava no ar.
 */
export function createPollingLiveSource(): LiveEventSource {
  let timer: NodeJS.Timeout | null = null;
  let running = false;

  const api = env.hasTwitch
    ? new ApiClient({
        authProvider: new AppTokenAuthProvider(env.TWITCH_CLIENT_ID!, env.TWITCH_CLIENT_SECRET!),
      })
    : null;

  async function tick(onLive: LiveHandler): Promise<void> {
    if (!api || running) return;
    running = true;

    try {
      const alerts = await prisma.liveAlert.findMany({
        where: { enabled: true, guild: { enabled: true } },
        include: { twitchChannel: true },
      });
      if (alerts.length === 0) return;

      const logins = [...new Set(alerts.map((alert) => alert.twitchChannel.login))];

      const liveByLogin = new Map<string, LiveStream>();
      for (const batch of chunk(logins, BATCH_SIZE)) {
        const streams = await api.streams.getStreamsByUserNames(batch);
        for (const stream of streams) {
          liveByLogin.set(stream.userName.toLowerCase(), {
            login: stream.userName.toLowerCase(),
            displayName: stream.userDisplayName,
            title: stream.title,
            gameName: stream.gameName,
            startedAt: stream.startDate,
            thumbnailUrl: stream.getThumbnailUrl(1280, 720),
          });
        }
      }

      for (const alert of alerts) {
        const stream = liveByLogin.get(alert.twitchChannel.login);
        const isLive = Boolean(stream);

        if (isLive === alert.wasLive) continue;

        await prisma.liveAlert.update({
          where: { id: alert.id },
          data: {
            wasLive: isLive,
            ...(isLive ? { lastAnnouncedAt: new Date() } : {}),
          },
        });

        if (isLive && stream) {
          log.info(`${stream.login} ficou online`);
          await onLive(stream);
        }
      }
    } catch (err) {
      // Falha de rede nao pode matar o loop; o proximo ciclo tenta de novo.
      log.error('ciclo de verificacao falhou:', (err as Error).message);
    } finally {
      running = false;
    }
  }

  return {
    async start(onLive) {
      if (!api) {
        log.warn('credenciais da Twitch ausentes - alerta de live desligado.');
        return;
      }

      const intervalMs = env.LIVE_POLL_INTERVAL_SEC * 1000;
      log.info(`verificando lives a cada ${env.LIVE_POLL_INTERVAL_SEC}s`);

      await tick(onLive);
      timer = setInterval(() => void tick(onLive), intervalMs);
      timer.unref();
    },

    async stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
