import { forbidden, notFound } from '@ndev/core';
import { prisma } from '@ndev/db';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';

import { assertManagesGuild } from '../lib/discord-api.js';
import { currentUser } from './session.js';

export interface GuildScope {
  id: string;
  name: string;
  prefix: string;
}

export interface TwitchScope {
  id: string;
  login: string;
  prefix: string;
}

const guildParams = z.object({ guildId: z.string().min(1) });
const channelParams = z.object({ channelId: z.string().min(1) });

/**
 * preHandler dos recursos de um servidor do Discord.
 *
 * A ordem importa: primeiro confirmamos no Discord que o usuario administra
 * aquele servidor, e so depois olhamos o nosso banco. O id da URL sozinho nunca
 * autoriza nada.
 */
export async function requireGuildAccess(request: FastifyRequest): Promise<void> {
  const user = currentUser(request);
  const { guildId } = guildParams.parse(request.params);

  await assertManagesGuild(user.id, guildId);

  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild || !guild.enabled) {
    throw notFound('O bot não está neste servidor. Adicione-o pelo painel primeiro.');
  }

  request.guildScope = { id: guild.id, name: guild.name, prefix: guild.prefix };
}

/**
 * preHandler dos recursos de um canal da Twitch.
 * O dono e quem provou posse do canal pelo OAuth da Twitch.
 */
export async function requireTwitchOwner(request: FastifyRequest): Promise<void> {
  const user = currentUser(request);
  const { channelId } = channelParams.parse(request.params);

  const channel = await prisma.twitchChannel.findUnique({ where: { id: channelId } });
  if (!channel) throw notFound('Canal não encontrado.');

  if (channel.ownerId !== user.id) throw forbidden('Este canal não é seu.');

  request.twitchScope = { id: channel.id, login: channel.login, prefix: channel.prefix };
}

export function guildScope(request: FastifyRequest): GuildScope {
  const scope = request.guildScope;
  if (!scope) throw forbidden();
  return scope;
}

export function twitchScope(request: FastifyRequest): TwitchScope {
  const scope = request.twitchScope;
  if (!scope) throw forbidden();
  return scope;
}
