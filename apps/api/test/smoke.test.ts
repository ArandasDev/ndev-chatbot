import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { createBus } from '@ndev/bus';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../src/app.js';

/**
 * Smoke test da borda HTTP.
 *
 * Roda com `app.inject`, sem abrir porta e sem tocar no Postgres: o objetivo e
 * pegar erro de montagem (plugin duplicado, rota conflitante, handler de erro
 * quebrado) e confirmar que nenhuma rota protegida responde a anonimo.
 *
 * O caminho com banco e coberto pelo roteiro de verificacao do README.
 */
describe('API - montagem e autorização', () => {
  let app: FastifyInstance;
  let bus: ReturnType<typeof createBus>;

  before(async () => {
    bus = createBus();
    app = await buildApp(bus);
    await app.ready();
  });

  after(async () => {
    await Promise.allSettled([app.close(), bus.close()]);
  });

  it('sobe sem conflito de rotas', () => {
    assert.ok(app.hasRoute({ method: 'GET', url: '/health' }));
  });

  it('responde ao health check', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ok: true });
  });

  it('não expõe versão nem detalhe de infra no health', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    assert.deepEqual(Object.keys(response.json() as object), ['ok']);
  });

  it('devolve 404 no formato padrão de erro', async () => {
    const response = await app.inject({ method: 'GET', url: '/rota-que-nao-existe' });
    const body = response.json() as { error: { code: string; message: string } };

    assert.equal(response.statusCode, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  // Cada rota protegida precisa recusar anonimo. Um guard esquecido em uma
  // delas e exatamente o tipo de falha que so aparece em producao.
  const protectedRoutes = [
    { method: 'GET' as const, url: '/api/me' },
    { method: 'GET' as const, url: '/api/guilds' },
    { method: 'GET' as const, url: '/api/guilds/123' },
    { method: 'PATCH' as const, url: '/api/guilds/123' },
    { method: 'GET' as const, url: '/api/guilds/123/channels' },
    { method: 'GET' as const, url: '/api/guilds/123/stats' },
    { method: 'GET' as const, url: '/api/guilds/123/commands' },
    { method: 'POST' as const, url: '/api/guilds/123/commands' },
    { method: 'PATCH' as const, url: '/api/guilds/123/commands/abc' },
    { method: 'DELETE' as const, url: '/api/guilds/123/commands/abc' },
    { method: 'GET' as const, url: '/api/twitch/channels' },
    { method: 'PATCH' as const, url: '/api/twitch/channels/abc' },
    { method: 'DELETE' as const, url: '/api/twitch/channels/abc' },
    { method: 'GET' as const, url: '/api/twitch/channels/abc/commands' },
    { method: 'POST' as const, url: '/api/twitch/channels/abc/commands' },
    { method: 'GET' as const, url: '/api/live-alerts' },
    { method: 'POST' as const, url: '/api/live-alerts' },
    { method: 'PATCH' as const, url: '/api/live-alerts/abc' },
    { method: 'DELETE' as const, url: '/api/live-alerts/abc' },
    { method: 'GET' as const, url: '/api/status' },
  ];

  for (const route of protectedRoutes) {
    it(`${route.method} ${route.url} exige sessão`, async () => {
      const response = await app.inject({
        method: route.method,
        url: route.url,
        ...(route.method === 'POST' || route.method === 'PATCH' ? { payload: {} } : {}),
      });

      assert.equal(
        response.statusCode,
        401,
        `respondeu ${response.statusCode} para anônimo em ${route.url}`,
      );
    });
  }

  it('recusa cookie de sessão forjado', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      cookies: { ndev_session: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiJ9.' },
    });

    assert.equal(response.statusCode, 401);
  });

  // Discord e Twitch sao as DUAS portas de entrada: exigir sessao nelas
  // trancaria a porta pelo lado de dentro.
  for (const url of ['/auth/discord', '/auth/twitch']) {
    it(`${url} é público (porta de login)`, async () => {
      const response = await app.inject({ method: 'GET', url });

      assert.notEqual(
        response.statusCode,
        401,
        `${url} não pode exigir sessão — é por onde o usuário entra`,
      );
    });
  }

  it('vincular a conta do bot exige sessão de dono', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/twitch/bot' });
    assert.equal(response.statusCode, 401);
  });

  it('libera as rotas públicas', async () => {
    const variables = await app.inject({ method: 'GET', url: '/api/meta/variables' });
    assert.equal(variables.statusCode, 200);
    assert.ok(Array.isArray(variables.json()));
  });
});
