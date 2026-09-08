import { env } from './env.js';

type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const COLOR: Record<Level, string> = {
  debug: '\u001b[90m',
  info: '\u001b[36m',
  warn: '\u001b[33m',
  error: '\u001b[31m',
};
const RESET = '\u001b[0m';

/** Chaves cujo valor nunca pode ir para o log. */
const SECRET_KEYS = [
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'authorization',
  'code',
  'client_secret',
  'clientsecret',
  'password',
  'secret',
  'cookie',
];

/**
 * Remove segredos antes de imprimir. Log de OAuth e o vazamento mais facil de
 * cometer: basta logar o corpo da resposta uma vez.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEYS.includes(key.toLowerCase()) ? '[redacted]' : redact(val, depth + 1);
  }
  return out;
}

function emit(level: Level, scope: string, args: unknown[]): void {
  if (ORDER[level] < ORDER[env.LOG_LEVEL]) return;

  const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
  const head = `${COLOR[level]}${time} ${level.toUpperCase().padEnd(5)} ${scope.padEnd(14)}${RESET}`;
  const safe = args.map((arg) => (typeof arg === 'object' ? redact(arg) : arg));
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  sink(head, ...safe);
}

export function createLogger(scope: string) {
  return {
    debug: (...args: unknown[]) => emit('debug', scope, args),
    info: (...args: unknown[]) => emit('info', scope, args),
    warn: (...args: unknown[]) => emit('warn', scope, args),
    error: (...args: unknown[]) => emit('error', scope, args),
    child: (sub: string) => createLogger(`${scope}:${sub}`),
  };
}

export type Logger = ReturnType<typeof createLogger>;
