import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  // Sem versao, sem detalhe de infra: health check nao e pagina de diagnostico
  // para quem esta sondando o servidor.
  app.get('/health', async () => ({ ok: true }));
}
