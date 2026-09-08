import { createBus } from '@ndev/bus';
import { createLogger, env } from '@ndev/config';
import { connectDb, disconnectDb } from '@ndev/db';

import { buildApp } from './app.js';

const log = createLogger('api');

async function main(): Promise<void> {
  await connectDb();

  const bus = createBus();
  const app = await buildApp(bus);

  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  log.info(`API ouvindo em ${env.API_URL}`);

  if (!env.hasDiscordOAuth) {
    log.warn('DISCORD_CLIENT_ID/SECRET ausentes - o login do painel nao vai funcionar.');
  }

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    log.info(`recebido ${signal}, encerrando...`);
    await Promise.allSettled([app.close(), bus.close(), disconnectDb()]);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err: Error) => {
  log.error('falha fatal:', err.message, err.stack);
  process.exit(1);
});
