import type { BuiltinCommand } from '../types.js';

export const pingCommand: BuiltinCommand = {
  name: 'ping',
  description: 'Verifica se o bot está respondendo.',
  cooldownSec: 3,
  async run(ctx) {
    // Latencia de processamento (nao inclui a ida ate a plataforma), que e a
    // unica coisa que o motor consegue medir honestamente.
    const ms = Date.now() - ctx.receivedAt;
    await ctx.reply(`Pong! Processei em ${ms}ms.`);
  },
};
