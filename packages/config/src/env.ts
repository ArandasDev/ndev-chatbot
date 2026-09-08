import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Carrega o .env da raiz do monorepo. Um unico arquivo serve os tres processos:
 * duplicar env por app e a origem classica de "funciona na API mas nao no bot".
 */
function loadEnvFile(): void {
  if (process.env.NDEV_SKIP_ENV_FILE === '1') return;

  // packages/config/src -> raiz do monorepo
  const candidates = [resolve(here, '../../../.env'), resolve(process.cwd(), '.env')];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
  }
}

loadEnvFile();

const hex32 = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, 'precisa ter 64 caracteres hexadecimais (32 bytes)');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  API_PORT: z.coerce.number().int().positive().default(3001),
  API_URL: z.string().url().default('http://localhost:3001'),
  WEB_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'obrigatoria'),
  REDIS_URL: z.string().min(1, 'obrigatoria').default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32, 'use pelo menos 32 caracteres'),
  ENCRYPTION_KEY: hex32,

  DISCORD_TOKEN: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),

  TWITCH_CLIENT_ID: z.string().optional(),
  TWITCH_CLIENT_SECRET: z.string().optional(),

  LIVE_POLL_INTERVAL_SEC: z.coerce.number().int().min(30).default(60),

  /** Donos da instancia: podem vincular a conta do bot na Twitch. */
  OWNER_DISCORD_IDS: z.string().default(''),
  OWNER_TWITCH_LOGINS: z.string().default(''),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n[config] Variaveis de ambiente invalidas:\n');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\nCopie .env.example para .env e preencha os valores.\n');
  process.exit(1);
}

const raw = parsed.data;

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  ...raw,
  isProd: raw.NODE_ENV === 'production',
  isDev: raw.NODE_ENV === 'development',

  /** O bot do Discord so sobe com token; sem ele o resto do sistema continua funcionando. */
  hasDiscordBot: Boolean(raw.DISCORD_TOKEN),
  /** Login no painel depende do OAuth do Discord. */
  hasDiscordOAuth: Boolean(raw.DISCORD_CLIENT_ID && raw.DISCORD_CLIENT_SECRET),
  hasTwitch: Boolean(raw.TWITCH_CLIENT_ID && raw.TWITCH_CLIENT_SECRET),

  ownerDiscordIds: splitList(raw.OWNER_DISCORD_IDS),
  ownerTwitchLogins: splitList(raw.OWNER_TWITCH_LOGINS).map((login) => login.toLowerCase()),
} as const;

export type Env = typeof env;
