import { Prisma, prisma } from '@ndev/db';
import { z } from 'zod';

import {
  COMMAND_NAME_MAX,
  COMMAND_RESPONSE_MAX,
  DEFAULT_COOLDOWN_SEC,
  MAX_ALIASES,
  RESERVED_COMMAND_NAMES,
} from '../constants.js';
import { conflict, notFound } from '../errors.js';
import type { DispatchableCommand, Platform } from '../types.js';

/**
 * Escopo de um comando. Toda funcao daqui recebe o escopo e filtra por ele:
 * um id de comando sozinho NUNCA e suficiente para ler ou escrever. E a defesa
 * em profundidade contra IDOR, valendo mesmo depois do guard da rota.
 */
export interface CommandScope {
  platform: Platform;
  dbId: string;
}

const RESERVED: readonly string[] = RESERVED_COMMAND_NAMES;

/** Tira o prefixo digitado (!social -> social) e normaliza. */
export function normalizeCommandName(raw: string): string {
  return raw
    .trim()
    .replace(/^[!?./$&%-]+/, '')
    .toLowerCase();
}

const commandNameSchema = z
  .string()
  .trim()
  .min(1, 'Informe o nome do comando.')
  .max(COMMAND_NAME_MAX, `O nome pode ter no máximo ${COMMAND_NAME_MAX} caracteres.`)
  .transform(normalizeCommandName)
  .refine((value) => value.length > 0, 'Informe o nome do comando.')
  .refine(
    (value) => /^[a-z0-9_-]+$/.test(value),
    'Use apenas letras sem acento, números, hífen e underline.',
  )
  .refine((value) => !RESERVED.includes(value), 'Já existe um comando nativo com esse nome.');

export const createCommandSchema = z.object({
  name: commandNameSchema,
  response: z
    .string()
    .trim()
    .min(1, 'Escreva a resposta do comando.')
    .max(COMMAND_RESPONSE_MAX, `A resposta pode ter no máximo ${COMMAND_RESPONSE_MAX} caracteres.`),
  aliases: z
    .array(z.string())
    .max(MAX_ALIASES, `No máximo ${MAX_ALIASES} apelidos.`)
    .default([])
    .transform((list) => [...new Set(list.map(normalizeCommandName).filter(Boolean))])
    .refine((list) => list.every((alias) => !RESERVED.includes(alias)), 'Um dos apelidos é reservado.'),
  cooldownSec: z.number().int().min(0).max(3600).default(DEFAULT_COOLDOWN_SEC),
  modOnly: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export const updateCommandSchema = createCommandSchema.partial();

export type CreateCommandInput = z.input<typeof createCommandSchema>;
export type UpdateCommandInput = z.input<typeof updateCommandSchema>;

function scopeFilter(scope: CommandScope) {
  return scope.platform === 'DISCORD'
    ? { guildId: scope.dbId, twitchChannelId: null }
    : { twitchChannelId: scope.dbId, guildId: null };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export function listCommands(scope: CommandScope) {
  return prisma.command.findMany({
    where: scopeFilter(scope),
    orderBy: { name: 'asc' },
  });
}

export async function getCommand(scope: CommandScope, id: string) {
  const command = await prisma.command.findFirst({ where: { id, ...scopeFilter(scope) } });
  if (!command) throw notFound('Comando não encontrado.');
  return command;
}

/**
 * Busca usada pelo motor a cada invocacao: so comandos ativos, por nome ou apelido.
 */
export async function findForDispatch(
  scope: CommandScope,
  name: string,
): Promise<DispatchableCommand | null> {
  return prisma.command.findFirst({
    where: {
      ...scopeFilter(scope),
      enabled: true,
      OR: [{ name }, { aliases: { has: name } }],
    },
    select: { id: true, name: true, response: true, cooldownSec: true, modOnly: true, uses: true },
  });
}

export async function createCommand(
  scope: CommandScope,
  input: CreateCommandInput,
  createdBy?: string,
) {
  const data = createCommandSchema.parse(input);

  try {
    return await prisma.command.create({
      data: {
        ...data,
        createdBy: createdBy ?? null,
        guildId: scope.platform === 'DISCORD' ? scope.dbId : null,
        twitchChannelId: scope.platform === 'TWITCH' ? scope.dbId : null,
      },
    });
  } catch (err) {
    // O indice unico do banco e a fonte da verdade: checar antes com um SELECT
    // perderia para duas requisicoes simultaneas.
    if (isUniqueViolation(err)) throw conflict(`O comando "${data.name}" já existe aqui.`);
    throw err;
  }
}

export async function updateCommand(scope: CommandScope, id: string, input: UpdateCommandInput) {
  const data = updateCommandSchema.parse(input);
  await getCommand(scope, id); // garante que o comando pertence ao escopo

  try {
    return await prisma.command.update({ where: { id }, data });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict('Já existe um comando com esse nome aqui.');
    throw err;
  }
}

export async function deleteCommand(scope: CommandScope, id: string) {
  await getCommand(scope, id);
  await prisma.command.delete({ where: { id } });
}

/** Remove pelo nome - e o caminho usado pelo !delcmd no chat. */
export async function deleteCommandByName(scope: CommandScope, name: string) {
  const command = await prisma.command.findFirst({
    where: { ...scopeFilter(scope), name: normalizeCommandName(name) },
  });
  if (!command) throw notFound('Esse comando não existe aqui.');
  await prisma.command.delete({ where: { id: command.id } });
  return command;
}

/** Incrementa e devolve o novo total, que alimenta a variavel {count}. */
export async function incrementUses(id: string): Promise<number> {
  const updated = await prisma.command.update({
    where: { id },
    data: { uses: { increment: 1 } },
    select: { uses: true },
  });
  return updated.uses;
}

export interface CommandUseEntry {
  platform: Platform;
  scopeId: string;
  command: string;
  userName: string;
}

export async function logCommandUse(entry: CommandUseEntry): Promise<void> {
  await prisma.commandLog.create({ data: entry });
}

/** Top comandos dos ultimos N dias, para o painel. */
export async function commandStats(scope: CommandScope, days = 7) {
  const since = new Date(Date.now() - days * 86_400_000);

  const grouped = await prisma.commandLog.groupBy({
    by: ['command'],
    where: { platform: scope.platform, scopeId: scope.dbId, createdAt: { gte: since } },
    _count: { command: true },
    orderBy: { _count: { command: 'desc' } },
    take: 10,
  });

  return grouped.map((row) => ({ command: row.command, uses: row._count.command }));
}
