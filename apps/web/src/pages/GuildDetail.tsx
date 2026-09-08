import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { CommandsPanel } from '../components/CommandsPanel.js';
import { StatsPanel } from '../components/StatsPanel.js';
import { ErrorBox, Loading, PageHead } from '../components/ui.js';
import { useGuild, useUpdateGuild } from '../lib/queries.js';

type Tab = 'geral' | 'comandos' | 'stats';

export function GuildDetailPage() {
  const { guildId = '' } = useParams();
  const guild = useGuild(guildId);
  const updateGuild = useUpdateGuild(guildId);

  const [tab, setTab] = useState<Tab>('comandos');
  const [prefix, setPrefix] = useState('');
  const [saved, setSaved] = useState(false);

  // Sincroniza o formulario quando os dados chegam (ou mudam em outra aba).
  useEffect(() => {
    if (guild.data) setPrefix(guild.data.prefix);
  }, [guild.data]);

  if (guild.isPending) return <Loading />;
  if (guild.isError) return <ErrorBox error={guild.error} />;
  if (!guild.data) return null;

  async function savePrefix(event: React.FormEvent) {
    event.preventDefault();
    await updateGuild.mutateAsync({ prefix });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <>
      <Link to="/servidores" className="faint">
        ← Servidores
      </Link>

      <PageHead
        title={guild.data.name}
        description={`Prefixo ${guild.data.prefix} · ${guild.data.commandCount} comando(s)`}
      />

      <div className="tabs">
        <button
          type="button"
          className={tab === 'comandos' ? 'tab active' : 'tab'}
          onClick={() => setTab('comandos')}
        >
          Comandos
        </button>
        <button
          type="button"
          className={tab === 'geral' ? 'tab active' : 'tab'}
          onClick={() => setTab('geral')}
        >
          Geral
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
          basePath={`/api/guilds/${guildId}/commands`}
          prefix={guild.data.prefix}
          scopeName={guild.data.name}
        />
      ) : null}

      {tab === 'geral' ? (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Prefixo</h2>
              <p>O caractere que marca o começo de um comando neste servidor.</p>
            </div>
          </div>

          {updateGuild.isError ? <ErrorBox error={updateGuild.error} /> : null}
          {saved ? <div className="alert alert-info">Salvo. Já vale no chat.</div> : null}

          <form onSubmit={savePrefix}>
            <div className="field" style={{ maxWidth: 180 }}>
              <label htmlFor="prefix">Prefixo</label>
              <input
                id="prefix"
                type="text"
                maxLength={5}
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={updateGuild.isPending}>
              {updateGuild.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          </form>
        </div>
      ) : null}

      {tab === 'stats' ? <StatsPanel basePath={`/api/guilds/${guildId}/stats`} /> : null}
    </>
  );
}
