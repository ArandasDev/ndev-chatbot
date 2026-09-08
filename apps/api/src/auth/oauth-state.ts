import { randomBytes, timingSafeEqual } from 'node:crypto';

import { env } from '@ndev/config';
import { badRequest } from '@ndev/core';
import type { FastifyReply, FastifyRequest } from 'fastify';

const STATE_COOKIE = 'ndev_oauth_state';
const MAX_AGE_SEC = 600;

/**
 * Protecao de CSRF do fluxo OAuth (double-submit).
 *
 * Sem isso um atacante monta um callback com o proprio `code` e faz a vitima
 * logar na conta DELE - e a partir dai tudo que a vitima configurar fica na
 * conta do atacante. O nonce vai no cookie e na URL; o callback so prossegue
 * se os dois baterem.
 *
 * O `intent` viaja junto para o callback saber qual fluxo esta concluindo,
 * ja que Discord e Twitch permitem uma unica redirect URI registrada.
 */
export function issueOAuthState(reply: FastifyReply, intent: string): string {
  const nonce = randomBytes(32).toString('base64url');
  const value = `${nonce}.${intent}`;

  reply.setCookie(STATE_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    path: '/',
    maxAge: MAX_AGE_SEC,
  });

  return value;
}

export function consumeOAuthState(request: FastifyRequest, reply: FastifyReply, received: string) {
  const stored = request.cookies[STATE_COOKIE];
  reply.clearCookie(STATE_COOKIE, { path: '/' });

  if (!stored || !received) throw badRequest('Sessão de login expirada. Tente novamente.');

  const a = Buffer.from(stored);
  const b = Buffer.from(received);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw badRequest('Sessão de login inválida. Tente novamente.');
  }

  const intent = stored.split('.')[1] ?? '';
  return { intent };
}
