"use client";

import { toast } from 'sonner';

import { CommandsPanel } from '@/components/commands-panel';
import { PageHead } from '@/components/page-head';
import { StatsPanel } from '@/components/stats-panel';
import { EmptyState, ErrorBox, Loading } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { goToOAuth } from '@/lib/api-client';
import { useMe, useTwitchChannels, useUpdateTwitchChannel } from '@/lib/queries';

export default function TwitchPage() {
  const me = useMe();
  const channels = useTwitchChannels();

  if (me.isPending || channels.isPending) return <Loading rows={4} />;
  if (channels.isError) return <ErrorBox error={channels.error} />;

  const channel = channels.data?.[0];

  if (!me.data?.connections.twitch.linked || !channel) {
    return (
      <>
        <PageHead
          title="Twitch"
          description="Conecte seu canal para o chatbot responder no seu chat."
        />
        <Card>
          <CardContent>
            <EmptyState
              title="Conecte sua conta da Twitch"
              description="Você autoriza com a sua própria conta — é assim que provamos que o canal é seu. Nenhuma conta de bot é necessária."
              action={
                <Button
                  className="bg-[#9146ff] text-white hover:bg-[#772ce8]"
                  onClick={() => goToOAuth('/auth/twitch')}
                >
                  Conectar Twitch
                </Button>
              }
            />
          </CardContent>
        </Card>
      </>
    );
  }

  return <ChannelPanel channelId={channel.id} />;
}

function ChannelPanel({ channelId }: { channelId: string }) {
  const me = useMe();
  const channels = useTwitchChannels();
  const update = useUpdateTwitchChannel(channelId);

  const channel = channels.data?.find((item) => item.id === channelId);
  if (!channel) return null;

  const chatbotConfigured = me.data?.chatbotConfigured ?? false;
  const active = channel.enabled;

  async function toggle() {
    try {
      await update.mutateAsync({ enabled: !active });
      toast.success(active ? 'Chatbot desativado.' : 'Chatbot ativado. Ele já entrou no seu chat.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui alterar.');
    }
  }

  return (
    <>
      <PageHead
        title={channel.displayName ?? channel.login}
        description={`twitch.tv/${channel.login}`}
      />

      {/*
        O botão de ativar é o centro da página de propósito. Do lado do
        streamer, ativar o chatbot é UM clique: a conta que fala no chat é da
        instância, não dele.
      */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-medium">Chatbot no seu chat</h2>
              <p className="text-muted-foreground text-sm">
                {active
                  ? 'O bot está no seu chat e respondendo aos comandos.'
                  : 'O bot ainda não entrou no seu chat.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant={active ? 'default' : 'outline'}>{active ? 'ativo' : 'inativo'}</Badge>
              <Button
                variant={active ? 'outline' : 'default'}
                disabled={update.isPending || (!active && !chatbotConfigured)}
                onClick={() => void toggle()}
              >
                {update.isPending ? 'Aguarde…' : active ? 'Desativar chatbot' : 'Ativar chatbot'}
              </Button>
            </div>
          </div>

          {!chatbotConfigured ? (
            <Alert>
              <AlertDescription>
                O administrador desta instância ainda não configurou a conta que fala no chat. Ativar
                agora não teria efeito.
              </AlertDescription>
            </Alert>
          ) : null}

          {update.isError ? <ErrorBox error={update.error} /> : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="comandos" className="mt-6">
        <TabsList>
          <TabsTrigger value="comandos">Comandos</TabsTrigger>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="comandos" className="mt-4">
          <CommandsPanel
            basePath={`/api/twitch/channels/${channelId}/commands`}
            prefix={channel.prefix}
            scopeName={channel.displayName ?? channel.login}
          />
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <StatsPanel basePath={`/api/twitch/channels/${channelId}/stats`} />
        </TabsContent>
      </Tabs>
    </>
  );
}
