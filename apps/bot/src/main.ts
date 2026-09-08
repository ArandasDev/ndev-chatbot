import { createBus } from '@ndev/bus';
import { createLogger, env } from '@ndev/config';
import { createDefaultEngine } from '@ndev/core';
import { connectDb, disconnectDb } from '@ndev/db';

import { createDiscordAdapter, type DiscordAdapter } from './adapters/discord.adapter.js';
import { createTwitchAdapter, type TwitchAdapter } from './adapters/twitch.adapter.js';
import { startBusListener } from './control/bus-listener.js';
import { startHeartbeat } from './control/heartbeat.js';
import { createAnnouncer } from './live/announcer.js';
import { createPollingLiveSource } from './live/polling-live-source.js';

const log = createLogger('bot');

async function main(): Promise<void> {
  log.info('iniciando worker...');
  await connectDb();

  const bus = createBus();
  const engine = createDefaultEngine(createLogger('engine'));

  // Cada plataforma sobe de forma independente: falta de credencial da Twitch
  // nao pode impedir o Discord de funcionar, e vice-versa.
  let discord: DiscordAdapter | null = null;
  let twitch: TwitchAdapter | null = null;

  if (env.hasDiscordBot) {
    discord = createDiscordAdapter(engine);
    await discord.start().catch((err: Error) => {
      log.error('Discord nao subiu:', err.message);
      discord = null;
    });
  } else {
    log.warn('DISCORD_TOKEN ausente - rodando sem Discord.');
  }

  if (env.hasTwitch) {
    twitch = createTwitchAdapter(engine);
    await twitch.start().catch((err: Error) => {
      log.error('Twitch nao subiu:', err.message);
      twitch = null;
    });
  }

  await startBusListener(bus, { twitch });
  const stopHeartbeat = startHeartbeat(bus, { discord, twitch });

  const liveSource = createPollingLiveSource();
  await liveSource.start(createAnnouncer(discord));

  log.info('worker pronto.');

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    log.info(`recebido ${signal}, encerrando...`);
    stopHeartbeat();
    await Promise.allSettled([
      liveSource.stop(),
      discord?.stop(),
      twitch?.stop(),
      bus.close(),
      disconnectDb(),
    ]);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err: Error) => {
  log.error('falha fatal:', err.message, err.stack);
  process.exit(1);
});
