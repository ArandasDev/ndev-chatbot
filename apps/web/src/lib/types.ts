/**
 * Formato das respostas da API.
 *
 * Declarado aqui de proposito: o painel consome a API como qualquer outro
 * cliente. Importar tipos do backend criaria acoplamento de build entre um
 * bundle de browser e um pacote de servidor.
 */
export interface Me {
  id: string;
  discordId: string;
  username: string;
  avatarUrl: string | null;
  twitchLogin: string | null;
  isOwner: boolean;
  botInviteUrl: string;
  twitchBotLinked: boolean;
}

export interface GuildSummary {
  id: string;
  name: string;
  iconUrl: string | null;
  botPresent: boolean;
  prefix: string;
  commandCount: number;
  inviteUrl: string;
}

export interface GuildDetail {
  id: string;
  name: string;
  iconUrl: string | null;
  prefix: string;
  enabled: boolean;
  commandCount: number;
  liveAlertCount: number;
}

export interface TwitchChannel {
  id: string;
  login: string;
  displayName: string | null;
  prefix: string;
  enabled: boolean;
  _count: { commands: number };
}

export interface Command {
  id: string;
  name: string;
  response: string;
  aliases: string[];
  enabled: boolean;
  cooldownSec: number;
  modOnly: boolean;
  uses: number;
}

export interface CommandInput {
  name: string;
  response: string;
  cooldownSec: number;
  modOnly: boolean;
  enabled: boolean;
}

export interface TextChannel {
  id: string;
  name: string;
}

export interface LiveAlert {
  id: string;
  enabled: boolean;
  message: string;
  discordChannelId: string;
  twitchChannel: { id: string; login: string; displayName: string | null };
  guild: { id: string; name: string };
}

export interface BotStatus {
  startedAt: string;
  updatedAt: string;
  discord: { ready: boolean; guildCount: number; pingMs: number | null };
  twitch: { ready: boolean; channels: string[] };
}

export interface StatusResponse {
  online: boolean;
  status: BotStatus | null;
  recent: {
    platform: 'DISCORD' | 'TWITCH';
    command: string;
    userName: string;
    createdAt: string;
  }[];
}

export interface CommandStat {
  command: string;
  uses: number;
}

export interface VariableDoc {
  token: string;
  description: string;
}
