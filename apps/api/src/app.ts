import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { Bus } from '@ndev/bus';
import { env } from '@ndev/config';
import Fastify, { type FastifyInstance } from 'fastify';

import { registerDiscordAuthRoutes } from './auth/discord-oauth.routes.js';
import { requireGuildAccess, requireTwitchOwner, guildScope, twitchScope } from './auth/guards.js';
import { requireUser } from './auth/session.js';
import { registerTwitchAuthRoutes } from './auth/twitch-oauth.routes.js';
import { registerErrorHandler } from './lib/http-errors.js';
import { registerCommandRoutes } from './routes/commands.routes.js';
import { registerGuildRoutes } from './routes/guilds.routes.js';
import { registerHealthRoutes } from './routes/health.routes.js';
import { registerLiveAlertRoutes } from './routes/live-alerts.routes.js';
import { registerMeRoutes } from './routes/me.routes.js';
import { registerStatusRoutes } from './routes/status.routes.js';
import { registerTwitchRoutes } from './routes/twitch.routes.js';

export async function buildApp(bus: Bus): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // usamos o logger do @ndev/config, com redaction
    trustProxy: env.isProd,
    bodyLimit: 64 * 1024,
  });

  registerErrorHandler(app);

  await app.register(helmet, {
    // A API so devolve JSON e redirects; nao serve HTML nem carrega recurso.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(cors, {
    // Origem unica e explicita. Com credentials, "*" nem seria aceito pelo browser.
    origin: env.WEB_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(cookie);

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    // Sem isso, um unico cliente atras de proxy limitaria todo mundo.
    keyGenerator: (request) => request.ip,
  });

  await registerHealthRoutes(app);
  await registerDiscordAuthRoutes(app);
  await registerTwitchAuthRoutes(app, bus);

  await registerMeRoutes(app);
  await registerGuildRoutes(app, bus);
  await registerTwitchRoutes(app, bus);
  await registerLiveAlertRoutes(app);
  await registerStatusRoutes(app, bus);

  // Mesmo CRUD, dois escopos: muda o guard e o evento publicado.
  await registerCommandRoutes(app, {
    prefix: '/api/guilds/:guildId/commands',
    preHandler: [requireUser, requireGuildAccess],
    resolveScope: (request) => ({ platform: 'DISCORD', dbId: guildScope(request).id }),
    onChanged: async (request) => {
      await bus.publish({ type: 'guild.commands.updated', guildId: guildScope(request).id });
    },
  });

  await registerCommandRoutes(app, {
    prefix: '/api/twitch/channels/:channelId/commands',
    preHandler: [requireUser, requireTwitchOwner],
    resolveScope: (request) => ({ platform: 'TWITCH', dbId: twitchScope(request).id }),
    onChanged: async (request) => {
      await bus.publish({ type: 'twitch.commands.updated', login: twitchScope(request).login });
    },
  });

  return app;
}
