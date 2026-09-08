"use client";

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { CommandsPanel } from '@/components/commands-panel';
import { PageHead } from '@/components/page-head';
import { StatsPanel } from '@/components/stats-panel';
import { ErrorBox, Loading } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGuild, useUpdateGuild } from '@/lib/queries';

export default function GuildDetailPage() {
  const params = useParams<{ guildId: string }>();
  const guildId = params?.guildId ?? '';

  const guild = useGuild(guildId);
  const updateGuild = useUpdateGuild(guildId);
  const [prefix, setPrefix] = useState('');

  // Sincroniza o formulário quando os dados chegam (ou mudam em outra aba).
  useEffect(() => {
    if (guild.data) setPrefix(guild.data.prefix);
  }, [guild.data]);

  if (guild.isPending) return <Loading rows={4} />;
  if (guild.isError) return <ErrorBox error={guild.error} />;
  if (!guild.data) return null;

  async function savePrefix(event: React.FormEvent) {
    event.preventDefault();
    try {
      await updateGuild.mutateAsync({ prefix });
      toast.success('Prefixo salvo. Já vale no chat.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui salvar.');
    }
  }

  return (
    <>
      <Button asChild variant="link" size="sm" className="text-muted-foreground mb-2 h-auto p-0">
        <Link href="/servidores">
          <ArrowLeft className="size-3.5" /> Servidores
        </Link>
      </Button>

      <PageHead
        title={guild.data.name}
        description={`Prefixo ${guild.data.prefix} · ${guild.data.commandCount} comando(s)`}
      />

      <Tabs defaultValue="comandos">
        <TabsList>
          <TabsTrigger value="comandos">Comandos</TabsTrigger>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="comandos" className="mt-4">
          <CommandsPanel
            basePath={`/api/guilds/${guildId}/commands`}
            prefix={guild.data.prefix}
            scopeName={guild.data.name}
          />
        </TabsContent>

        <TabsContent value="geral" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Prefixo</CardTitle>
              <CardDescription>
                O caractere que marca o começo de um comando neste servidor.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {updateGuild.isError ? (
                <div className="mb-4">
                  <ErrorBox error={updateGuild.error} />
                </div>
              ) : null}

              <form onSubmit={savePrefix} className="space-y-4">
                <div className="max-w-40 space-y-2">
                  <Label htmlFor="prefix">Prefixo</Label>
                  <Input
                    id="prefix"
                    maxLength={5}
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={updateGuild.isPending}>
                  {updateGuild.isPending ? 'Salvando…' : 'Salvar'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <StatsPanel basePath={`/api/guilds/${guildId}/stats`} />
        </TabsContent>
      </Tabs>
    </>
  );
}
