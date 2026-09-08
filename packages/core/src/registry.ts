import type { BuiltinCommand, Platform } from './types.js';

export interface BuiltinRegistry {
  find(name: string, platform: Platform): BuiltinCommand | undefined;
  list(platform: Platform): BuiltinCommand[];
  /** Nomes e apelidos, usado para validar comandos customizados. */
  allNames(): string[];
}

function supports(command: BuiltinCommand, platform: Platform): boolean {
  return !command.platforms || command.platforms.includes(platform);
}

/**
 * Indexa nome e apelidos num Map. Lookup de builtin acontece a cada mensagem
 * que comeca com o prefixo, entao precisa ser O(1).
 */
export function createRegistry(commands: readonly BuiltinCommand[]): BuiltinRegistry {
  const byName = new Map<string, BuiltinCommand>();

  for (const command of commands) {
    byName.set(command.name, command);
    for (const alias of command.aliases ?? []) byName.set(alias, command);
  }

  return {
    find(name, platform) {
      const found = byName.get(name.toLowerCase());
      return found && supports(found, platform) ? found : undefined;
    },
    list(platform) {
      return commands.filter((command) => supports(command, platform));
    },
    allNames() {
      return [...byName.keys()];
    },
  };
}
