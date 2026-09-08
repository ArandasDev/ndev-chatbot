/**
 * Nomes que um comando customizado nao pode usar, porque um builtin ja responde
 * por eles. Fica num arquivo sem imports de proposito: o service de comandos e
 * os proprios builtins precisam da lista, e importar um do outro criaria ciclo.
 *
 * O teste `builtins.test.ts` garante que esta lista e a lista real de builtins
 * nunca divergem.
 */
export const RESERVED_COMMAND_NAMES = [
  'ping',
  'ajuda',
  'help',
  'comandos',
  'addcmd',
  'editcmd',
  'delcmd',
  'uptime',
  'bot',
  'dado',
  'roll',
] as const;

/** Cooldown aplicado quando o comando nao define o proprio. */
export const DEFAULT_COOLDOWN_SEC = 5;

/** Limites de entrada, compartilhados entre painel e chat. */
export const COMMAND_NAME_MAX = 32;
export const COMMAND_RESPONSE_MAX = 500;
export const MAX_ALIASES = 5;
