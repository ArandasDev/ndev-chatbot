import type { Bus } from '@ndev/bus';
import { commandStats } from '@ndev/core';
import { prisma } from '@ndev/db';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { guildScope, requireGuildAccess } from '../auth/guards.js';
import { currentUser, requireUser } from '../auth/session.js';
import { botInviteUrl, getManageableGuilds } from '../lib/discord-api.js';
import { fetchGuildTextChannels } from '../lib/discord-bot-api.js';

const updateGuildSchema = z.object({
  prefix: z
    .string()
    .trim()
    .min(1, 'O prefixo não pode ficar vazio.')
    .max(5, 'O prefixo pode ter no máximo 5 caracteres.')
    .refine((value) => !/\s/.test(value), 'O prefixo não pode conter espaço.')
    .optional(),
  enabled: z.boolean().optional(),
});

export async function registerGuildRoutes(app: FastifyInstance, bus: Bus): Promise<void> {
  /** Servidores que o usuario administra, marcando onde o bot ja esta. */
  app.get('/api/guilds', { preHandler: requireUser }, async (request) => {
    const user = currentUser(request);
    const manageable = await getManageableGuilds(user.id);

    const known = await prisma.guild.findMany({
      where: { id: { in: manageable.map((guild) => guild.id) } },
      select: { id: true, prefix: true, enabled: true, _count: { select: { commands: true } } },
    });
    const knownById = new Map(known.map((guild) => [guild.id, guild]));

    return manageable.map((guild) => {
      const local = knownById.get(guild.id);
      return {
        id: guild.id,
        name: guild.name,
        iconUrl: guild.icon
          ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
          : null,
        botPresent: Boolean(local?.enabled),
        prefix: local?.prefix ?? '!',
        commandCount: local?._count.commands ?? 0,
        inviteUrl: botInviteUrl(guild.id),
      };
    });
  });

  app.get(
    '/api/guilds/:guildId',
    { preHandler: [requireUser, requireGuildAccess] },
    async (request) => {
      const scope = guildScope(request);

      const guild = await prisma.guild.findUniqueOrThrow({
        where: { id: scope.id },
        select: {
          id: true,
          name: true,
          icon: true,
          prefix: true,
          enabled: true,
          _count: { select: { commands: true, liveAlerts: true } },
        },
      });

      return {
        ...guild,
        iconUrl: guild.icon
          ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
          : null,
        commandCount: guild._count.commands,
        liveAlertCount: guild._count.liveAlerts,
      };
    },
  );

  app.patch(
    '/api/guilds/:guildId',
    { preHandler: [requireUser, requireGuildAccess] },
    async (request) => {
      const scope = guildScope(request);
      const data = updateGuildSchema.parse(request.body);

      const guild = await prisma.guild.update({
        where: { id: scope.id },
        data,
        select: { id: true, prefix: true, enabled: true },
      });

      // O bot rele do banco; o evento so derruba o cache antes do TTL.
      await bus.publish({ type: 'guild.settings.updated', guildId: guild.id });
      return guild;
    },
  );

  /** Canais de texto, para escolher onde anunciar a live. */
  app.get(
    '/api/guilds/:guildId/channels',
    { preHandler: [requireUser, requireGuildAccess] },
    async (request) => {
      const scope = guildScope(request);
      return fetchGuildTextChannels(scope.id);
    },
  );

  app.get(
    '/api/guilds/:guildId/stats',
    { preHandler: [requireUser, requireGuildAccess] },
    async (request) => {
      const scope = guildScope(request);
      return { top: await commandStats({ platform: 'DISCORD', dbId: scope.id }) };
    },
  );
}
