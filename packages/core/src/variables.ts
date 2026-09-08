import type { CommandContext } from './types.js';

const processStartedAt = Date.now();

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

export function botUptime(): string {
  return formatDuration(Date.now() - processStartedAt);
}

export interface RenderExtras {
  count?: number;
}

/**
 * Interpola as variaveis de uma resposta customizada.
 *
 * Allowlist fechada e substituicao textual: NAO existe execucao de codigo aqui.
 * Um comando criado por um moderador nunca deve virar vetor de execucao remota.
 *
 *   {user} {mention} {target} {channel} {server}
 *   {args} {arg1}..{argN} {count} {uptime} {platform}
 *   {random:a|b|c}
 */
export function render(template: string, ctx: CommandContext, extras: RenderExtras = {}): string {
  const target = (ctx.args[0] ?? ctx.user.displayName).replace(/^@/, '');

  return template
    .replace(/\{random:([^}]*)\}/gi, (_match, list: string) => {
      const options = list
        .split('|')
        .map((option) => option.trim())
        .filter(Boolean);
      if (options.length === 0) return '';
      return options[Math.floor(Math.random() * options.length)] ?? '';
    })
    .replace(/\{arg(\d+)\}/gi, (_match, index: string) => ctx.args[Number(index) - 1] ?? '')
    .replace(/\{user\}/gi, ctx.user.displayName)
    .replace(/\{mention\}/gi, ctx.platform === 'DISCORD' ? `<@${ctx.user.id}>` : `@${ctx.user.displayName}`)
    .replace(/\{target\}/gi, target)
    .replace(/\{channel\}/gi, ctx.scope.name)
    .replace(/\{server\}/gi, ctx.scope.name)
    .replace(/\{args\}/gi, ctx.args.join(' '))
    .replace(/\{count\}/gi, String(extras.count ?? 0))
    .replace(/\{uptime\}/gi, botUptime())
    .replace(/\{platform\}/gi, ctx.platform === 'DISCORD' ? 'Discord' : 'Twitch')
    .trim();
}

/** Variaveis oferecidas no editor do painel. */
export const AVAILABLE_VARIABLES = [
  { token: '{user}', description: 'Nome de quem usou o comando' },
  { token: '{mention}', description: 'Menciona quem usou o comando' },
  { token: '{target}', description: 'Primeiro argumento, ou o proprio usuario' },
  { token: '{channel}', description: 'Nome do canal / servidor' },
  { token: '{args}', description: 'Todos os argumentos' },
  { token: '{arg1}', description: 'Primeiro argumento (arg2, arg3...)' },
  { token: '{count}', description: 'Quantas vezes o comando ja foi usado' },
  { token: '{uptime}', description: 'Ha quanto tempo o bot esta online' },
  { token: '{platform}', description: 'Discord ou Twitch' },
  { token: '{random:a|b|c}', description: 'Sorteia uma das opcoes' },
] as const;
