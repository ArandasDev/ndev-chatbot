import { isAppError, notFound } from '../errors.js';
import {
  listCommands,
  normalizeCommandName,
  updateCommand,
} from '../services/command.service.js';
import type { BuiltinCommand } from '../types.js';

export const editCommandCommand: BuiltinCommand = {
  name: 'editcmd',
  description: 'Edita a resposta de um comando customizado.',
  usage: 'editcmd <nome> <nova resposta>',
  modOnly: true,
  cooldownSec: 0,
  async run(ctx) {
    const [rawName, ...rest] = ctx.args;
    const response = rest.join(' ');

    if (!rawName || !response) {
      await ctx.reply(`Uso: ${ctx.prefix}editcmd <nome> <nova resposta>`);
      return;
    }

    const scope = { platform: ctx.platform, dbId: ctx.scope.dbId };
    const name = normalizeCommandName(rawName);

    try {
      const existing = (await listCommands(scope)).find((command) => command.name === name);
      if (!existing) throw notFound('Esse comando não existe aqui.');

      await updateCommand(scope, existing.id, { response });
      await ctx.reply(`Comando ${ctx.prefix}${name} atualizado!`);
    } catch (err) {
      if (isAppError(err)) {
        await ctx.reply(err.message);
        return;
      }
      throw err;
    }
  },
};
