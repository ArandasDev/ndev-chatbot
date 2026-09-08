import { Link } from 'react-router-dom';

import { Empty, ErrorBox, Loading, PageHead } from '../components/ui.js';
import { useGuilds } from '../lib/queries.js';

export function ServersPage() {
  const guilds = useGuilds();

  return (
    <>
      <PageHead
        title="Servidores"
        description="Servidores do Discord que você administra. Onde o bot já está, dá para configurar."
      />

      {guilds.isPending ? <Loading /> : null}
      {guilds.isError ? <ErrorBox error={guilds.error} /> : null}

      {guilds.data?.length === 0 ? (
        <div className="card">
          <Empty
            title="Nenhum servidor encontrado"
            description="Você precisa ter a permissão Gerenciar Servidor em pelo menos um servidor do Discord."
          />
        </div>
      ) : null}

      <div className="grid">
        {(guilds.data ?? []).map((guild) => (
          <div key={guild.id} className="server-card">
            <div className="server-card-top">
              {guild.iconUrl ? (
                <img className="server-icon" src={guild.iconUrl} alt="" />
              ) : (
                <div className="server-icon">{guild.name.charAt(0).toUpperCase()}</div>
              )}
              <div style={{ minWidth: 0 }}>
                <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {guild.name}
                </h2>
                {guild.botPresent ? (
                  <span className="faint">
                    prefixo <code>{guild.prefix}</code> · {guild.commandCount} comando(s)
                  </span>
                ) : (
                  <span className="faint">bot ainda não adicionado</span>
                )}
              </div>
            </div>

            {guild.botPresent ? (
              <Link className="btn btn-block" to={`/servidores/${guild.id}`}>
                Configurar
              </Link>
            ) : (
              <a
                className="btn btn-discord btn-block"
                href={guild.inviteUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                Adicionar bot
              </a>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
