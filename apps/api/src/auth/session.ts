import { createLogger, env } from '@ndev/config';
import { forbidden, unauthorized } from '@ndev/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SignJWT, jwtVerify } from 'jose';

const log = createLogger('session');

export const SESSION_COOKIE = 'ndev_session';
const MAX_AGE_SEC = 7 * 24 * 60 * 60;
const key = new TextEncoder().encode(env.JWT_SECRET);

export interface SessionUser {
  id: string;
  discordId: string;
  isOwner: boolean;
}

/**
 * Opcoes do cookie de sessao.
 *
 * httpOnly: o token fica invisivel para JavaScript, o que neutraliza roubo de
 *   sessao por XSS. E a razao de nao usarmos localStorage.
 * sameSite lax: bloqueia o envio em requisicao cross-site iniciada por terceiro
 *   (CSRF) sem quebrar o retorno do OAuth, que e uma navegacao top-level.
 * secure em producao: o cookie nunca trafega fora de HTTPS.
 */
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.isProd,
    path: '/',
    maxAge: MAX_AGE_SEC,
  };
}

export async function issueSession(reply: FastifyReply, user: SessionUser): Promise<void> {
  const token = await new SignJWT({ discordId: user.discordId, isOwner: user.isOwner })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(key);

  reply.setCookie(SESSION_COOKIE, token, cookieOptions());
}

export function clearSession(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

export async function readSession(request: FastifyRequest): Promise<SessionUser | null> {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, key);
    if (!payload.sub) return null;

    return {
      id: payload.sub,
      discordId: String(payload.discordId ?? ''),
      isOwner: payload.isOwner === true,
    };
  } catch (err) {
    // Assinatura invalida ou expirada: tratado como visitante, sem vazar o motivo.
    log.debug('sessão rejeitada:', (err as Error).message);
    return null;
  }
}

/** preHandler: exige sessao valida e publica o usuario em request.currentUser. */
export async function requireUser(request: FastifyRequest): Promise<void> {
  const user = await readSession(request);
  if (!user) throw unauthorized();
  request.currentUser = user;
}

/** preHandler: exige que o usuario seja dono da instalacao (OWNER_DISCORD_IDS). */
export async function requireOwner(request: FastifyRequest): Promise<void> {
  await requireUser(request);
  if (!request.currentUser?.isOwner) {
    throw forbidden('Só o dono da instância pode fazer isso.');
  }
}

/** Nunca use fora de um preHandler que garanta a sessao. */
export function currentUser(request: FastifyRequest): SessionUser {
  const user = request.currentUser;
  if (!user) throw unauthorized();
  return user;
}
