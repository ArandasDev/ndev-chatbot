import { listCommands } from '../services/command.service.js';
import type { BuiltinCommand } from '../types.js';

export const helpCommand: BuiltinCommand = {
  name: 'ajuda',
  aliases: ['help', 'comandos'],
  description: 'Lista os comandos disponíveis.',
  cooldownSec: 15,
  async run(ctx) {
    const { prefix } = ctx;

    const custom = await listCommands({ platform: ctx.platform, dbId: ctx.scope.dbId });
    const customNames = custom
      .filter((command) => command.enabled)
      .map((command) => `${prefix}${command.name}`);

    const parts = [`Nativos: ${prefix}ping ${prefix}uptime ${prefix}dado ${prefix}bot`];
    if (customNames.length > 0) {
      parts.push(`Deste canal: ${customNames.join(' ')}`);
    } else {
      parts.push(`Ainda não há comandos customizados. Um moderador pode criar com ${prefix}addcmd.`);
    }

    await ctx.reply(parts.join(' | '));
  },
};
