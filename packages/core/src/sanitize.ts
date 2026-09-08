import type { Platform } from './types.js';

/** Twitch corta perto de 500 chars; Discord aceita 2000, mas 1900 deixa folga. */
const MAX_LENGTH: Record<Platform, number> = {
  DISCORD: 1900,
  TWITCH: 450,
};

const ZERO_WIDTH = '\u200b';

/**
 * Saneia toda resposta antes de sair do bot.
 *
 * Sem isso, "!addcmd oi @everyone" transforma qualquer moderador em pingador do
 * servidor inteiro. O zero-width space quebra o parser de mencao do Discord mas
 * continua legivel para humanos.
 */
export function sanitizeReply(text: string, platform: Platform): string {
  let out = text.replace(/@(everyone|here)/gi, (match) => `@${ZERO_WIDTH}${match.slice(1)}`);

  if (platform === 'TWITCH') {
    // IRC: quebra de linha encerra a mensagem e permite injetar um segundo comando.
    out = out.replace(/[\r\n]+/g, ' ');
    // "/" e "." no inicio viram comandos de moderacao da Twitch (/ban, .timeout).
    out = out.replace(/^[/.]+/, '');
  }

  out = out.trim();

  const limit = MAX_LENGTH[platform];
  if (out.length > limit) {
    out = `${out.slice(0, limit - 1).trimEnd()}\u2026`;
  }

  return out;
}
