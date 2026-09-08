import { Navigate } from 'react-router-dom';

import { goToOAuth } from '../lib/api-client.js';
import { useMe } from '../lib/queries.js';

/**
 * Duas portas de entrada com o mesmo peso.
 *
 * Quem transmite chega pela Twitch; quem administra comunidade chega pelo
 * Discord. Obrigar os dois a passarem pela mesma porta e pedir para metade
 * desistir no primeiro clique - a outra conta se vincula depois, por dentro.
 */
export function LoginPage() {
  const me = useMe();

  if (me.isSuccess && me.data) return <Navigate to="/servidores" replace />;

  const error = new URLSearchParams(window.location.search).get('erro');

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logo">🤖</div>
        <h1>NDev Chatbot</h1>
        <p className="muted" style={{ marginTop: 8, marginBottom: 22 }}>
          Um bot só, no Discord e na Twitch, gerenciado por aqui.
        </p>

        {error ? (
          <div className="alert alert-error">
            {error === 'cancelado' ? 'Login cancelado. Tente de novo quando quiser.' : error}
          </div>
        ) : null}

        <div className="stack">
          <button
            type="button"
            className="btn btn-discord btn-block"
            onClick={() => goToOAuth('/auth/discord')}
          >
            Entrar com Discord
          </button>

          <button
            type="button"
            className="btn btn-twitch btn-block"
            onClick={() => goToOAuth('/auth/twitch')}
          >
            Entrar com Twitch
          </button>
        </div>

        <p className="faint" style={{ marginTop: 18 }}>
          Entre por onde preferir — a outra conta você vincula depois, dentro do painel.
        </p>
      </div>
    </div>
  );
}
