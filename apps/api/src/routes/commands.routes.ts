import type { CommandScope } from '@ndev/core';
import {
  createCommand,
  createCommandSchema,
  deleteCommand,
  listCommands,
  updateCommand,
  updateCommandSchema,
} from '@ndev/core';
import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';

import { currentUser } from '../auth/session.js';

const commandParams = z.object({ commandId: z.string().min(1) });

export interface CommandRoutesOptions {
  /** Prefixo com os params do escopo, ex.: /api/guilds/:guildId/commands */
  prefix: string;
  preHandler: preHandlerHookHandler[];
  resolveScope(request: FastifyRequest): CommandScope;
  /** Publica o evento de invalidacao correspondente ao escopo. */
  onChanged(request: FastifyRequest): Promise<void>;
}

/**
 * CRUD de comandos, registrado uma vez por escopo.
 *
 * Discord e Twitch usam exatamente as mesmas regras; escrever duas vezes seria
 * garantir que uma das copias fica para tras. O que muda entre elas - como
 * autorizar e qual evento publicar - entra por parametro.
 */
export function registerCommandRoutes(app: FastifyInstance, options: CommandRoutesOptions) {
  return app.register(
    async (instance) => {
      instance.get('/', { preHandler: options.preHandler }, async (request) =>
        listCommands(options.resolveScope(request)),
      );

      instance.post('/', { preHandler: options.preHandler }, async (request, reply) => {
        const scope = options.resolveScope(request);
        const input = createCommandSchema.parse(request.body);

        const command = await createCommand(scope, input, currentUser(request).id);
        await options.onChanged(request);

        return reply.status(201).send(command);
      });

      instance.patch('/:commandId', { preHandler: options.preHandler }, async (request) => {
        const scope = options.resolveScope(request);
        const { commandId } = commandParams.parse(request.params);
        const input = updateCommandSchema.parse(request.body);

        const command = await updateCommand(scope, commandId, input);
        await options.onChanged(request);

        return command;
      });

      instance.delete('/:commandId', { preHandler: options.preHandler }, async (request, reply) => {
        const scope = options.resolveScope(request);
        const { commandId } = commandParams.parse(request.params);

        await deleteCommand(scope, commandId);
        await options.onChanged(request);

        return reply.status(204).send();
      });
    },
    { prefix: options.prefix },
  );
}
