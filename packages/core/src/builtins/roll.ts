import type { BuiltinCommand } from '../types.js';

const DEFAULT_SIDES = 6;
const MAX_SIDES = 1000;

export const rollCommand: BuiltinCommand = {
  name: 'dado',
  aliases: ['roll'],
  description: 'Rola um dado.',
  usage: 'dado [lados]',
  cooldownSec: 3,
  async run(ctx) {
    const requested = Number(ctx.args[0]);
    const sides =
      Number.isInteger(requested) && requested >= 2 && requested <= MAX_SIDES
        ? requested
        : DEFAULT_SIDES;

    const result = Math.floor(Math.random() * sides) + 1;
    await ctx.reply(`${ctx.user.displayName} rolou ${result} (d${sides}).`);
  },
};
