"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { goToOAuth } from '@/lib/api-client';
import { useMe } from '@/lib/queries';

/**
 * Duas portas de entrada com o mesmo peso.
 *
 * Quem transmite chega pela Twitch; quem administra comunidade chega pelo
 * Discord. Obrigar os dois a passarem pela mesma porta é pedir para metade
 * desistir no primeiro clique — a outra conta se vincula depois, por dentro.
 */
function LoginCard() {
  const me = useMe();
  const router = useRouter();
  const erro = useSearchParams()?.get('erro') ?? null;

  const logado = me.isSuccess && me.data;

  useEffect(() => {
    if (logado) router.replace('/servidores');
  }, [logado, router]);

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="flex flex-col gap-5 pt-2 text-center">
        <div>
          <div className="bg-primary/10 border-primary/30 mx-auto grid size-12 place-items-center rounded-xl border text-2xl">
            🤖
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">NDev Chatbot</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Um bot só, no Discord e na Twitch, gerenciado por aqui.
          </p>
        </div>

        {erro ? (
          <Alert variant="destructive" className="text-left">
            <AlertDescription>
              {erro === 'cancelado' ? 'Login cancelado. Tente de novo quando quiser.' : erro}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button
            className="w-full bg-[#5865f2] text-white hover:bg-[#4752c4]"
            onClick={() => goToOAuth('/auth/discord')}
          >
            Entrar com Discord
          </Button>
          <Button
            className="w-full bg-[#9146ff] text-white hover:bg-[#772ce8]"
            onClick={() => goToOAuth('/auth/twitch')}
          >
            Entrar com Twitch
          </Button>
        </div>

        <p className="text-muted-foreground text-xs">
          Entre por onde preferir — a outra conta você vincula depois, dentro do painel.
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      {/* useSearchParams exige Suspense no App Router, senão a rota inteira
          vira dinâmica no build. */}
      <Suspense fallback={null}>
        <LoginCard />
      </Suspense>
    </main>
  );
}
