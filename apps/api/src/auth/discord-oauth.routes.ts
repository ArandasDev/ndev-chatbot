import { createLogger, encryptSecret, env } from '@ndev/config';
import { badRequest, isAppError } from '@ndev/core';
import { prisma } from '@ndev/db';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { exchangeDiscordCode, fetchDiscordUser, invalidateGuildCache } from '../lib/discord-api.js';
import { linkDiscord, loginWithDiscord } from '../services/identity.service.js';
import { consumeOAuthState, issueOAuthState } from './oauth-state.js';
import { clearSession, issueSession, readSession } from './session.js';

const log = createLogger('auth:discord');

const callbackQuery = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
});

/** Escopos minimos: identidade e a lista de servidores. Nada alem disso. */
const SCOPES = ['identify', 'guilds'];

function avatarUrl(discordId: string, hash: string | null): string | null {
  return hash ? `https://cdn.discordapp.com/avatars/${discordId}/${hash}.png?size=128` : null;
}

export async function registerDiscordAuthRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Serve para as duas coisas: entrar no painel e vincular o Discord a uma
   * conta que ja existe. Quem decide e a presenca de sessao no momento do
   * clique - e a decisao viaja no cookie de state, nao na URL, para nao poder
   * ser trocada por quem monta o link.
   */
  app.get('/auth/discord', async (request, reply) => {
    if (!env.hasDiscordOAuth) throw badRequest('Login com Discord não está configurado.');

    const session = await readSession(request);
    const state = issueOAuthState(reply, session ? 'link' : 'login');

    const params = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID!,
      redirect_uri: `${env.API_URL}/auth/discord/callback`,
      response_type: 'code',
      scope: SCOPES.join(' '),
      state,
    });

    return reply.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  });

  app.get('/auth/discord/callback', async (request, reply) => {
    const query = callbackQuery.parse(request.query);

    if (query.error || !query.code) {
      return reply.redirect(`${env.WEB_URL}/login?erro=cancelado`);
    }

    const { intent } = consumeOAuthState(request, reply, query.state ?? '');

    const tokens = await exchangeDiscordCode(query.code);
    const profile = await fetchDiscordUser(tokens.access_token);

    const identity = {
      discordId: profile.id,
      displayName: profile.global_name ?? profile.username,
      avatarUrl: avatarUrl(profile.id, profile.avatar),
    };

    let userId: string;
    let isOwner: boolean;

    if (intent === 'link') {
      const session = await readSession(request);
      if (!session) return reply.redirect(`${env.WEB_URL}/login`);

      try {
        const user = await linkDiscord(session.id, identity);
        userId = user.id;
        isOwner = user.isOwner;
      } catch (err) {
        // Conflito de vinculo vira mensagem na tela, nao erro 409 cru: o usuario
        // chegou aqui por um redirect, nao por uma chamada de API.
        if (isAppError(err)) {
          return reply.redirect(`${env.WEB_URL}/conta?erro=${encodeURIComponent(err.message)}`);
        }
        throw err;
      }
    } else {
      const user = await loginWithDiscord(identity);
      userId = user.id;
      isOwner = user.isOwner;
    }

    // Token de terceiro sempre cifrado antes de tocar o banco.
    const encrypted = {
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: encryptSecret(tokens.refresh_token),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scopes: tokens.scope.split(' '),
    };

    await prisma.oAuthToken.upsert({
      where: { userId_provider: { userId, provider: 'DISCORD' } },
      create: { userId, provider: 'DISCORD', ...encrypted },
      update: encrypted,
    });

    // A lista de servidores e cacheada por usuario; um login novo invalida.
    invalidateGuildCache(userId);
    await issueSession(reply, { id: userId, isOwner });

    log.info(`${intent === 'link' ? 'Discord vinculado' : 'login'}: ${identity.displayName}`);
    return reply.redirect(`${env.WEB_URL}/${intent === 'link' ? 'conta' : 'servidores'}`);
  });

  app.post('/auth/logout', async (_request, reply) => {
    clearSession(reply);
    return { ok: true };
  });
}
