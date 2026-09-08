"use client";

import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState, ErrorBox, Loading } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { previewResponse } from '@/lib/preview';
import { useCommandMutations, useCommands, useVariables } from '@/lib/queries';
import type { Command } from '@/lib/types';

interface Props {
  /** Ex.: /api/guilds/123/commands ou /api/twitch/channels/abc/commands */
  basePath: string;
  /** Prefixo do escopo, só para exibição. */
  prefix: string;
  scopeName: string;
}

interface FormState {
  id: string | null;
  name: string;
  response: string;
  cooldownSec: number;
  modOnly: boolean;
  enabled: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  response: '',
  cooldownSec: 5,
  modOnly: false,
  enabled: true,
};

/**
 * CRUD de comandos, usado igual pelo Discord e pela Twitch.
 * A única diferença entre os dois escopos é o `basePath`.
 */
export function CommandsPanel({ basePath, prefix, scopeName }: Props) {
  const commands = useCommands(basePath);
  const variables = useVariables();
  const { create, update, remove } = useCommandMutations(basePath);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const editing = form.id !== null;
  const saving = create.isPending || update.isPending;

  function startEdit(command: Command) {
    setError(null);
    setForm({
      id: command.id,
      name: command.name,
      response: command.response,
      cooldownSec: command.cooldownSec,
      modOnly: command.modOnly,
      enabled: command.enabled,
    });
  }

  function reset() {
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const payload = {
      name: form.name,
      response: form.response,
      cooldownSec: form.cooldownSec,
      modOnly: form.modOnly,
      enabled: form.enabled,
    };

    try {
      if (form.id) {
        await update.mutateAsync({ id: form.id, ...payload });
        toast.success('Comando atualizado. Já vale no chat.');
      } else {
        await create.mutateAsync(payload);
        toast.success('Comando criado. Já vale no chat.');
      }
      reset();
    } catch (err) {
      // A validação real vive no servidor; aqui só mostramos o que ele disse.
      setError(err instanceof Error ? err.message : 'Não consegui salvar.');
    }
  }

  async function handleRemove(command: Command) {
    if (!confirm(`Remover ${prefix}${command.name}?`)) return;

    try {
      await remove.mutateAsync(command.id);
      toast.success(`${prefix}${command.name} removido.`);
      if (form.id === command.id) reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui remover.');
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>{editing ? 'Editar comando' : 'Novo comando'}</CardTitle>
            <CardDescription>
              Responde no chat quando alguém digitar{' '}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">{prefix}nome</code>.
            </CardDescription>
          </div>
          {editing ? (
            <Button variant="outline" size="sm" onClick={reset}>
              Cancelar
            </Button>
          ) : null}
        </CardHeader>

        <CardContent>
          {error ? (
            <div className="mb-4">
              <ErrorBox error={new Error(error)} />
            </div>
          ) : null}

          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cmd-name">Nome</Label>
                <Input
                  id="cmd-name"
                  value={form.name}
                  placeholder="social"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <p className="text-muted-foreground text-xs">
                  Vira{' '}
                  <code className="bg-muted rounded px-1 py-0.5">
                    {prefix}
                    {form.name || 'nome'}
                  </code>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cmd-cooldown">Cooldown (segundos)</Label>
                <Input
                  id="cmd-cooldown"
                  type="number"
                  min={0}
                  max={3600}
                  value={form.cooldownSec}
                  onChange={(e) => setForm({ ...form, cooldownSec: Number(e.target.value) })}
                />
                <p className="text-muted-foreground text-xs">Moderadores não são afetados.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cmd-response">Resposta</Label>
              <Textarea
                id="cmd-response"
                value={form.response}
                rows={3}
                placeholder="Segue lá {user}! twitch.tv/seucanal"
                onChange={(e) => setForm({ ...form, response: e.target.value })}
                required
              />
              <div className="flex flex-wrap gap-1.5">
                {(variables.data ?? []).map((variable) => (
                  <button
                    key={variable.token}
                    type="button"
                    title={variable.description}
                    onClick={() => setForm({ ...form, response: form.response + variable.token })}
                    className="bg-muted text-muted-foreground hover:border-primary hover:text-foreground rounded border px-1.5 py-0.5 font-mono text-xs transition-colors"
                  >
                    {variable.token}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prévia</Label>
              <div className="text-muted-foreground min-h-10 rounded-md border border-dashed px-3 py-2 text-sm break-words whitespace-pre-wrap">
                {form.response ? (
                  <span className="text-foreground">
                    {previewResponse(form.response, { channel: scopeName })}
                  </span>
                ) : (
                  'A prévia aparece conforme você escreve.'
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cmd-mod"
                  checked={form.modOnly}
                  onCheckedChange={(checked) => setForm({ ...form, modOnly: checked === true })}
                />
                <Label htmlFor="cmd-mod" className="font-normal">
                  Só moderadores
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cmd-enabled"
                  checked={form.enabled}
                  onCheckedChange={(checked) => setForm({ ...form, enabled: checked === true })}
                />
                <Label htmlFor="cmd-enabled" className="font-normal">
                  Ativo
                </Label>
              </div>
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar comando'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comandos</CardTitle>
          <CardDescription>{commands.data?.length ?? 0} cadastrado(s)</CardDescription>
        </CardHeader>

        <CardContent>
          {commands.isPending ? <Loading rows={3} /> : null}
          {commands.isError ? <ErrorBox error={commands.error} /> : null}

          {commands.data?.length === 0 ? (
            <EmptyState
              title="Nenhum comando ainda"
              description="Crie o primeiro no formulário acima, ou digite !addcmd direto no chat."
            />
          ) : null}

          {commands.data && commands.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comando</TableHead>
                  <TableHead>Resposta</TableHead>
                  <TableHead className="w-16">Usos</TableHead>
                  <TableHead className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {commands.data.map((command) => (
                  <TableRow key={command.id}>
                    <TableCell className="align-top">
                      <span className="text-primary font-mono font-medium">
                        {prefix}
                        {command.name}
                      </span>
                      <div className="mt-1 flex gap-1">
                        {!command.enabled ? (
                          <Badge variant="outline" className="text-xs">
                            pausado
                          </Badge>
                        ) : null}
                        {command.modOnly ? (
                          <Badge variant="secondary" className="text-xs">
                            mods
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-sm truncate align-top">
                      {command.response}
                    </TableCell>
                    <TableCell className="text-muted-foreground align-top">
                      {command.uses}
                    </TableCell>
                    <TableCell className="space-x-1 text-right align-top">
                      <Button variant="outline" size="sm" onClick={() => startEdit(command)}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={remove.isPending}
                        onClick={() => void handleRemove(command)}
                      >
                        Remover
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
