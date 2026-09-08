import { createLogger, env } from '@ndev/config';
import type { ChatPlatform, Engine } from '@ndev/core';
import { invalidateScope } from '@ndev/core';
import { prisma } from '@ndev/db';
import {
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  type Guild as DiscordGuild,
  type Message,
} from 'discord.js';

const log = createLogger('discord');

export interface DiscordAdapter extends ChatPlatform {
  readonly client: Client;
  guildCount(): number;
  pingMs(): number | null;
}

/**
 * Adapter do Discord.
 *
 * Responsabilidade unica: traduzir eventos do discord.js para o formato do motor
 * e devolver a resposta. Nenhuma regra de comando mora aqui.
 */
export function createDiscordAdapter(engine: Engine): DiscordAdapter {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      // Privilegiado: precisa estar ligado no Developer Portal, senao toda
      // mensagem chega com content vazio e nenhum comando funciona.
      GatewayIntentBits.MessageContent,
    ],
  });

  let ready = false;

  /** Mantem a tabela de guilds em dia com a realidade do gateway. */
  async function syncGuild(guild: DiscordGuild): Promise<void> {
    await prisma.guild.upsert({
      where: { id: guild.id },
      create: { id: guild.id, name: guild.name, icon: guild.iconURL() },
      update: { name: guild.name, icon: guild.iconURL(), enabled: true },
    });
    invalidateScope('DISCORD', guild.id);
  }

  /**
   * Quem pode usar comando de moderador: dono do servidor ou quem administra
   * mensagens/servidor. Deliberadamente NAO usamos "tem cargo de mod" - cargo e
   * nome, permissao e contrato.
   */
  function isModerator(message: Message<true>): boolean {
    if (message.guild.ownerId === message.author.id) return true;

    const permissions = message.member?.permissions;
    if (!permissions) return false;

    return (
      permissions.has(PermissionFlagsBits.ManageMessages) ||
      permissions.has(PermissionFlagsBits.ManageGuild) ||
      permissions.has(PermissionFlagsBits.Administrator)
    );
  }

  client.once(Events.ClientReady, (bot) => {
    ready = true;
    log.info(`conectado como ${bot.user.tag} em ${bot.guilds.cache.size} servidor(es)`);

    void Promise.all(bot.guilds.cache.map((guild) => syncGuild(guild))).catch((err: Error) =>
      log.error('falha ao sincronizar guilds:', err.message),
    );
  });

  client.on(Events.GuildCreate, (guild) => {
    log.info(`adicionado em ${guild.name} (${guild.id})`);
    void syncGuild(guild).catch((err: Error) => log.error('falha no upsert:', err.message));
  });

  client.on(Events.GuildDelete, (guild) => {
    log.info(`removido de ${guild.name} (${guild.id})`);
    // Desativa em vez de apagar: se o bot voltar, os comandos continuam la.
    void prisma.guild
      .update({ where: { id: guild.id }, data: { enabled: false } })
      .then(() => invalidateScope('DISCORD', guild.id))
      .catch(() => undefined);
  });

  client.on(Events.MessageCreate, (message) => {
    if (!message.inGuild()) return;

    void engine
      .dispatch({
        platform: 'DISCORD',
        scopeKey: message.guildId,
        channelId: message.channelId,
        user: {
          id: message.author.id,
          name: message.author.username,
          displayName: message.member?.displayName ?? message.author.displayName,
          isMod: isModerator(message),
        },
        content: message.content,
        isBot: message.author.bot,
        reply: async (text) => {
          await message.reply({
            content: text,
            // Reforca o sanitize: mesmo que algo escape, o Discord nao pinga ninguem.
            allowedMentions: { parse: ['users'] },
          });
        },
      })
      .catch((err: Error) => log.error('dispatch falhou:', err.message));
  });

  client.on(Events.Error, (err) => log.error('erro no gateway:', err.message));

  return {
    platform: 'DISCORD',
    client,

    async start() {
      if (!env.DISCORD_TOKEN) {
        log.warn('DISCORD_TOKEN ausente - bot do Discord nao vai subir.');
        return;
      }
      await client.login(env.DISCORD_TOKEN);
    },

    async stop() {
      ready = false;
      await client.destroy();
    },

    async say(channelId, text) {
      const channel = await client.channels.fetch(channelId);
      if (!channel?.isTextBased() || !('send' in channel)) {
        log.warn(`canal ${channelId} nao aceita mensagem`);
        return;
      }
      await channel.send({ content: text, allowedMentions: { parse: ['users', 'everyone'] } });
    },

    isReady: () => ready,
    guildCount: () => client.guilds.cache.size,
    pingMs: () => (ready && client.ws.ping >= 0 ? Math.round(client.ws.ping) : null),
  };
}
