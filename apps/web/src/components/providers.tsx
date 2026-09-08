"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { Toaster } from '@/components/ui/sonner';
import { ApiError } from '@/lib/api-client';

/**
 * O QueryClient nasce no estado do componente, não em módulo: no App Router o
 * módulo é avaliado no servidor, e um cliente global vazaria cache entre
 * requisições de usuários diferentes.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Sessão expirada não deve virar retry: o redirecionamento para o
            // login é tratado pelo layout do painel.
            retry: (failureCount, error) => !(error instanceof ApiError) && failureCount < 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}
