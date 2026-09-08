import type { BuiltinCommand } from '../types.js';
import { botUptime } from '../variables.js';

export const uptimeCommand: BuiltinCommand = {
  name: 'uptime',
  description: 'Mostra há quanto tempo o bot está online.',
  cooldownSec: 10,
  async run(ctx) {
    await ctx.reply(`Estou online há ${botUptime()}.`);
  },
};
