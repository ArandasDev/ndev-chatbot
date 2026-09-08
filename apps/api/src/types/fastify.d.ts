import type { SessionUser } from '../auth/session.js';
import type { GuildScope, TwitchScope } from '../auth/guards.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Preenchido pelo preHandler `requireUser`. */
    currentUser?: SessionUser;
    /** Preenchido por `requireGuildAccess`. */
    guildScope?: GuildScope;
    /** Preenchido por `requireTwitchOwner`. */
    twitchScope?: TwitchScope;
  }
}
