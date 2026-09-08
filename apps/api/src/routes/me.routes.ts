import { prisma } from '@ndev/db';
import type { FastifyInstance } from 'fastify';

import { currentUser, requireUser } from '../auth/session.js';
import { botInviteUrl } from '../lib/discord-api.js';

export async function registerMeRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Identidade e estado das conexoes.
   *
   * O painel monta a interface inteira a partir daqui: quais provedores estao
   * vinculados decide o que aparece. Como o cookie e httpOnly, esta rota e o
   * unico jeito de o front saber quem esta logado.
   */
  app.get('/api/me', { preHandler: requireUser }, async (request) => {
    const session = currentUser(request);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.id },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        discordId: true,
        twitchLogin: true,
        isOwner: true,
      },
    });

    // A conta do bot e da instancia, nao do usuario. Quando ela nao existe,
    // ativar o chatbot num canal nao teria efeito - e o painel avisa antes.
    const chatbotConfigured = (await prisma.botCredential.count({ where: { id: 'twitch' } })) > 0;

    return {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isOwner: user.isOwner,
      connections: {
        discord: { linked: user.discordId !== null },
        twitch: { linked: user.twitchLogin !== null, login: user.twitchLogin },
      },
      botInviteUrl: botInviteUrl(),
      chatbotConfigured,
    };
  });
}
