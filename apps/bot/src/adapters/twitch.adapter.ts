import { createLogger, decryptSecret, encryptSecret, env } from '@ndev/config';
import type { ChatPlatform, Engine } from '@ndev/core';
import { prisma } from '@ndev/db';
import { RefreshingAuthProvider, type AccessToken } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';

const log = createLogger('twitch');

export interface TwitchAdapter extends ChatPlatform {
  joinChannel(login: string): Promise<void>;
  partChannel(login: string): Promise<void>;
  connectedChannels(): string[];
  /** Recarrega credenciais e canais - usado quando o painel vincula a conta do bot. */
  reload(): Promise<void>;
}

async function loadEnabledChannels(): Promise<string[]> {
  const channels = await prisma.twitchChannel.findMany({
    where: { enabled: true },
    select: { login: true },
  });
  return channels.map((channel) => channel.login);
}

/**
 * Adapter da Twitch.
 *
 * A conta do bot e vinculada pelo painel (OAuth) e as credenciais ficam cifradas
 * no banco. O RefreshingAuthProvider renova o access token sozinho e devolve o
 * novo par pelo onRefresh - que persiste cifrado de novo.
 */
export function createTwitchAdapter(engine: Engine): TwitchAdapter {
  let chat: ChatClient | null = null;
  let ready = false;
  const joined = new Set<string>();

  async function buildAuthProvider(): Promise<RefreshingAuthProvider | null> {
    if (!env.hasTwitch) {
      log.warn('TWITCH_CLIENT_ID/SECRET ausentes - bot da Twitch nao vai subir.');
      return null;
    }

    const credential = await prisma.botCredential.findUnique({ where: { id: 'twitch' } });
    if (!credential) {
      log.warn(
        `conta do bot nao vinculada. Abra ${env.API_URL}/auth/twitch/bot logado na conta do BOT para vincular.`,
      );
      return null;
    }

    const provider = new RefreshingAuthProvider({
      clientId: env.TWITCH_CLIENT_ID!,
      clientSecret: env.TWITCH_CLIENT_SECRET!,
    });

    provider.onRefresh(async (_userId, token) => {
      await prisma.botCredential.update({
        where: { id: 'twitch' },
        data: {
          accessToken: encryptSecret(token.accessToken),
          refreshToken: encryptSecret(token.refreshToken ?? ''),
          expiresAt: token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000) : null,
          scopes: token.scope,
        },
      });
      log.debug('token da Twitch renovado e regravado');
    });

    const expiresIn = credential.expiresAt
      ? Math.max(0, Math.floor((credential.expiresAt.getTime() - Date.now()) / 1000))
      : 0;

    const token: AccessToken = {
      accessToken: decryptSecret(credential.accessToken),
      refreshToken: decryptSecret(credential.refreshToken),
      expiresIn,
      obtainmentTimestamp: Date.now() - (expiresIn > 0 ? 0 : 1),
      scope: credential.scopes,
    };

    await provider.addUserForToken(token, ['chat']);
    return provider;
  }

  async function connect(): Promise<void> {
    const authProvider = await buildAuthProvider();
    if (!authProvider) return;

    const channels = await loadEnabledChannels();
    chat = new ChatClient({ authProvider, channels });

    chat.onConnect(() => {
      ready = true;
      log.info(`chat conectado (${channels.length} canal/canais)`);
    });

    chat.onDisconnect((manually, reason) => {
      ready = false;
      // twurple ja reconecta sozinho; aqui so registramos.
      if (!manually) log.warn('desconectado:', reason?.message ?? 'motivo desconhecido');
    });

    chat.onJoin((channel) => {
      joined.add(channel.replace(/^#/, ''));
    });

    chat.onPart((channel) => {
      joined.delete(channel.replace(/^#/, ''));
    });

    chat.onAuthenticationFailure((text) => {
      ready = false;
      log.error('autenticacao recusada:', text, '- revincule a conta do bot pelo painel.');
    });

    chat.onMessage((channel, user, text, msg) => {
      const login = channel.replace(/^#/, '');

      void engine
        .dispatch({
          platform: 'TWITCH',
          scopeKey: login,
          channelId: login,
          user: {
            id: msg.userInfo.userId,
            name: user,
            displayName: msg.userInfo.displayName || user,
            // O streamer nao aparece como "mod" na Twitch, mas manda no canal.
            isMod: msg.userInfo.isMod || msg.userInfo.isBroadcaster,
          },
          content: text,
          isBot: false,
          reply: async (reply) => {
            await chat?.say(login, reply);
          },
        })
        .catch((err: Error) => log.error('dispatch falhou:', err.message));
    });

    await chat.connect();
  }

  return {
    platform: 'TWITCH',

    async start() {
      await connect();
    },

    async stop() {
      ready = false;
      chat?.quit();
      chat = null;
      joined.clear();
    },

    async say(login, text) {
      if (!chat) return;
      await chat.say(login.replace(/^#/, ''), text);
    },

    async joinChannel(login) {
      if (!chat) return;
      await chat.join(login);
      joined.add(login);
      log.info(`entrou em #${login}`);
    },

    async partChannel(login) {
      if (!chat) return;
      chat.part(login);
      joined.delete(login);
      log.info(`saiu de #${login}`);
    },

    async reload() {
      await this.stop();
      await connect();
    },

    connectedChannels: () => [...joined],
    isReady: () => ready,
  };
}
