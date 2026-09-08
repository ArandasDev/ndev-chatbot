import { DEFAULT_COOLDOWN_SEC } from './constants.js';
import { CooldownStore } from './cooldown.js';
import type { BuiltinRegistry } from './registry.js';
import { sanitizeReply } from './sanitize.js';
import type { CommandScope, CommandUseEntry } from './services/command.service.js';
import type {
  CommandContext,
  DispatchResult,
  DispatchableCommand,
  IncomingMessage,
  Platform,
  ScopeSettings,
} from './types.js';
import { render } from './variables.js';

export interface EngineLogger {
  debug(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

const noopLogger: EngineLogger = { debug: () => {}, warn: () => {}, error: () => {} };

/**
 * Tudo que o motor precisa do mundo externo. Injetado em vez de importado para
 * que o dispatch seja testavel sem banco - e para que trocar a origem dos dados
 * nao exija tocar na logica.
 */
export interface EngineDeps {
  registry: BuiltinRegistry;
  getScope(platform: Platform, key: string): Promise<ScopeSettings | null>;
  findCommand(scope: CommandScope, name: string): Promise<DispatchableCommand | null>;
  incrementUses(id: string): Promise<number>;
  logUse(entry: CommandUseEntry): Promise<void>;
  logger?: EngineLogger;
  defaultCooldownSec?: number;
}

export interface Engine {
  dispatch(message: IncomingMessage): Promise<DispatchResult>;
  cooldowns: CooldownStore;
}

export function createEngine(deps: EngineDeps): Engine {
  const log = deps.logger ?? noopLogger;
  const defaultCooldown = deps.defaultCooldownSec ?? DEFAULT_COOLDOWN_SEC;
  const cooldowns = new CooldownStore();

  async function dispatch(message: IncomingMessage): Promise<DispatchResult> {
    const receivedAt = Date.now();

    // Bot nunca responde bot: dois bots com o mesmo prefixo entram em loop infinito.
    if (message.isBot) return 'ignored';

    const scope = await deps.getScope(message.platform, message.scopeKey);
    if (!scope || !scope.enabled) return 'ignored';

    const content = message.content.trim();

    // Caminho quente: a esmagadora maioria das mensagens nao e comando e sai
    // daqui com uma unica comparacao de string, sem tocar no banco.
    if (!content.startsWith(scope.prefix)) return 'not-a-command';

    const withoutPrefix = content.slice(scope.prefix.length).trim();
    if (!withoutPrefix) return 'not-a-command';

    const [rawName, ...args] = withoutPrefix.split(/\s+/);
    if (!rawName) return 'not-a-command';
    const commandName = rawName.toLowerCase();

    const ctx: CommandContext = {
      platform: message.platform,
      scope,
      channelId: message.channelId,
      user: message.user,
      prefix: scope.prefix,
      commandName,
      args,
      raw: content,
      receivedAt,
      reply: async (text: string) => {
        const safe = sanitizeReply(text, message.platform);
        if (safe) await message.reply(safe);
      },
    };

    const commandScope: CommandScope = { platform: scope.platform, dbId: scope.dbId };

    const builtin = deps.registry.find(commandName, message.platform);
    if (builtin) {
      if (builtin.modOnly && !message.user.isMod) {
        await ctx.reply('Esse comando é só para moderadores.');
        return 'forbidden';
      }

      const cooldownSec = builtin.cooldownSec ?? defaultCooldown;
      if (!message.user.isMod && cooldowns.remaining(scope.dbId, commandName, cooldownSec) > 0) {
        return 'cooldown';
      }

      try {
        await builtin.run(ctx);
        cooldowns.mark(scope.dbId, commandName, cooldownSec);
        void track(commandScope, commandName, message);
        return 'ok';
      } catch (err) {
        log.error(`builtin ${commandName} falhou:`, (err as Error).message);
        return 'error';
      }
    }

    const custom = await deps.findCommand(commandScope, commandName);
    // Silencio proposital: um "comando nao existe" a cada erro de digitacao
    // vira spam no chat.
    if (!custom) return 'unknown-command';

    if (custom.modOnly && !message.user.isMod) {
      await ctx.reply('Esse comando é só para moderadores.');
      return 'forbidden';
    }

    if (!message.user.isMod && cooldowns.remaining(scope.dbId, custom.name, custom.cooldownSec) > 0) {
      return 'cooldown';
    }

    try {
      const uses = await deps.incrementUses(custom.id);
      await ctx.reply(render(custom.response, ctx, { count: uses }));
      cooldowns.mark(scope.dbId, custom.name, custom.cooldownSec);
      void track(commandScope, custom.name, message);
      return 'ok';
    } catch (err) {
      log.error(`comando ${custom.name} falhou:`, (err as Error).message);
      return 'error';
    }
  }

  /** Log de uso e best-effort: nunca deve atrasar nem derrubar a resposta. */
  async function track(scope: CommandScope, command: string, message: IncomingMessage) {
    try {
      await deps.logUse({
        platform: scope.platform,
        scopeId: scope.dbId,
        command,
        userName: message.user.displayName,
      });
    } catch (err) {
      log.warn('nao consegui registrar o uso do comando:', (err as Error).message);
    }
  }

  return { dispatch, cooldowns };
}
