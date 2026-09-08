import { ErrorBox, Loading, PageHead } from '../components/ui.js';
import { goToOAuth } from '../lib/api-client.js';
import { useMe } from '../lib/queries.js';

/**
 * Conexoes da conta.
 *
 * Cada provedor destrava uma parte do produto, e a pagina diz qual - conectar
 * algo sem saber o que aquilo habilita e o tipo de tela que as pessoas ignoram.
 */
export function AccountPage() {
  const me = useMe();

  if (me.isPending) return <Loading />;
  if (me.isError) return <ErrorBox error={me.error} />;
  if (!me.data) return null;

  const { connections } = me.data;
  const error = new URLSearchParams(window.location.search).get('erro');

  return (
    <>
      <PageHead
        title="Conta"
        description="Conecte Discord e Twitch. Cada um destrava uma parte do painel."
      />

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card">
        <div className="row-between">
          <div>
            <h2>Discord</h2>
            <p className="faint" style={{ marginTop: 2 }}>
              Necessário para gerenciar servidores e comandos do Discord.
            </p>
          </div>

          <div className="row">
            {connections.discord.linked ? (
              <span className="badge badge-on">
                <span className="dot" /> conectado
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-discord"
                onClick={() => goToOAuth('/auth/discord')}
              >
                Conectar Discord
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row-between">
          <div>
            <h2>Twitch</h2>
            <p className="faint" style={{ marginTop: 2 }}>
              {connections.twitch.linked
                ? `Canal twitch.tv/${connections.twitch.login}`
                : 'Necessário para o chatbot entrar no seu chat e para os alertas de live.'}
            </p>
          </div>

          <div className="row">
            {connections.twitch.linked ? (
              <span className="badge badge-on">
                <span className="dot" /> conectado
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-twitch"
                onClick={() => goToOAuth('/auth/twitch')}
              >
                Conectar Twitch
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Como o chatbot entra no seu chat</h2>
        <p className="muted" style={{ marginTop: 6 }}>
          Você não precisa criar nem vincular nenhuma conta de bot. A conta que fala no chat é desta
          instância, configurada uma única vez pelo administrador. Do seu lado, é só conectar a
          Twitch e clicar em <strong>Ativar chatbot</strong> na página Twitch.
        </p>
      </div>
    </>
  );
}
