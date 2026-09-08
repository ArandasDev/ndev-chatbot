"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { PageHead } from '@/components/page-head';
import { ErrorBox, Loading } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { goToOAuth } from '@/lib/api-client';
import { useMe } from '@/lib/queries';

/**
 * Conexões da conta.
 *
 * Cada provedor destrava uma parte do produto, e a página diz qual — conectar
 * algo sem saber o que aquilo habilita é o tipo de tela que as pessoas ignoram.
 */
function Conexoes() {
  const me = useMe();
  const erro = useSearchParams()?.get('erro') ?? null;

  if (me.isPending) return <Loading rows={3} />;
  if (me.isError) return <ErrorBox error={me.error} />;
  if (!me.data) return null;

  const { connections } = me.data;

  return (
    <>
      <PageHead
        title="Conta"
        description="Conecte Discord e Twitch. Cada um destrava uma parte do painel."
      />

      {erro ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-medium">Discord</h2>
              <p className="text-muted-foreground text-sm">
                Necessário para gerenciar servidores e comandos do Discord.
              </p>
            </div>

            {connections.discord.linked ? (
              <Badge>conectado</Badge>
            ) : (
              <Button
                className="bg-[#5865f2] text-white hover:bg-[#4752c4]"
                onClick={() => goToOAuth('/auth/discord')}
              >
                Conectar Discord
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-medium">Twitch</h2>
              <p className="text-muted-foreground text-sm">
                {connections.twitch.linked
                  ? `Canal twitch.tv/${connections.twitch.login}`
                  : 'Necessário para o chatbot entrar no seu chat e para os alertas de live.'}
              </p>
            </div>

            {connections.twitch.linked ? (
              <Badge>conectado</Badge>
            ) : (
              <Button
                className="bg-[#9146ff] text-white hover:bg-[#772ce8]"
                onClick={() => goToOAuth('/auth/twitch')}
              >
                Conectar Twitch
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Como o chatbot entra no seu chat</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Você não precisa criar nem vincular nenhuma conta de bot. A conta que fala no chat é
              desta instância, configurada uma única vez pelo administrador. Do seu lado, é só
              conectar a Twitch e clicar em <strong className="text-foreground">Ativar chatbot</strong>{' '}
              na página Twitch.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function ContaPage() {
  return (
    <Suspense fallback={<Loading rows={3} />}>
      <Conexoes />
    </Suspense>
  );
}
