import type { Bus } from '@ndev/bus';
import { createLogger, encryptSecret, env } from '@ndev/config';
import { badRequest, forbidden, isAppError } from '@ndev/core';
import { prisma } from '@ndev/db';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  exchangeTwitchCode,
  fetchTwitchUser,
  twitchAuthorizeUrl,
  type TwitchTokenSet,
} from '../lib/twitch-api.js';
import {
  ensureTwitchChannel,
  linkTwitch,
  loginWithTwitch,
  type TwitchIdentity,
} from '../services/identity.service.js';
import { consumeOAuthState, issueOAuthState } from './oauth-state.js';
import { issueSession, readSession, requireOwner } from './session.js';

const log = createLogger('auth:twitch');

const callbackQuery = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
});

/** Identificar o dono do canal. Nao pedimos nada do chat aqui. */
const OWNER_SCOPES = ['user:read:email'];
/** Conta do bot da instancia: ler e escrever no chat. */
const BOT_SCOPES = ['chat:read', 'chat:edit'];

export async function registerTwitchAuthRoutes(app: FastifyInstance, bus: Bus): Promise<void> {
  /**
   * Entrar no painel pela Twitch, ou vincular a Twitch a uma conta existente.
   * Mesma logica do Discord: a intencao vem da sessao e viaja no cookie de state.
   */
  app.get('/auth/twitch', async (request, reply) => {
    if (!env.hasTwitch) throw badRequest('Login com Twitch não está configurado.');

    const session = await readSession(request);
    const state = issueOAuthState(reply, session ? 'link' : 'login');

    return reply.redirect(twitchAuthorizeUrl(state, OWNER_SCOPES));
  });

  /**
   * Vincula a CONTA DO BOT da instancia - a conta de onde saem as mensagens em
   * TODOS os canais. E configuracao de infraestrutura, feita uma vez pelo dono.
   * Nenhum streamer passa por aqui: ele so aperta "Ativar chatbot".
   */
  app.get('/auth/twitch/bot', { preHandler: requireOwner }, async (_request, reply) => {
    if (!env.hasTwitch) throw badRequest('Integração com a Twitch não está configurada.');

    const state = issueOAuthState(reply, 'bot');
    // force_verify garante a tela de consentimento: sem isso, vincular a conta
    // do bot no mesmo navegador reaproveitaria a sessao pessoal em silencio.
    return reply.redirect(twitchAuthorizeUrl(state, BOT_SCOPES, { forceVerify: true }));
  });

  app.get('/auth/twitch/callback', async (request, reply) => {
    const query = callbackQuery.parse(request.query);
    if (query.error || !query.code) {
      return reply.redirect(`${env.WEB_URL}/login?erro=cancelado`);
    }

    const { intent } = consumeOAuthState(request, reply, query.state ?? '');

    const tokens = await exchangeTwitchCode(query.code);
    const profile = await fetchTwitchUser(tokens.access_token);

    const identity: TwitchIdentity = {
      twitchId: profile.id,
      twitchLogin: profile.login.toLowerCase(),
      displayName: profile.display_name || profile.login,
      avatarUrl: profile.profile_image_url || null,
    };

    if (intent === 'bot') return handleBotLink(request, reply, tokens, identity);

    try {
      if (intent === 'link') {
        const session = await readSession(request);
        if (!session) return reply.redirect(`${env.WEB_URL}/login`);

        const user = await linkTwitch(session.id, identity);
        await ensureTwitchChannel(user.id, identity);
        await issueSession(reply, { id: user.id, isOwner: user.isOwner });

        log.info(`Twitch vinculada: ${identity.twitchLogin}`);
        return reply.redirect(`${env.WEB_URL}/conta`);
      }

      const user = await loginWithTwitch(identity);
      await ensureTwitchChannel(user.id, identity);
      await issueSession(reply, { id: user.id, isOwner: user.isOwner });

      log.info(`login pela Twitch: ${identity.twitchLogin}`);
      return reply.redirect(`${env.WEB_URL}/twitch`);
    } catch (err) {
      if (isAppError(err)) {
        const target = intent === 'link' ? 'conta' : 'login';
        return reply.redirect(`${env.WEB_URL}/${target}?erro=${encodeURIComponent(err.message)}`);
      }
      throw err;
    }
  });

  async function handleBotLink(
    request: FastifyRequest,
    reply: FastifyReply,
    tokens: TwitchTokenSet,
    identity: TwitchIdentity,
  ) {
    // Reconferimos a sessao no callback: o preHandler protegeu a ida, esta
    // checagem protege a volta. Sao dois requests diferentes.
    const session = await readSession(request);
    if (!session?.isOwner) throw forbidden('Só o dono da instância pode vincular a conta do bot.');

    const credential = {
      login: identity.twitchLogin,
      twitchUserId: identity.twitchId,
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: encryptSecret(tokens.refresh_token),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scopes: tokens.scope,
    };

    await prisma.botCredential.upsert({
      where: { id: 'twitch' },
      create: { id: 'twitch', ...credential },
      update: credential,
    });

    await bus.publish({ type: 'bot.credentials.updated' });
    log.info(`conta do bot vinculada: ${identity.twitchLogin}`);

    return reply.redirect(`${env.WEB_URL}/status?bot=vinculado`);
  }
}
