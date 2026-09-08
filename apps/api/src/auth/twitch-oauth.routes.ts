import type { Bus } from '@ndev/bus';
import { createLogger, encryptSecret, env } from '@ndev/config';
import { badRequest } from '@ndev/core';
import { prisma } from '@ndev/db';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { exchangeTwitchCode, fetchTwitchUser, twitchAuthorizeUrl } from '../lib/twitch-api.js';
import { consumeOAuthState, issueOAuthState } from './oauth-state.js';
import { currentUser, requireOwner, requireUser } from './session.js';

const log = createLogger('auth:twitch');

const callbackQuery = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
});

/** Dono do canal: so precisamos identificar quem e. */
const OWNER_SCOPES = ['user:read:email'];
/** Conta do bot: ler e escrever no chat. */
const BOT_SCOPES = ['chat:read', 'chat:edit'];

export async function registerTwitchAuthRoutes(app: FastifyInstance, bus: Bus): Promise<void> {
  /** Vincula o canal do usuario logado (prova de posse). */
  app.get('/auth/twitch', { preHandler: requireUser }, async (request, reply) => {
    if (!env.hasTwitch) throw badRequest('Integração com a Twitch não está configurada.');

    const state = issueOAuthState(reply, 'channel');
    return reply.redirect(twitchAuthorizeUrl(state, OWNER_SCOPES));
  });

  /**
   * Vincula a CONTA DO BOT. Restrito ao dono da instancia: quem passa por aqui
   * define de qual conta saem todas as mensagens na Twitch.
   */
  app.get('/auth/twitch/bot', { preHandler: requireOwner }, async (request, reply) => {
    if (!env.hasTwitch) throw badRequest('Integração com a Twitch não está configurada.');

    const state = issueOAuthState(reply, 'bot');
    return reply.redirect(twitchAuthorizeUrl(state, BOT_SCOPES));
  });

  app.get('/auth/twitch/callback', { preHandler: requireUser }, async (request, reply) => {
    const query = callbackQuery.parse(request.query);
    if (query.error || !query.code) {
      return reply.redirect(`${env.WEB_URL}/twitch?erro=cancelado`);
    }

    const { intent } = consumeOAuthState(request, reply, query.state ?? '');
    const user = currentUser(request);

    const tokens = await exchangeTwitchCode(query.code);
    const profile = await fetchTwitchUser(tokens.access_token);

    if (intent === 'bot') {
      if (!user.isOwner) throw badRequest('Só o dono da instância pode vincular a conta do bot.');

      const encrypted = {
        accessToken: encryptSecret(tokens.access_token),
        refreshToken: encryptSecret(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: tokens.scope,
        login: profile.login,
        twitchUserId: profile.id,
      };

      await prisma.botCredential.upsert({
        where: { id: 'twitch' },
        create: { id: 'twitch', ...encrypted },
        update: encrypted,
      });

      await bus.publish({ type: 'bot.credentials.updated' });
      log.info(`conta do bot vinculada: ${profile.login}`);

      return reply.redirect(`${env.WEB_URL}/status?bot=vinculado`);
    }

    // Fluxo do dono do canal.
    const login = profile.login.toLowerCase();

    const existing = await prisma.twitchChannel.findUnique({ where: { login } });
    if (existing && existing.ownerId && existing.ownerId !== user.id) {
      throw badRequest('Este canal já está vinculado a outra conta.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twitchId: profile.id, twitchLogin: login },
    });

    await prisma.twitchChannel.upsert({
      where: { login },
      create: {
        login,
        displayName: profile.display_name,
        twitchUserId: profile.id,
        ownerId: user.id,
      },
      update: {
        displayName: profile.display_name,
        twitchUserId: profile.id,
        ownerId: user.id,
        enabled: true,
      },
    });

    await bus.publish({ type: 'twitch.channel.join', login });
    log.info(`canal vinculado: ${login}`);

    return reply.redirect(`${env.WEB_URL}/twitch?vinculado=1`);
  });
}
