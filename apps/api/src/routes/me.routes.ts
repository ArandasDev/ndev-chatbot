import { prisma } from '@ndev/db';
import type { FastifyInstance } from 'fastify';

import { currentUser, requireUser } from '../auth/session.js';
import { botInviteUrl } from '../lib/discord-api.js';

export async function registerMeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/me', { preHandler: requireUser }, async (request) => {
    const session = currentUser(request);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.id },
      select: {
        id: true,
        discordId: true,
        username: true,
        avatar: true,
        twitchLogin: true,
        isOwner: true,
      },
    });

    const botLinked = (await prisma.botCredential.count({ where: { id: 'twitch' } })) > 0;

    return {
      ...user,
      avatarUrl: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=128`
        : null,
      botInviteUrl: botInviteUrl(),
      twitchBotLinked: botLinked,
    };
  });
}
