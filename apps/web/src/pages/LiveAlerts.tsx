import { useState } from 'react';

import { Empty, ErrorBox, Loading, PageHead } from '../components/ui.js';
import {
  useGuildChannels,
  useGuilds,
  useLiveAlertMutations,
  useLiveAlerts,
  useTwitchChannels,
} from '../lib/queries.js';

const DEFAULT_MESSAGE = '@here {channel} ficou online jogando {game}! {title} -> {url}';

export function LiveAlertsPage() {
  const alerts = useLiveAlerts();
  const twitchChannels = useTwitchChannels();
  const guilds = useGuilds();
  const { create, update, remove } = useLiveAlertMutations();

  const [guildId, setGuildId] = useState('');
  const [discordChannelId, setDiscordChannelId] = useState('');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [error, setError] = useState<string | null>(null);

  const channels = useGuildChannels(guildId || undefined);
  const twitchChannel = twitchChannels.data?.[0];
  const guildsWithBot = (guilds.data ?? []).filter((guild) => guild.botPresent);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!twitchChannel) return;

    try {
      await create.mutateAsync({
        twitchChannelId: twitchChannel.id,
        guildId,
        discordChannelId,
        message,
      });
      setDiscordChannelId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui criar o alerta.');
    }
  }

  return (
    <>
      <PageHead
        title="Alertas de live"
        description="Quando seu canal ficar online na Twitch, o bot avisa no Discord."
      />

      {!twitchChannel ? (
        <div className="card">
          <Empty
            title="Vincule seu canal da Twitch primeiro"
            description="O alerta precisa saber qual canal monitorar."
          />
        </div>
      ) : (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Novo alerta</h2>
              <p>
                Monitorando <code>{twitchChannel.login}</code>. A verificação roda a cada minuto.
              </p>
            </div>
          </div>

          {error ? <div className="alert alert-error">{error}</div> : null}

          <form onSubmit={submit}>
            <div className="field-row">
              <div className="field">
                <label htmlFor="guild">Servidor do Discord</label>
                <select
                  id="guild"
                  value={guildId}
                  onChange={(e) => {
                    setGuildId(e.target.value);
                    setDiscordChannelId('');
                  }}
                  required
                >
                  <option value="">Selecione…</option>
                  {guildsWithBot.map((guild) => (
                    <option key={guild.id} value={guild.id}>
                      {guild.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="channel">Canal do anúncio</label>
                <select
                  id="channel"
                  value={discordChannelId}
                  onChange={(e) => setDiscordChannelId(e.target.value)}
                  disabled={!guildId || channels.isPending}
                  required
                >
                  <option value="">
                    {channels.isPending && guildId ? 'Carregando…' : 'Selecione…'}
                  </option>
                  {(channels.data ?? []).map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="message">Mensagem</label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
              <div className="hint">
                Variáveis: <code>{'{channel}'}</code> <code>{'{title}'}</code>{' '}
                <code>{'{game}'}</code> <code>{'{url}'}</code>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Criando…' : 'Criar alerta'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Alertas ativos</h2>
            <p>{alerts.data?.length ?? 0} configurado(s)</p>
          </div>
        </div>

        {alerts.isPending ? <Loading /> : null}
        {alerts.isError ? <ErrorBox error={alerts.error} /> : null}

        {alerts.data?.length === 0 ? (
          <Empty title="Nenhum alerta configurado" />
        ) : (
          <div className="stack">
            {(alerts.data ?? []).map((alert) => (
              <div
                key={alert.id}
                className="row-between"
                style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}
              >
                <div style={{ minWidth: 0 }}>
                  <div>
                    <strong>{alert.twitchChannel.displayName ?? alert.twitchChannel.login}</strong>
                    <span className="muted"> → {alert.guild.name}</span>
                  </div>
                  <div className="faint" style={{ marginTop: 2 }}>
                    {alert.message}
                  </div>
                </div>

                <div className="row">
                  <span className={alert.enabled ? 'badge badge-on' : 'badge badge-off'}>
                    {alert.enabled ? 'ativo' : 'pausado'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => update.mutate({ id: alert.id, enabled: !alert.enabled })}
                  >
                    {alert.enabled ? 'Pausar' : 'Ativar'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      if (confirm('Remover este alerta?')) remove.mutate(alert.id);
                    }}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
