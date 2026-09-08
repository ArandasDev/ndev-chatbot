import { createLogger, encryptSecret, env } from '@ndev/config';
import { badRequest } from '@ndev/core';
import { prisma } from '@ndev/db';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { exchangeDiscordCode, fetchDiscordUser } from '../lib/discord-api.js';
import { consumeOAuthState, issueOAuthState } from './oauth-state.js';
import { clearSession, issueSession } from './session.js';

const log = createLogger('auth:discord');

const callbackQuery = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
});

/** Escopos minimos: identidade e a lista de servidores. Nada alem disso. */
const SCOPES = ['identify', 'guilds'];

export async function registerDiscordAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/auth/discord', async (request, reply) => {
    if (!env.hasDiscordOAuth) throw badRequest('Login com Discord não está configurado.');

    const state = issueOAuthState(reply, 'login');
    const params = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID!,
      redirect_uri: `${env.API_URL}/auth/discord/callback`,
      response_type: 'code',
      scope: SCOPES.join(' '),
      state,
      prompt: 'none',
    });

    return reply.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  });

  app.get('/auth/discord/callback', async (request, reply) => {
    const query = callbackQuery.parse(request.query);

    // Usuario clicou em "cancelar" na tela do Discord.
    if (query.error || !query.code) {
      return reply.redirect(`${env.WEB_URL}/login?erro=cancelado`);
    }

    consumeOAuthState(request, reply, query.state ?? '');

    const tokens = await exchangeDiscordCode(query.code);
    const profile = await fetchDiscordUser(tokens.access_token);

    const isOwner = env.ownerDiscordIds.includes(profile.id);

    const user = await prisma.user.upsert({
      where: { discordId: profile.id },
      create: {
        discordId: profile.id,
        username: profile.global_name ?? profile.username,
        avatar: profile.avatar,
        isOwner,
      },
      update: {
        username: profile.global_name ?? profile.username,
        avatar: profile.avatar,
        isOwner,
        lastLogin: new Date(),
      },
    });

    // Tokens de terceiro sempre cifrados antes de tocar o banco.
    await prisma.oAuthToken.upsert({
      where: { userId_provider: { userId: user.id, provider: 'DISCORD' } },
      create: {
        userId: user.id,
        provider: 'DISCORD',
        accessToken: encryptSecret(tokens.access_token),
        refreshToken: encryptSecret(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: tokens.scope.split(' '),
      },
      update: {
        accessToken: encryptSecret(tokens.access_token),
        refreshToken: encryptSecret(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: tokens.scope.split(' '),
      },
    });

    await issueSession(reply, { id: user.id, discordId: user.discordId, isOwner: user.isOwner });
    log.info(`login de ${user.username} (${user.discordId})`);

    return reply.redirect(`${env.WEB_URL}/servidores`);
  });

  app.post('/auth/logout', async (_request, reply) => {
    clearSession(reply);
    return { ok: true };
  });
}
