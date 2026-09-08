import type { Metadata } from 'next';
import { Geist } from 'next/font/google';

import { Providers } from '@/components/providers';
import { cn } from '@/lib/utils';

import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'NDev Chatbot',
  description: 'Um bot só, no Discord e na Twitch, gerenciado por aqui.',
};

/**
 * O painel inteiro roda no cliente: os dados vêm da API em outra origem, com
 * o cookie httpOnly viajando via `credentials: 'include'`. O servidor do Next
 * nunca vê esse cookie — ele é do host da API — então renderizar no servidor
 * daria só uma casca vazia. Aqui o Next entra como router, bundler e layout.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={cn('bg-background text-foreground font-sans antialiased', geist.variable)}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
