import { z } from 'zod';

/** Canal pub/sub. Direcao unica: api -> bot. */
export const CONTROL_CHANNEL = 'ndev:control';

/** Chave do heartbeat. O bot reescreve a cada 10s; a API le sob demanda. */
export const STATUS_KEY = 'ndev:bot:status';
export const STATUS_TTL_SEC = 30;

/**
 * Eventos de controle.
 *
 * Nenhum deles carrega dado de negocio - so o ID do que mudou. O bot sempre
 * rele do Postgres. Assim uma mensagem perdida custa no maximo o TTL do cache,
 * nunca um estado divergente.
 */
export const controlEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('guild.settings.updated'), guildId: z.string().min(1) }),
  z.object({ type: z.literal('guild.commands.updated'), guildId: z.string().min(1) }),
  z.object({ type: z.literal('twitch.channel.join'), login: z.string().min(1) }),
  z.object({ type: z.literal('twitch.channel.part'), login: z.string().min(1) }),
  z.object({ type: z.literal('twitch.channel.updated'), login: z.string().min(1) }),
  z.object({ type: z.literal('twitch.commands.updated'), login: z.string().min(1) }),
  z.object({ type: z.literal('bot.credentials.updated') }),
]);

export type ControlEvent = z.infer<typeof controlEventSchema>;
export type ControlEventType = ControlEvent['type'];

export const botStatusSchema = z.object({
  startedAt: z.string(),
  updatedAt: z.string(),
  discord: z.object({
    ready: z.boolean(),
    guildCount: z.number(),
    pingMs: z.number().nullable(),
  }),
  twitch: z.object({
    ready: z.boolean(),
    channels: z.array(z.string()),
  }),
});

export type BotStatus = z.infer<typeof botStatusSchema>;
