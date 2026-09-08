import { Navigate } from 'react-router-dom';

import { goToOAuth } from '../lib/api-client.js';
import { useMe } from '../lib/queries.js';

export function LoginPage() {
  const me = useMe();

  if (me.isSuccess && me.data) return <Navigate to="/servidores" replace />;

  const cancelled = new URLSearchParams(window.location.search).get('erro') === 'cancelado';

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logo">🤖</div>
        <h1>NDev Chatbot</h1>
        <p className="muted" style={{ marginTop: 8, marginBottom: 24 }}>
          Um bot só, no Discord e na Twitch, gerenciado por aqui.
        </p>

        {cancelled ? (
          <div className="alert alert-error">Login cancelado. Tente de novo quando quiser.</div>
        ) : null}

        <button
          type="button"
          className="btn btn-discord btn-block"
          onClick={() => goToOAuth('/auth/discord')}
        >
          Entrar com Discord
        </button>

        <p className="faint" style={{ marginTop: 16 }}>
          Pedimos apenas seu perfil e a lista de servidores, para saber quais você administra.
        </p>
      </div>
    </div>
  );
}
