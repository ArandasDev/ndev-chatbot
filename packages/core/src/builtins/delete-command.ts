import { isAppError } from '../errors.js';
import { deleteCommandByName } from '../services/command.service.js';
import type { BuiltinCommand } from '../types.js';

export const deleteCommandCommand: BuiltinCommand = {
  name: 'delcmd',
  description: 'Remove um comando customizado.',
  usage: 'delcmd <nome>',
  modOnly: true,
  cooldownSec: 0,
  async run(ctx) {
    const [name] = ctx.args;

    if (!name) {
      await ctx.reply(`Uso: ${ctx.prefix}delcmd <nome>`);
      return;
    }

    try {
      const removed = await deleteCommandByName(
        { platform: ctx.platform, dbId: ctx.scope.dbId },
        name,
      );
      await ctx.reply(`Comando ${ctx.prefix}${removed.name} removido.`);
    } catch (err) {
      if (isAppError(err)) {
        await ctx.reply(err.message);
        return;
      }
      throw err;
    }
  },
};
