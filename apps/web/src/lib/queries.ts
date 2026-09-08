import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';


import { api } from '@/lib/api-client';
import type {
  Command,
  CommandInput,
  CommandStat,
  GuildDetail,
  GuildSummary,
  LiveAlert,
  Me,
  StatusResponse,
  TextChannel,
  TwitchChannel,
  VariableDoc,
} from '@/lib/types';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<Me>('/api/me'),
    retry: false,
    staleTime: 60_000,
  });
}

export function useGuilds() {
  return useQuery({ queryKey: ['guilds'], queryFn: () => api.get<GuildSummary[]>('/api/guilds') });
}

export function useGuild(guildId: string) {
  return useQuery({
    queryKey: ['guild', guildId],
    queryFn: () => api.get<GuildDetail>(`/api/guilds/${guildId}`),
  });
}

export function useGuildChannels(guildId: string | undefined) {
  return useQuery({
    queryKey: ['guild-channels', guildId],
    queryFn: () => api.get<TextChannel[]>(`/api/guilds/${guildId}/channels`),
    enabled: Boolean(guildId),
  });
}

export function useUpdateGuild(guildId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: { prefix?: string; enabled?: boolean }) =>
      api.patch<GuildDetail>(`/api/guilds/${guildId}`, data),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['guild', guildId] });
      void client.invalidateQueries({ queryKey: ['guilds'] });
    },
  });
}

export function useTwitchChannels() {
  return useQuery({
    queryKey: ['twitch-channels'],
    queryFn: () => api.get<TwitchChannel[]>('/api/twitch/channels'),
  });
}

export function useUpdateTwitchChannel(channelId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: { prefix?: string; enabled?: boolean }) =>
      api.patch<TwitchChannel>(`/api/twitch/channels/${channelId}`, data),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['twitch-channels'] }),
  });
}

/**
 * Comandos sao os mesmos nos dois escopos; muda so o caminho base.
 * Por isso os hooks recebem `basePath` em vez de existirem em duas versoes.
 */
export function useCommands(basePath: string) {
  return useQuery({
    queryKey: ['commands', basePath],
    queryFn: () => api.get<Command[]>(basePath),
  });
}

export function useCommandMutations(basePath: string) {
  const client = useQueryClient();
  const invalidate = () => void client.invalidateQueries({ queryKey: ['commands', basePath] });

  return {
    create: useMutation({
      mutationFn: (input: CommandInput) => api.post<Command>(basePath, input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: Partial<CommandInput> & { id: string }) =>
        api.patch<Command>(`${basePath}/${id}`, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete<void>(`${basePath}/${id}`),
      onSuccess: invalidate,
    }),
  };
}

export function useStats(basePath: string) {
  return useQuery({
    queryKey: ['stats', basePath],
    queryFn: () => api.get<{ top: CommandStat[] }>(basePath),
  });
}

export function useLiveAlerts() {
  return useQuery({
    queryKey: ['live-alerts'],
    queryFn: () => api.get<LiveAlert[]>('/api/live-alerts'),
  });
}

export function useLiveAlertMutations() {
  const client = useQueryClient();
  const invalidate = () => void client.invalidateQueries({ queryKey: ['live-alerts'] });

  return {
    create: useMutation({
      mutationFn: (input: {
        twitchChannelId: string;
        guildId: string;
        discordChannelId: string;
        message?: string;
      }) => api.post<LiveAlert>('/api/live-alerts', input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...data }: { id: string; enabled?: boolean; message?: string }) =>
        api.patch<LiveAlert>(`/api/live-alerts/${id}`, data),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete<void>(`/api/live-alerts/${id}`),
      onSuccess: invalidate,
    }),
  };
}

export function useStatus() {
  return useQuery({
    queryKey: ['status'],
    queryFn: () => api.get<StatusResponse>('/api/status'),
    refetchInterval: 15_000,
  });
}

export function useVariables() {
  return useQuery({
    queryKey: ['variables'],
    queryFn: () => api.get<VariableDoc[]>('/api/meta/variables'),
    staleTime: Infinity,
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean }>('/auth/logout'),
    onSuccess: () => {
      window.location.href = '/login';
    },
  });
}
