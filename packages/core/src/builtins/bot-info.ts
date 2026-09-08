import type { BuiltinCommand } from '../types.js';

export const botInfoCommand: BuiltinCommand = {
  name: 'bot',
  description: 'Informações sobre o bot e link do painel.',
  cooldownSec: 15,
  async run(ctx) {
    // Lido direto do process.env de proposito: o @ndev/core nao depende do
    // @ndev/config, para continuar importavel em teste sem env completo.
    const panel = process.env.WEB_URL ?? 'http://localhost:5173';
    await ctx.reply(`NDev Chatbot rodando no ${ctx.platform === 'DISCORD' ? 'Discord' : 'Twitch'}. Painel: ${panel}`);
  },
};
