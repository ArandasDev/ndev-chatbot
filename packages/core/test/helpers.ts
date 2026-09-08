import { createEngine, type Engine, type EngineDeps } from '../src/engine.js';
import { createRegistry } from '../src/registry.js';
import type {
  BuiltinCommand,
  CommandContext,
  DispatchableCommand,
  IncomingMessage,
  ScopeSettings,
} from '../src/types.js';

export const testScope: ScopeSettings = {
  platform: 'TWITCH',
  dbId: 'scope-1',
  key: 'ndev',
  name: 'NDev',
  prefix: '!',
  enabled: true,
};

export function makeCommand(overrides: Partial<DispatchableCommand> = {}): DispatchableCommand {
  return {
    id: 'cmd-1',
    name: 'social',
    response: 'Segue lá {user}!',
    cooldownSec: 5,
    modOnly: false,
    uses: 0,
    ...overrides,
  };
}

export interface Harness {
  engine: Engine;
  replies: string[];
  usesIncremented: string[];
  logged: string[];
}

export interface HarnessOptions {
  scope?: ScopeSettings | null;
  command?: DispatchableCommand | null;
  builtins?: BuiltinCommand[];
}

export function makeHarness(options: HarnessOptions = {}): Harness {
  const replies: string[] = [];
  const usesIncremented: string[] = [];
  const logged: string[] = [];
  let uses = options.command?.uses ?? 0;

  const deps: EngineDeps = {
    registry: createRegistry(options.builtins ?? []),
    getScope: async () => (options.scope === undefined ? testScope : options.scope),
    findCommand: async () => options.command ?? null,
    incrementUses: async (id) => {
      usesIncremented.push(id);
      uses += 1;
      return uses;
    },
    logUse: async (entry) => {
      logged.push(entry.command);
    },
  };

  const engine = createEngine(deps);
  return { engine, replies, usesIncremented, logged };
}

export function makeMessage(
  content: string,
  harness: Harness,
  overrides: Partial<IncomingMessage> = {},
): IncomingMessage {
  return {
    platform: 'TWITCH',
    scopeKey: 'ndev',
    channelId: 'ndev',
    user: { id: 'u1', name: 'viewer', displayName: 'Viewer', isMod: false },
    content,
    isBot: false,
    reply: async (text) => {
      harness.replies.push(text);
    },
    ...overrides,
  };
}

export function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    platform: 'TWITCH',
    scope: testScope,
    channelId: 'ndev',
    user: { id: 'u1', name: 'viewer', displayName: 'Viewer', isMod: false },
    prefix: '!',
    commandName: 'teste',
    args: [],
    raw: '!teste',
    receivedAt: Date.now(),
    reply: async () => {},
    ...overrides,
  };
}
