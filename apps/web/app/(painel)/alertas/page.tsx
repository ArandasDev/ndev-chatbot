"use client";

import { useState } from 'react';
import { toast } from 'sonner';

import { PageHead } from '@/components/page-head';
import { EmptyState, ErrorBox, Loading } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  useGuildChannels,
  useGuilds,
  useLiveAlertMutations,
  useLiveAlerts,
  useTwitchChannels,
} from '@/lib/queries';

const DEFAULT_MESSAGE = '@here {channel} ficou online jogando {game}! {title} -> {url}';

export default function AlertasPage() {
  const alerts = useLiveAlerts();
  const twitchChannels = useTwitchChannels();
  const guilds = useGuilds();
  const { create, update, remove } = useLiveAlertMutations();

  const [guildId, setGuildId] = useState('');
  const [discordChannelId, setDiscordChannelId] = useState('');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [error, setError] = useState<string | null>(null);

  const channels = useGuildChannels(guildId || undefined);
  const twitchChannel = twitchChannels.data?.[0];
  const guildsWithBot = (guilds.data ?? []).filter((guild) => guild.botPresent);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!twitchChannel) return;

    try {
      await create.mutateAsync({
        twitchChannelId: twitchChannel.id,
        guildId,
        discordChannelId,
        message,
      });
      setDiscordChannelId('');
      toast.success('Alerta criado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui criar o alerta.');
    }
  }

  return (
    <>
      <PageHead
        title="Alertas de live"
        description="Quando seu canal ficar online na Twitch, o bot avisa no Discord."
      />

      {!twitchChannel ? (
        <Card>
          <CardContent>
            <EmptyState
              title="Conecte sua conta da Twitch primeiro"
              description="O alerta precisa saber qual canal monitorar."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Novo alerta</CardTitle>
            <CardDescription>
              Monitorando <code className="bg-muted rounded px-1">{twitchChannel.login}</code>. A
              verificação roda a cada minuto.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error ? (
              <div className="mb-4">
                <ErrorBox error={new Error(error)} />
              </div>
            ) : null}

            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="guild">Servidor do Discord</Label>
                  <Select
                    value={guildId}
                    onValueChange={(value) => {
                      setGuildId(value);
                      setDiscordChannelId('');
                    }}
                  >
                    <SelectTrigger id="guild" className="w-full">
                      <SelectValue placeholder="Selecione…" />
                    </SelectTrigger>
                    <SelectContent>
                      {guildsWithBot.map((guild) => (
                        <SelectItem key={guild.id} value={guild.id}>
                          {guild.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="channel">Canal do anúncio</Label>
                  <Select
                    value={discordChannelId}
                    onValueChange={setDiscordChannelId}
                    disabled={!guildId || channels.isPending}
                  >
                    <SelectTrigger id="channel" className="w-full">
                      <SelectValue
                        placeholder={channels.isPending && guildId ? 'Carregando…' : 'Selecione…'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(channels.data ?? []).map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          #{channel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Mensagem</Label>
                <Textarea
                  id="message"
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
                <p className="text-muted-foreground text-xs">
                  Variáveis: <code className="bg-muted rounded px-1">{'{channel}'}</code>{' '}
                  <code className="bg-muted rounded px-1">{'{title}'}</code>{' '}
                  <code className="bg-muted rounded px-1">{'{game}'}</code>{' '}
                  <code className="bg-muted rounded px-1">{'{url}'}</code>
                </p>
              </div>

              <Button type="submit" disabled={create.isPending || !guildId || !discordChannelId}>
                {create.isPending ? 'Criando…' : 'Criar alerta'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Alertas ativos</CardTitle>
          <CardDescription>{alerts.data?.length ?? 0} configurado(s)</CardDescription>
        </CardHeader>

        <CardContent>
          {alerts.isPending ? <Loading rows={2} /> : null}
          {alerts.isError ? <ErrorBox error={alerts.error} /> : null}

          {alerts.data?.length === 0 ? (
            <EmptyState title="Nenhum alerta configurado" />
          ) : (
            <div className="divide-y">
              {(alerts.data ?? []).map((alert) => (
                <div
                  key={alert.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm">
                      <strong>{alert.twitchChannel.displayName ?? alert.twitchChannel.login}</strong>
                      <span className="text-muted-foreground"> → {alert.guild.name}</span>
                    </p>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">{alert.message}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={alert.enabled ? 'default' : 'outline'}>
                      {alert.enabled ? 'ativo' : 'pausado'}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => update.mutate({ id: alert.id, enabled: !alert.enabled })}
                    >
                      {alert.enabled ? 'Pausar' : 'Ativar'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm('Remover este alerta?')) remove.mutate(alert.id);
                      }}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
