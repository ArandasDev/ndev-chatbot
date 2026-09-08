"use client";

import { PageHead } from '@/components/page-head';
import { ErrorBox, Loading } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { goToOAuth } from '@/lib/api-client';
import { useMe, useStatus } from '@/lib/queries';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR');
}

export default function StatusPage() {
  const status = useStatus();
  const me = useMe();

  if (status.isPending) return <Loading rows={4} />;
  if (status.isError) return <ErrorBox error={status.error} />;

  const data = status.data;
  const bot = data?.status;

  return (
    <>
      <PageHead
        title="Status"
        description="Estado do worker que mantém as conexões com o Discord e a Twitch."
      />

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Worker</CardTitle>
            <CardDescription>
              {data?.online
                ? `Última batida às ${bot ? formatTime(bot.updatedAt) : '—'}`
                : 'Sem sinal há mais de 30 segundos.'}
            </CardDescription>
          </div>
          <Badge variant={data?.online ? 'default' : 'outline'}>
            {data?.online ? 'online' : 'offline'}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-4">
          {!data?.online ? (
            <Alert>
              <AlertDescription>
                O painel continua funcionando, mas o bot não está respondendo no chat. Verifique se o
                processo <code className="bg-muted rounded px-1">@ndev/bot</code> está rodando.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="bg-muted/40 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Discord
              </p>
              <p className="mt-1 text-xl font-semibold">
                {bot?.discord.ready ? 'conectado' : '—'}
              </p>
              <p className="text-muted-foreground text-xs">
                {bot?.discord.guildCount ?? 0} servidor(es)
                {bot?.discord.pingMs != null ? ` · ${bot.discord.pingMs}ms` : ''}
              </p>
            </div>

            <div className="bg-muted/40 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Twitch
              </p>
              <p className="mt-1 text-xl font-semibold">{bot?.twitch.ready ? 'conectado' : '—'}</p>
              <p className="text-muted-foreground text-xs">
                {bot?.twitch.channels.length ?? 0} canal(is) no chat
              </p>
            </div>

            <div className="bg-muted/40 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Desde
              </p>
              <p className="mt-1 text-xl font-semibold">
                {bot ? formatTime(bot.startedAt) : '—'}
              </p>
              <p className="text-muted-foreground text-xs">último start do worker</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {me.data?.isOwner ? (
        <Card className="mt-4">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Conta do bot na Twitch</CardTitle>
              <CardDescription>
                Configuração da instância: define de qual conta saem as mensagens em todos os canais.
                Faça login na conta do BOT, não na sua. Os streamers não passam por aqui — eles só
                apertam “Ativar chatbot”.
              </CardDescription>
            </div>
            <Badge variant={me.data.chatbotConfigured ? 'default' : 'secondary'}>
              {me.data.chatbotConfigured ? 'vinculada' : 'não vinculada'}
            </Badge>
          </CardHeader>
          <CardContent>
            <Button
              className="bg-[#9146ff] text-white hover:bg-[#772ce8]"
              onClick={() => goToOAuth('/auth/twitch/bot')}
            >
              {me.data.chatbotConfigured ? 'Revincular conta do bot' : 'Vincular conta do bot'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Últimos comandos</CardTitle>
          <CardDescription>O que rodou no chat recentemente</CardDescription>
        </CardHeader>
        <CardContent>
          {data?.recent.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nada por enquanto.</p>
          ) : (
            <Table>
              <TableBody>
                {(data?.recent ?? []).map((entry, index) => (
                  <TableRow key={`${entry.createdAt}-${index}`}>
                    <TableCell className="w-24">
                      <Badge variant="outline">
                        {entry.platform === 'DISCORD' ? 'Discord' : 'Twitch'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-primary font-mono">{entry.command}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.userName}</TableCell>
                    <TableCell className="text-muted-foreground text-right text-xs">
                      {formatTime(entry.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
