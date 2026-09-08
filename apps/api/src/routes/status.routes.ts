import type { Bus } from '@ndev/bus';
import { AVAILABLE_VARIABLES } from '@ndev/core';
import { prisma } from '@ndev/db';
import type { FastifyInstance } from 'fastify';

import { currentUser, requireUser } from '../auth/session.js';

export async function registerStatusRoutes(app: FastifyInstance, bus: Bus): Promise<void> {
  /**
   * Estado do worker, lido do heartbeat no Redis.
   * `null` significa que a chave expirou - ou seja, o bot esta fora do ar.
   */
  app.get('/api/status', { preHandler: requireUser }, async (request) => {
    const user = currentUser(request);
    const status = await bus.getStatus();

    const recent = await prisma.commandLog.findMany({
      where: {
        OR: [
          { platform: 'TWITCH', scopeId: { in: await ownedTwitchIds(user.id) } },
          { platform: 'DISCORD', scopeId: { in: await knownGuildIds() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { platform: true, command: true, userName: true, createdAt: true },
    });

    return { online: status !== null, status, recent };
  });

  app.get('/api/meta/variables', async () => AVAILABLE_VARIABLES);
}

async function ownedTwitchIds(userId: string): Promise<string[]> {
  const channels = await prisma.twitchChannel.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });
  return channels.map((channel) => channel.id);
}

async function knownGuildIds(): Promise<string[]> {
  const guilds = await prisma.guild.findMany({ where: { enabled: true }, select: { id: true } });
  return guilds.map((guild) => guild.id);
}
