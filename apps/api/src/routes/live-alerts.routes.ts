import { forbidden, notFound } from '@ndev/core';
import { prisma } from '@ndev/db';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { currentUser, requireUser } from '../auth/session.js';
import { assertManagesGuild } from '../lib/discord-api.js';

const createSchema = z.object({
  twitchChannelId: z.string().min(1),
  guildId: z.string().min(1),
  discordChannelId: z.string().min(1),
  message: z.string().trim().min(1).max(500).optional(),
});

const updateSchema = z.object({
  message: z.string().trim().min(1).max(500).optional(),
  discordChannelId: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

const idParams = z.object({ alertId: z.string().min(1) });

export async function registerLiveAlertRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/live-alerts', { preHandler: requireUser }, async (request) => {
    const user = currentUser(request);

    return prisma.liveAlert.findMany({
      where: { twitchChannel: { ownerId: user.id } },
      include: {
        twitchChannel: { select: { id: true, login: true, displayName: true } },
        guild: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  /**
   * Criar um alerta cruza dois escopos, entao exige as DUAS provas:
   * ser dono do canal na Twitch E administrar o servidor no Discord.
   * Checar so um dos lados deixaria qualquer streamer anunciar no servidor alheio.
   */
  app.post('/api/live-alerts', { preHandler: requireUser }, async (request, reply) => {
    const user = currentUser(request);
    const input = createSchema.parse(request.body);

    const channel = await prisma.twitchChannel.findUnique({
      where: { id: input.twitchChannelId },
    });
    if (!channel) throw notFound('Canal da Twitch não encontrado.');
    if (channel.ownerId !== user.id) throw forbidden('Este canal não é seu.');

    await assertManagesGuild(user.id, input.guildId);

    const guild = await prisma.guild.findUnique({ where: { id: input.guildId } });
    if (!guild) throw notFound('O bot não está nesse servidor.');

    const alert = await prisma.liveAlert.upsert({
      where: {
        twitchChannelId_guildId_discordChannelId: {
          twitchChannelId: input.twitchChannelId,
          guildId: input.guildId,
          discordChannelId: input.discordChannelId,
        },
      },
      create: {
        twitchChannelId: input.twitchChannelId,
        guildId: input.guildId,
        discordChannelId: input.discordChannelId,
        ...(input.message ? { message: input.message } : {}),
      },
      update: { enabled: true, ...(input.message ? { message: input.message } : {}) },
    });

    return reply.status(201).send(alert);
  });

  app.patch('/api/live-alerts/:alertId', { preHandler: requireUser }, async (request) => {
    const user = currentUser(request);
    const { alertId } = idParams.parse(request.params);
    const data = updateSchema.parse(request.body);

    // O filtro por dono vai no WHERE, nao numa checagem depois do SELECT.
    const existing = await prisma.liveAlert.findFirst({
      where: { id: alertId, twitchChannel: { ownerId: user.id } },
    });
    if (!existing) throw notFound('Alerta não encontrado.');

    return prisma.liveAlert.update({ where: { id: alertId }, data });
  });

  app.delete('/api/live-alerts/:alertId', { preHandler: requireUser }, async (request, reply) => {
    const user = currentUser(request);
    const { alertId } = idParams.parse(request.params);

    const existing = await prisma.liveAlert.findFirst({
      where: { id: alertId, twitchChannel: { ownerId: user.id } },
    });
    if (!existing) throw notFound('Alerta não encontrado.');

    await prisma.liveAlert.delete({ where: { id: alertId } });
    return reply.status(204).send();
  });
}
