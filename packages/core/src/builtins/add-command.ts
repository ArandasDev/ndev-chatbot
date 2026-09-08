import { isAppError } from '../errors.js';
import { createCommand } from '../services/command.service.js';
import type { BuiltinCommand } from '../types.js';

export const addCommandCommand: BuiltinCommand = {
  name: 'addcmd',
  description: 'Cria um comando customizado.',
  usage: 'addcmd <nome> <resposta>',
  modOnly: true,
  cooldownSec: 0,
  async run(ctx) {
    const [name, ...rest] = ctx.args;
    const response = rest.join(' ');

    if (!name || !response) {
      await ctx.reply(`Uso: ${ctx.prefix}addcmd <nome> <resposta>`);
      return;
    }

    try {
      const created = await createCommand(
        { platform: ctx.platform, dbId: ctx.scope.dbId },
        { name, response },
        ctx.user.displayName,
      );
      await ctx.reply(`Comando ${ctx.prefix}${created.name} criado!`);
    } catch (err) {
      // Erro de dominio vira mensagem no chat; qualquer outro sobe para o motor.
      if (isAppError(err)) {
        await ctx.reply(err.message);
        return;
      }
      throw err;
    }
  },
};
