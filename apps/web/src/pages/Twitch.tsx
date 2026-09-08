import { useState } from 'react';

import { CommandsPanel } from '../components/CommandsPanel.js';
import { StatsPanel } from '../components/StatsPanel.js';
import { Empty, ErrorBox, Loading, PageHead } from '../components/ui.js';
import { goToOAuth } from '../lib/api-client.js';
import { useTwitchChannels, useUpdateTwitchChannel } from '../lib/queries.js';

export function TwitchPage() {
  const channels = useTwitchChannels();

  if (channels.isPending) return <Loading />;
  if (channels.isError) return <ErrorBox error={channels.error} />;

  const channel = channels.data?.[0];

  return (
    <>
      <PageHead
        title="Twitch"
        description="Vincule seu canal para o bot entrar no chat e responder aos mesmos comandos."
      />

      {!channel ? (
        <div className="card">
          <Empty
            title="Nenhum canal vinculado"
            description="Você autoriza com sua própria conta da Twitch — é assim que provamos que o canal é seu."
            action={
              <button
                type="button"
                className="btn btn-twitch"
                onClick={() => goToOAuth('/auth/twitch')}
              >
                Vincular canal da Twitch
              </button>
            }
          />
        </div>
      ) : (
        <ChannelPanel channelId={channel.id} />
      )}
    </>
  );
}

function ChannelPanel({ channelId }: { channelId: string }) {
  const channels = useTwitchChannels();
  const update = useUpdateTwitchChannel(channelId);
  const [tab, setTab] = useState<'comandos' | 'stats'>('comandos');

  const channel = channels.data?.find((item) => item.id === channelId);
  if (!channel) return null;

  return (
    <>
      <div className="card">
        <div className="row-between">
          <div>
            <h2>{channel.displayName ?? channel.login}</h2>
            <p className="faint">
              twitch.tv/{channel.login} · prefixo <code>{channel.prefix}</code>
            </p>
          </div>

          <div className="row">
            {channel.enabled ? (
              <span className="badge badge-on">
                <span className="dot" /> no chat
              </span>
            ) : (
              <span className="badge badge-off">pausado</span>
            )}
            <button
              type="button"
              className="btn btn-sm"
              disabled={update.isPending}
              onClick={() => update.mutate({ enabled: !channel.enabled })}
            >
              {channel.enabled ? 'Tirar do chat' : 'Colocar no chat'}
            </button>
          </div>
        </div>
        {update.isError ? (
          <div style={{ marginTop: 12 }}>
            <ErrorBox error={update.error} />
          </div>
        ) : null}
      </div>

      <div className="tabs" style={{ marginTop: 18 }}>
        <button
          type="button"
          className={tab === 'comandos' ? 'tab active' : 'tab'}
          onClick={() => setTab('comandos')}
        >
          Comandos
        </button>
        <button
          type="button"
          className={tab === 'stats' ? 'tab active' : 'tab'}
          onClick={() => setTab('stats')}
        >
          Estatísticas
        </button>
      </div>

      {tab === 'comandos' ? (
        <CommandsPanel
          basePath={`/api/twitch/channels/${channelId}/commands`}
          prefix={channel.prefix}
          scopeName={channel.displayName ?? channel.login}
        />
      ) : (
        <StatsPanel basePath={`/api/twitch/channels/${channelId}/stats`} />
      )}
    </>
  );
}
