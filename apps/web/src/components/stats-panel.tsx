"use client";

import { EmptyState, ErrorBox, Loading } from '@/components/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStats } from '@/lib/queries';

export function StatsPanel({ basePath }: { basePath: string }) {
  const stats = useStats(basePath);

  if (stats.isPending) return <Loading rows={3} />;
  if (stats.isError) return <ErrorBox error={stats.error} />;

  const top = stats.data?.top ?? [];

  if (top.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            title="Sem dados ainda"
            description="As estatísticas aparecem depois que os comandos começarem a ser usados no chat."
          />
        </CardContent>
      </Card>
    );
  }

  const max = Math.max(...top.map((row) => row.uses));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mais usados</CardTitle>
        <CardDescription>Últimos 7 dias</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {top.map((row) => (
          <div key={row.command} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3">
            <span className="text-primary truncate font-mono text-sm">{row.command}</span>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: `${(row.uses / max) * 100}%` }}
              />
            </div>
            <span className="text-muted-foreground text-right text-sm">{row.uses}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
