"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { SidebarNav } from '@/components/sidebar-nav';
import { Loading } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useLogout, useMe } from '@/lib/queries';

/**
 * Casca autenticada.
 *
 * O painel não decide sozinho se há sessão: ele pergunta ao /api/me. Como o
 * cookie é httpOnly, não existe token no browser para o front inspecionar — e
 * isso é proposital.
 */
export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const logout = useLogout();
  const router = useRouter();

  const semSessao = me.isError;

  // O redirect vive num efeito porque navegar durante a renderização é um
  // side effect — o React avisa, e em Strict Mode chega a rodar duas vezes.
  useEffect(() => {
    if (semSessao) router.replace('/login');
  }, [semSessao, router]);

  if (me.isPending) {
    return (
      <div className="mx-auto max-w-5xl p-8">
        <Loading rows={4} />
      </div>
    );
  }

  if (!me.data) return null;

  return (
    <div className="grid min-h-screen md:grid-cols-[232px_1fr]">
      <aside className="bg-card flex flex-col gap-6 border-b p-4 md:border-r md:border-b-0">
        <div className="flex items-center gap-2 px-3 pt-1">
          <span className="bg-primary size-2 rounded-full" aria-hidden />
          <span className="font-semibold tracking-tight">NDev Chatbot</span>
        </div>

        <SidebarNav />

        <div className="mt-auto">
          <Separator className="mb-3" />
          <div className="flex items-center gap-2.5 px-1">
            {me.data.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={me.data.avatarUrl}
                alt=""
                className="size-8 shrink-0 rounded-full border object-cover"
              />
            ) : (
              <div className="bg-muted size-8 shrink-0 rounded-full border" />
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{me.data.displayName}</p>
              <Button
                variant="link"
                size="sm"
                className="text-muted-foreground h-auto p-0 text-xs"
                onClick={() => logout.mutate()}
              >
                Sair
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <main className="w-full max-w-5xl p-6 md:p-8">{children}</main>
    </div>
  );
}
