import { createLogger, env } from '@ndev/config';
import { badRequest } from '@ndev/core';

const log = createLogger('twitch-api');

export interface TwitchTokenSet {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string[];
}

export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

export async function exchangeTwitchCode(code: string): Promise<TwitchTokenSet> {
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID!,
      client_secret: env.TWITCH_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${env.API_URL}/auth/twitch/callback`,
    }),
  });

  if (!response.ok) {
    log.error('troca de code falhou com status', response.status);
    throw badRequest('Não consegui concluir a autorização com a Twitch.');
  }

  return (await response.json()) as TwitchTokenSet;
}

export async function fetchTwitchUser(accessToken: string): Promise<TwitchUser> {
  const response = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': env.TWITCH_CLIENT_ID!,
    },
  });

  if (!response.ok) throw badRequest('Não consegui ler seu perfil na Twitch.');

  const payload = (await response.json()) as { data: TwitchUser[] };
  const user = payload.data[0];
  if (!user) throw badRequest('A Twitch não retornou nenhum usuário.');

  return user;
}

export function twitchAuthorizeUrl(state: string, scopes: string[]): string {
  const params = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID ?? '',
    redirect_uri: `${env.API_URL}/auth/twitch/callback`,
    response_type: 'code',
    scope: scopes.join(' '),
    state,
    // Garante a tela de consentimento: sem isso, trocar a conta do bot no mesmo
    // navegador reaproveita a sessao anterior silenciosamente.
    force_verify: 'true',
  });
  return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}
