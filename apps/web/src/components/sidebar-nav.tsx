"use client";

import { Bell, Link2, Monitor, Radio, Tv } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/servidores', label: 'Servidores', icon: Monitor },
  { href: '/twitch', label: 'Twitch', icon: Tv },
  { href: '/alertas', label: 'Alertas de live', icon: Bell },
  { href: '/status', label: 'Status', icon: Radio },
  { href: '/conta', label: 'Conta', icon: Link2 },
];

export function SidebarNav() {
  // Os hooks de navegação do Next são anuláveis nos tipos: fora do contexto
  // de rota eles voltam null. Normalizamos aqui em vez de espalhar `?.`.
  const pathname = usePathname() ?? '';

  return (
    <nav className="flex flex-col gap-0.5">
      {LINKS.map(({ href, label, icon: Icon }) => {
        // startsWith para que /servidores/123 mantenha "Servidores" ativo.
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
