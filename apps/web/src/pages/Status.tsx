import { ErrorBox, Loading, PageHead } from '../components/ui.js';
import { goToOAuth } from '../lib/api-client.js';
import { useMe, useStatus } from '../lib/queries.js';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR');
}

export function StatusPage() {
  const status = useStatus();
  const me = useMe();

  if (status.isPending) return <Loading />;
  if (status.isError) return <ErrorBox error={status.error} />;

  const data = status.data;
  const bot = data?.status;

  return (
    <>
      <PageHead
        title="Status"
        description="Estado do worker que mantém as conexões com o Discord e a Twitch."
      />

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Worker</h2>
            <p>
              {data?.online
                ? `Última batida às ${bot ? formatTime(bot.updatedAt) : '—'}`
                : 'Sem sinal há mais de 30 segundos.'}
            </p>
          </div>
          <span className={data?.online ? 'badge badge-on' : 'badge badge-off'}>
            <span className="dot" /> {data?.online ? 'online' : 'offline'}
          </span>
        </div>

        {!data?.online ? (
          <div className="alert alert-info">
            O painel continua funcionando, mas o bot não está respondendo no chat. Verifique se o
            processo <code>@ndev/bot</code> está rodando.
          </div>
        ) : null}

        <div className="stat-grid">
          <div className="stat">
            <div className="stat-label">Discord</div>
            <div className="stat-value">{bot?.discord.ready ? 'conectado' : '—'}</div>
            <div className="faint">
              {bot?.discord.guildCount ?? 0} servidor(es)
              {bot?.discord.pingMs != null ? ` · ${bot.discord.pingMs}ms` : ''}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">Twitch</div>
            <div className="stat-value">{bot?.twitch.ready ? 'conectado' : '—'}</div>
            <div className="faint">
              {bot?.twitch.channels.length ?? 0} canal(is) no chat
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">Desde</div>
            <div className="stat-value">{bot ? formatTime(bot.startedAt) : '—'}</div>
            <div className="faint">último start do worker</div>
          </div>
        </div>
      </div>

      {me.data?.isOwner ? (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Conta do bot na Twitch</h2>
              <p>
                Define de qual conta saem as mensagens no chat. Faça login na conta do BOT, não na sua.
              </p>
            </div>
            <span className={me.data.twitchBotLinked ? 'badge badge-on' : 'badge badge-warn'}>
              {me.data.twitchBotLinked ? 'vinculada' : 'não vinculada'}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-twitch"
            onClick={() => goToOAuth('/auth/twitch/bot')}
          >
            {me.data.twitchBotLinked ? 'Revincular conta do bot' : 'Vincular conta do bot'}
          </button>
        </div>
      ) : null}

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Últimos comandos</h2>
            <p>O que rodou no chat recentemente</p>
          </div>
        </div>

        {data?.recent.length === 0 ? (
          <p className="muted">Nada por enquanto.</p>
        ) : (
          <table className="table">
            <tbody>
              {(data?.recent ?? []).map((entry, index) => (
                <tr key={`${entry.createdAt}-${index}`}>
                  <td style={{ width: 90 }}>
                    <span className="badge">{entry.platform === 'DISCORD' ? 'Discord' : 'Twitch'}</span>
                  </td>
                  <td>
                    <span className="cmd-name">{entry.command}</span>
                  </td>
                  <td className="muted">{entry.userName}</td>
                  <td className="faint" style={{ textAlign: 'right' }}>
                    {formatTime(entry.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
