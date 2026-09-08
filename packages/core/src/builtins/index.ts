import type { BuiltinCommand } from '../types.js';

import { addCommandCommand } from './add-command.js';
import { botInfoCommand } from './bot-info.js';
import { deleteCommandCommand } from './delete-command.js';
import { editCommandCommand } from './edit-command.js';
import { helpCommand } from './help.js';
import { pingCommand } from './ping.js';
import { rollCommand } from './roll.js';
import { uptimeCommand } from './uptime.js';

/** Ordem importa apenas para o !ajuda. */
export const BUILTINS: readonly BuiltinCommand[] = [
  pingCommand,
  helpCommand,
  uptimeCommand,
  rollCommand,
  botInfoCommand,
  addCommandCommand,
  editCommandCommand,
  deleteCommandCommand,
];
