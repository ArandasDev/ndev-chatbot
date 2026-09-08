import type { Bus } from '@ndev/bus';
import { commandStats } from '@ndev/core';
import { prisma } from '@ndev/db';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireTwitchOwner, twitchScope } from '../auth/guards.js';
import { currentUser, requireUser } from '../auth/session.js';

const updateChannelSchema = z.object({
  prefix: z
    .string()
    .trim()
    .min(1, 'O prefixo não pode ficar vazio.')
    .max(5, 'O prefixo pode ter no máximo 5 caracteres.')
    .refine((value) => !/\s/.test(value), 'O prefixo não pode conter espaço.')
    .optional(),
  enabled: z.boolean().optional(),
});

export async function registerTwitchRoutes(app: FastifyInstance, bus: Bus): Promise<void> {
  app.get('/api/twitch/channels', { preHandler: requireUser }, async (request) => {
    const user = currentUser(request);

    return prisma.twitchChannel.findMany({
      where: { ownerId: user.id },
      select: {
        id: true,
        login: true,
        displayName: true,
        prefix: true,
        enabled: true,
        _count: { select: { commands: true } },
      },
      orderBy: { login: 'asc' },
    });
  });

  app.patch(
    '/api/twitch/channels/:channelId',
    { preHandler: [requireUser, requireTwitchOwner] },
    async (request) => {
      const scope = twitchScope(request);
      const data = updateChannelSchema.parse(request.body);

      const channel = await prisma.twitchChannel.update({
        where: { id: scope.id },
        data,
        select: { id: true, login: true, prefix: true, enabled: true },
      });

      // Ligar/desligar o canal muda a presenca do bot no chat, nao so o cache.
      if (data.enabled === false) {
        await bus.publish({ type: 'twitch.channel.part', login: channel.login });
      } else if (data.enabled === true) {
        await bus.publish({ type: 'twitch.channel.join', login: channel.login });
      } else {
        await bus.publish({ type: 'twitch.channel.updated', login: channel.login });
      }

      return channel;
    },
  );

  app.delete(
    '/api/twitch/channels/:channelId',
    { preHandler: [requireUser, requireTwitchOwner] },
    async (request, reply) => {
      const scope = twitchScope(request);

      await prisma.twitchChannel.delete({ where: { id: scope.id } });
      await bus.publish({ type: 'twitch.channel.part', login: scope.login });

      return reply.status(204).send();
    },
  );

  app.get(
    '/api/twitch/channels/:channelId/stats',
    { preHandler: [requireUser, requireTwitchOwner] },
    async (request) => {
      const scope = twitchScope(request);
      return { top: await commandStats({ platform: 'TWITCH', dbId: scope.id }) };
    },
  );
}
