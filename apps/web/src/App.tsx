import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedLayout } from './components/Layout.js';
import { GuildDetailPage } from './pages/GuildDetail.js';
import { LiveAlertsPage } from './pages/LiveAlerts.js';
import { LoginPage } from './pages/Login.js';
import { ServersPage } from './pages/Servers.js';
import { StatusPage } from './pages/Status.js';
import { TwitchPage } from './pages/Twitch.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Sessao expirada nao deve virar retry: manda para o login na hora.
      retry: (failureCount, error) =>
        !(error instanceof Error && error.name === 'ApiError') && failureCount < 2,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Navigate to="/servidores" replace />} />
            <Route path="/servidores" element={<ServersPage />} />
            <Route path="/servidores/:guildId" element={<GuildDetailPage />} />
            <Route path="/twitch" element={<TwitchPage />} />
            <Route path="/alertas" element={<LiveAlertsPage />} />
            <Route path="/status" element={<StatusPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/servidores" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
