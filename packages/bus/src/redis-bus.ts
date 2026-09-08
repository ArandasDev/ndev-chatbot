import { createLogger, env } from '@ndev/config';
import { Redis } from 'ioredis';

import {
  CONTROL_CHANNEL,
  STATUS_KEY,
  STATUS_TTL_SEC,
  botStatusSchema,
  controlEventSchema,
  type BotStatus,
  type ControlEvent,
} from './events.js';

const log = createLogger('bus');

function connect(role: string): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5_000),
    lazyConnect: false,
  });

  client.on('error', (err: Error) => log.error(`conexao ${role} falhou:`, err.message));
  client.on('ready', () => log.debug(`conexao ${role} pronta`));
  return client;
}

export interface Bus {
  publish(event: ControlEvent): Promise<void>;
  subscribe(handler: (event: ControlEvent) => void | Promise<void>): Promise<void>;
  setStatus(status: BotStatus): Promise<void>;
  getStatus(): Promise<BotStatus | null>;
  close(): Promise<void>;
}

/**
 * Uma conexao para comandos e outra para subscribe: no Redis, um cliente inscrito
 * nao aceita outros comandos. A de subscribe so e aberta se alguem se inscrever.
 */
export function createBus(): Bus {
  const pub = connect('pub');
  let sub: Redis | null = null;

  return {
    async publish(event) {
      try {
        await pub.publish(CONTROL_CHANNEL, JSON.stringify(event));
        log.debug('publicado', event);
      } catch (err) {
        // Nao propaga: o painel nao deve falhar porque o Redis caiu. O bot pega
        // a mudanca quando o cache de settings expirar.
        log.error('falha ao publicar', event.type, (err as Error).message);
      }
    },

    async subscribe(handler) {
      sub ??= connect('sub');
      await sub.subscribe(CONTROL_CHANNEL);

      sub.on('message', (_channel: string, payload: string) => {
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(payload);
        } catch {
          log.warn('payload nao e JSON, ignorado');
          return;
        }

        // Valida na borda tambem aqui: o bus e uma entrada como qualquer outra.
        const result = controlEventSchema.safeParse(parsedJson);
        if (!result.success) {
          log.warn('evento invalido, ignorado:', result.error.issues[0]?.message);
          return;
        }

        void Promise.resolve(handler(result.data)).catch((err: Error) =>
          log.error('handler falhou para', result.data.type, err.message),
        );
      });

      log.info(`inscrito em ${CONTROL_CHANNEL}`);
    },

    async setStatus(status) {
      try {
        await pub.set(STATUS_KEY, JSON.stringify(status), 'EX', STATUS_TTL_SEC);
      } catch (err) {
        log.error('falha ao gravar status:', (err as Error).message);
      }
    },

    async getStatus() {
      try {
        const raw = await pub.get(STATUS_KEY);
        if (!raw) return null;
        const result = botStatusSchema.safeParse(JSON.parse(raw));
        return result.success ? result.data : null;
      } catch (err) {
        log.error('falha ao ler status:', (err as Error).message);
        return null;
      }
    },

    async close() {
      await Promise.allSettled([pub.quit(), sub?.quit()]);
    },
  };
}
