import { Link } from 'react-router-dom';

import { Empty, ErrorBox, Loading, PageHead } from '../components/ui.js';
import { goToOAuth } from '../lib/api-client.js';
import { useGuilds, useMe } from '../lib/queries.js';

export function ServersPage() {
  const me = useMe();
  const guilds = useGuilds();

  // Quem entrou pela Twitch cai aqui sem Discord vinculado. Isso nao e erro,
  // e um passo que falta - e a tela precisa dizer qual.
  if (me.data && !me.data.connections.discord.linked) {
    return (
      <>
        <PageHead title="Servidores" description="Gerencie os servidores do Discord por aqui." />
        <div className="card">
          <Empty
            title="Conecte seu Discord"
            description="Para gerenciar servidores e comandos do Discord, o painel precisa saber quais servidores você administra."
            action={
              <button
                type="button"
                className="btn btn-discord"
                onClick={() => goToOAuth('/auth/discord')}
              >
                Conectar Discord
              </button>
            }
          />
        </div>
      </>
    );
  }

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
