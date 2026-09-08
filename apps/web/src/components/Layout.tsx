import { NavLink, Navigate, Outlet } from 'react-router-dom';

import { useLogout, useMe } from '../lib/queries.js';
import { Loading } from './ui.js';

const LINKS = [
  { to: '/servidores', label: 'Servidores', icon: '🖥️' },
  { to: '/twitch', label: 'Twitch', icon: '📺' },
  { to: '/alertas', label: 'Alertas de live', icon: '🔔' },
  { to: '/status', label: 'Status', icon: '📡' },
  { to: '/conta', label: 'Conta', icon: '🔗' },
];

/**
 * Casca autenticada.
 *
 * O painel nao decide sozinho se ha sessao: ele pergunta ao /api/me. Um 401
 * manda para o login. Como o cookie e httpOnly, nao existe token no browser
 * para o front inspecionar - e isso e proposital.
 */
export function ProtectedLayout() {
  const me = useMe();
  const logout = useLogout();

  if (me.isPending) return <Loading label="Verificando sessão…" />;
  if (me.isError || !me.data) return <Navigate to="/login" replace />;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-dot" />
          NDev Chatbot
        </div>

        <nav className="nav">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <span aria-hidden>{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {me.data.avatarUrl ? (
            <img className="avatar" src={me.data.avatarUrl} alt="" />
          ) : (
            <div className="avatar" />
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="user-name">{me.data.displayName}</div>
            <button
              type="button"
              className="faint"
              onClick={() => logout.mutate()}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
            >
              Sair
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
