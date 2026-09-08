import { createLogger } from '@ndev/config';
import { AppError, isAppError } from '@ndev/core';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

const log = createLogger('http');

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

function body(code: string, message: string, details?: unknown): ErrorBody {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

/**
 * Tradutor unico de erro -> resposta HTTP.
 *
 * Existe para que nenhuma rota precise de try/catch: o service lanca AppError e
 * a borda decide o status. Erro inesperado nunca vaza stack nem mensagem interna
 * para o cliente - isso vira reconhecimento de sistema para quem esta sondando.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (isAppError(err)) {
      return reply.status(err.status).send(body(err.code, err.message));
    }

    if (err instanceof ZodError) {
      const first = err.issues[0];
      const field = first?.path.join('.') ?? 'campo';
      return reply
        .status(400)
        .send(body('BAD_REQUEST', first?.message ?? `Valor inválido em ${field}.`, err.issues));
    }

    // Erros que o proprio Fastify classifica (rate limit, payload grande, ...).
    const status = err.statusCode ?? 500;
    if (status < 500) {
      return reply.status(status).send(body(err.code ?? 'BAD_REQUEST', err.message));
    }

    log.error(`${request.method} ${request.url} falhou:`, err.message, err.stack);
    return reply
      .status(500)
      .send(body('INTERNAL', 'Algo deu errado do nosso lado. Tente de novo em instantes.'));
  });

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) =>
    reply.status(404).send(body('NOT_FOUND', `Rota ${request.method} ${request.url} não existe.`)),
  );
}

export { AppError };
