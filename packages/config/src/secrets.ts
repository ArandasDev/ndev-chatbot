import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { env } from './env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // recomendado para GCM
const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex');

/**
 * Cifra um segredo de terceiro antes de ele tocar o banco.
 *
 * Token de OAuth no banco em texto puro significa que um dump vazado vira
 * sequestro das contas de Discord e Twitch dos usuarios. GCM da confidencialidade
 * e autenticidade: adulterar o valor no banco faz o decrypt falhar em vez de
 * devolver lixo.
 *
 * Formato: iv.authTag.ciphertext, tudo em base64url.
 */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptSecret(payload: string): string {
  const [ivPart, tagPart, dataPart] = payload.split('.');
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Segredo com formato invalido no banco.');
  }

  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/** Decifra sem explodir: usado onde um token corrompido nao deve derrubar o processo. */
export function tryDecryptSecret(payload: string): string | null {
  try {
    return decryptSecret(payload);
  } catch {
    return null;
  }
}
