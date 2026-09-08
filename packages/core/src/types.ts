import type { Platform } from '@ndev/db';

export type { Platform };

/** Autor da mensagem, normalizado pelas duas plataformas. */
export interface ChatUser {
  /** ID estavel na plataforma (snowflake ou user-id da Twitch). */
  id: string;
  /** Login/username unico, minusculo. */
  name: string;
  /** Nome exibido no chat. */
  displayName: string;
  /**
   * Moderador do canal, admin do servidor ou o proprio streamer.
   * Quem decide isso e o adapter - o motor apenas confia.
   */
  isMod: boolean;
}

/**
 * Escopo resolvido: um servidor do Discord ou um canal da Twitch.
 * E o unico lugar onde o motor guarda "onde estou".
 */
export interface ScopeSettings {
  platform: Platform;
  /** Guild.id ou TwitchChannel.id - a chave usada no banco. */
  dbId: string;
  /** guildId no Discord, login na Twitch - a chave usada pelo adapter. */
  key: string;
  /** Nome legivel, usado nas variaveis {server}/{channel}. */
  name: string;
  prefix: string;
  enabled: boolean;
}

/** Mensagem crua entregue pelo adapter. O adapter nao interpreta nada. */
export interface IncomingMessage {
  platform: Platform;
  /** guildId (Discord) ou login do canal (Twitch). */
  scopeKey: string;
  channelId: string;
  user: ChatUser;
  content: string;
  isBot: boolean;
  reply(text: string): Promise<void>;
}

/** Contexto entregue a um comando. Tudo que ele precisa, nada da plataforma. */
export interface CommandContext {
  platform: Platform;
  scope: ScopeSettings;
  channelId: string;
  user: ChatUser;
  prefix: string;
  commandName: string;
  args: string[];
  raw: string;
  /** Momento em que a mensagem entrou no motor, para medir latencia. */
  receivedAt: number;
  reply(text: string): Promise<void>;
}

export interface BuiltinCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  modOnly?: boolean;
  /** Cooldown proprio; cai no padrao do motor se omitido. */
  cooldownSec?: number;
  /** Se omitido, vale nas duas plataformas. */
  platforms?: Platform[];
  run(ctx: CommandContext): Promise<void> | void;
}

/** Projecao minima de um comando customizado, do ponto de vista do motor. */
export interface DispatchableCommand {
  id: string;
  name: string;
  response: string;
  cooldownSec: number;
  modOnly: boolean;
  uses: number;
}

/**
 * Resultado do dispatch. Existe para o adapter poder logar e metrificar sem
 * precisar inspecionar excecao.
 */
export type DispatchResult =
  | 'ignored'
  | 'not-a-command'
  | 'unknown-command'
  | 'cooldown'
  | 'forbidden'
  | 'ok'
  | 'error';

/** Contrato que todo adapter de plataforma implementa. */
export interface ChatPlatform {
  readonly platform: Platform;
  start(): Promise<void>;
  stop(): Promise<void>;
  say(target: string, text: string): Promise<void>;
  isReady(): boolean;
}
