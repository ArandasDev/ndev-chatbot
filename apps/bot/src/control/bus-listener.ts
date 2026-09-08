import type { Bus, ControlEvent } from '@ndev/bus';
import { createLogger } from '@ndev/config';
import { invalidateScope } from '@ndev/core';

import type { TwitchAdapter } from '../adapters/twitch.adapter.js';

const log = createLogger('control');

export interface ControlHandlers {
  twitch: TwitchAdapter | null;
}

/**
 * Reage as mudancas feitas no painel.
 *
 * Todo handler apenas invalida cache ou ajusta conexao - nenhum deles confia no
 * conteudo do evento como dado de negocio: o bot sempre rele do Postgres.
 */
export async function startBusListener(bus: Bus, handlers: ControlHandlers): Promise<void> {
  await bus.subscribe(async (event: ControlEvent) => {
    log.debug('evento recebido:', event.type);

    switch (event.type) {
      case 'guild.settings.updated':
      case 'guild.commands.updated':
        invalidateScope('DISCORD', event.guildId);
        break;

      case 'twitch.channel.updated':
      case 'twitch.commands.updated':
        invalidateScope('TWITCH', event.login);
        break;

      case 'twitch.channel.join':
        invalidateScope('TWITCH', event.login);
        await handlers.twitch?.joinChannel(event.login);
        break;

      case 'twitch.channel.part':
        invalidateScope('TWITCH', event.login);
        await handlers.twitch?.partChannel(event.login);
        break;

      case 'bot.credentials.updated':
        log.info('credenciais da Twitch mudaram, reconectando o chat...');
        await handlers.twitch?.reload();
        break;
    }
  });
}
