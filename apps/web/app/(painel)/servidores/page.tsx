"use client";

import Link from 'next/link';

import { PageHead } from '@/components/page-head';
import { EmptyState, ErrorBox, Loading } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { goToOAuth } from '@/lib/api-client';
import { useGuilds, useMe } from '@/lib/queries';

export default function ServidoresPage() {
  const me = useMe();
  const guilds = useGuilds();

  // Quem entrou pela Twitch cai aqui sem Discord vinculado. Isso não é erro,
  // é um passo que falta — e a tela precisa dizer qual.
  if (me.data && !me.data.connections.discord.linked) {
    return (
      <>
        <PageHead title="Servidores" description="Gerencie os servidores do Discord por aqui." />
        <Card>
          <CardContent>
            <EmptyState
              title="Conecte seu Discord"
              description="Para gerenciar servidores e comandos do Discord, o painel precisa saber quais servidores você administra."
              action={
                <Button
                  className="bg-[#5865f2] text-white hover:bg-[#4752c4]"
                  onClick={() => goToOAuth('/auth/discord')}
                >
                  Conectar Discord
                </Button>
              }
            />
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Servidores"
        description="Servidores do Discord que você administra. Onde o bot já está, dá para configurar."
      />

      {guilds.isPending ? <Loading rows={3} /> : null}
      {guilds.isError ? <ErrorBox error={guilds.error} /> : null}

      {guilds.data?.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="Nenhum servidor encontrado"
              description="Você precisa ter a permissão Gerenciar Servidor em pelo menos um servidor do Discord."
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(guilds.data ?? []).map((guild) => (
          <Card key={guild.id} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col gap-4">
              <div className="flex items-center gap-3">
                {guild.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={guild.iconUrl}
                    alt=""
                    className="size-10 shrink-0 rounded-xl border object-cover"
                  />
                ) : (
                  <div className="bg-muted text-muted-foreground grid size-10 shrink-0 place-items-center rounded-xl border font-semibold">
                    {guild.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <h2 className="truncate font-medium">{guild.name}</h2>
                  <p className="text-muted-foreground truncate text-xs">
                    {guild.botPresent
                      ? `prefixo ${guild.prefix} · ${guild.commandCount} comando(s)`
                      : 'bot ainda não adicionado'}
                  </p>
                </div>
              </div>

              {guild.botPresent ? (
                <Button asChild variant="outline" className="mt-auto w-full">
                  <Link href={`/servidores/${guild.id}`}>Configurar</Link>
                </Button>
              ) : (
                <Button
                  asChild
                  className="mt-auto w-full bg-[#5865f2] text-white hover:bg-[#4752c4]"
                >
                  <a href={guild.inviteUrl} target="_blank" rel="noreferrer noopener">
                    Adicionar bot
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
