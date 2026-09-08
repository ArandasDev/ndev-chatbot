import { useState } from 'react';

import { CommandsPanel } from '../components/CommandsPanel.js';
import { StatsPanel } from '../components/StatsPanel.js';
import { Empty, ErrorBox, Loading, PageHead } from '../components/ui.js';
import { goToOAuth } from '../lib/api-client.js';
import { useMe, useTwitchChannels, useUpdateTwitchChannel } from '../lib/queries.js';

export function TwitchPage() {
  const me = useMe();
  const channels = useTwitchChannels();

  if (me.isPending || channels.isPending) return <Loading />;
  if (channels.isError) return <ErrorBox error={channels.error} />;

  const channel = channels.data?.[0];

  if (!me.data?.connections.twitch.linked || !channel) {
    return (
      <>
        <PageHead
          title="Twitch"
          description="Conecte seu canal para o chatbot responder no seu chat."
        />
        <div className="card">
          <Empty
            title="Conecte sua conta da Twitch"
            description="Você autoriza com a sua própria conta — é assim que provamos que o canal é seu. Nenhuma conta de bot é necessária."
            action={
              <button
                type="button"
                className="btn btn-twitch"
                onClick={() => goToOAuth('/auth/twitch')}
              >
                Conectar Twitch
              </button>
            }
          />
        </div>
      </>
    );
  }

  return <ChannelPanel channelId={channel.id} />;
}

function ChannelPanel({ channelId }: { channelId: string }) {
  const me = useMe();
  const channels = useTwitchChannels();
  const update = useUpdateTwitchChannel(channelId);
  const [tab, setTab] = useState<'comandos' | 'stats'>('comandos');

  const channel = channels.data?.find((item) => item.id === channelId);
  if (!channel) return null;

  const chatbotConfigured = me.data?.chatbotConfigured ?? false;
  const active = channel.enabled;

  return (
    <>
      <PageHead
        title={channel.displayName ?? channel.login}
        description={`twitch.tv/${channel.login}`}
      />

      {/*
        O botao de ativar e o centro da pagina de proposito. Do lado do
        streamer, ativar o chatbot é UM clique: a conta que fala no chat é da
        instância, não dele.
      */}
      <div className="card">
        <div className="row-between">
          <div>
            <h2>Chatbot no seu chat</h2>
            <p className="faint" style={{ marginTop: 2 }}>
              {active
                ? 'O bot está no seu chat e respondendo aos comandos.'
                : 'O bot ainda não entrou no seu chat.'}
            </p>
          </div>

          <div className="row">
            <span className={active ? 'badge badge-on' : 'badge badge-off'}>
              <span className="dot" /> {active ? 'ativo' : 'inativo'}
            </span>
            <button
              type="button"
              className={active ? 'btn' : 'btn btn-primary'}
              disabled={update.isPending || (!active && !chatbotConfigured)}
              onClick={() => update.mutate({ enabled: !active })}
            >
              {update.isPending ? 'Aguarde…' : active ? 'Desativar chatbot' : 'Ativar chatbot'}
            </button>
          </div>
        </div>

        {!chatbotConfigured ? (
          <div className="alert alert-info" style={{ marginTop: 14, marginBottom: 0 }}>
            O administrador desta instância ainda não configurou a conta que fala no chat. Ativar
            agora não teria efeito.
          </div>
        ) : null}

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
