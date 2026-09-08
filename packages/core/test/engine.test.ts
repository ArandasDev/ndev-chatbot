import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { BuiltinCommand } from '../src/types.js';
import { makeCommand, makeHarness, makeMessage } from './helpers.js';

describe('dispatch - caminho rápido', () => {
  it('ignora mensagem de outro bot', async () => {
    const h = makeHarness({ command: makeCommand() });
    const result = await h.engine.dispatch(makeMessage('!social', h, { isBot: true }));
    assert.equal(result, 'ignored');
    assert.deepEqual(h.replies, []);
  });

  it('ignora escopo desconhecido', async () => {
    const h = makeHarness({ scope: null });
    assert.equal(await h.engine.dispatch(makeMessage('!social', h)), 'ignored');
  });

  it('ignora escopo desativado', async () => {
    const h = makeHarness({
      scope: { platform: 'TWITCH', dbId: 's', key: 'k', name: 'n', prefix: '!', enabled: false },
    });
    assert.equal(await h.engine.dispatch(makeMessage('!social', h)), 'ignored');
  });

  it('não trata mensagem comum como comando', async () => {
    const h = makeHarness({ command: makeCommand() });
    assert.equal(await h.engine.dispatch(makeMessage('bom dia pessoal', h)), 'not-a-command');
    assert.deepEqual(h.replies, []);
  });

  it('ignora prefixo sozinho', async () => {
    const h = makeHarness();
    assert.equal(await h.engine.dispatch(makeMessage('!', h)), 'not-a-command');
  });

  it('fica em silêncio quando o comando não existe', async () => {
    const h = makeHarness({ command: null });
    assert.equal(await h.engine.dispatch(makeMessage('!naoexiste', h)), 'unknown-command');
    assert.deepEqual(h.replies, []);
  });
});

describe('dispatch - comando customizado', () => {
  it('responde renderizando as variáveis', async () => {
    const h = makeHarness({ command: makeCommand({ response: 'Segue lá {user}!' }) });
    const result = await h.engine.dispatch(makeMessage('!social', h));

    assert.equal(result, 'ok');
    assert.deepEqual(h.replies, ['Segue lá Viewer!']);
  });

  it('incrementa o uso e expõe o novo total em {count}', async () => {
    const h = makeHarness({ command: makeCommand({ response: 'usei {count}x', uses: 9 }) });
    await h.engine.dispatch(makeMessage('!social', h));

    assert.deepEqual(h.usesIncremented, ['cmd-1']);
    assert.deepEqual(h.replies, ['usei 10x']);
  });

  it('passa os argumentos para a resposta', async () => {
    const h = makeHarness({ command: makeCommand({ response: 'oi {arg1}' }) });
    await h.engine.dispatch(makeMessage('!social  fulano ', h));
    assert.deepEqual(h.replies, ['oi fulano']);
  });

  it('registra o uso para as estatísticas', async () => {
    const h = makeHarness({ command: makeCommand() });
    await h.engine.dispatch(makeMessage('!social', h));
    assert.deepEqual(h.logged, ['social']);
  });

  it('sanitiza a resposta antes de enviar', async () => {
    const h = makeHarness({ command: makeCommand({ response: 'oi @everyone' }) });
    await h.engine.dispatch(makeMessage('!social', h));
    assert.ok(!/@everyone/.test(h.replies[0] ?? ''));
  });
});

describe('dispatch - permissão e cooldown', () => {
  it('barra comando modOnly para quem não é mod', async () => {
    const h = makeHarness({ command: makeCommand({ modOnly: true }) });
    const result = await h.engine.dispatch(makeMessage('!social', h));

    assert.equal(result, 'forbidden');
    assert.equal(h.usesIncremented.length, 0);
    assert.match(h.replies[0] ?? '', /moderadores/);
  });

  it('libera comando modOnly para mod', async () => {
    const h = makeHarness({ command: makeCommand({ modOnly: true }) });
    const message = makeMessage('!social', h, {
      user: { id: 'm1', name: 'mod', displayName: 'Mod', isMod: true },
    });

    assert.equal(await h.engine.dispatch(message), 'ok');
  });

  it('bloqueia a segunda chamada dentro do cooldown', async () => {
    const h = makeHarness({ command: makeCommand({ cooldownSec: 30 }) });

    assert.equal(await h.engine.dispatch(makeMessage('!social', h)), 'ok');
    assert.equal(await h.engine.dispatch(makeMessage('!social', h)), 'cooldown');
    assert.equal(h.replies.length, 1, 'o cooldown não deve gerar mensagem no chat');
  });

  it('não aplica cooldown a moderador', async () => {
    const h = makeHarness({ command: makeCommand({ cooldownSec: 30 }) });
    const mod = { id: 'm1', name: 'mod', displayName: 'Mod', isMod: true };

    await h.engine.dispatch(makeMessage('!social', h, { user: mod }));
    assert.equal(await h.engine.dispatch(makeMessage('!social', h, { user: mod })), 'ok');
  });
});

describe('dispatch - builtins', () => {
  const eco: BuiltinCommand = {
    name: 'eco',
    description: 'teste',
    cooldownSec: 0,
    async run(ctx) {
      await ctx.reply(`eco:${ctx.args.join(',')}`);
    },
  };

  it('executa o builtin', async () => {
    const h = makeHarness({ builtins: [eco] });
    assert.equal(await h.engine.dispatch(makeMessage('!eco a b', h)), 'ok');
    assert.deepEqual(h.replies, ['eco:a,b']);
  });

  it('builtin tem precedência sobre comando customizado de mesmo nome', async () => {
    const h = makeHarness({ builtins: [eco], command: makeCommand({ name: 'eco', response: 'custom' }) });
    await h.engine.dispatch(makeMessage('!eco', h));

    assert.deepEqual(h.replies, ['eco:']);
    assert.equal(h.usesIncremented.length, 0);
  });

  it('resolve builtin por apelido', async () => {
    const h = makeHarness({ builtins: [{ ...eco, aliases: ['e'] }] });
    assert.equal(await h.engine.dispatch(makeMessage('!e', h)), 'ok');
  });

  it('respeita a restrição de plataforma do builtin', async () => {
    const h = makeHarness({ builtins: [{ ...eco, platforms: ['DISCORD'] }], command: null });
    assert.equal(await h.engine.dispatch(makeMessage('!eco', h)), 'unknown-command');
  });

  it('não derruba o dispatch quando o builtin lança', async () => {
    const quebrado: BuiltinCommand = {
      name: 'quebra',
      description: 'teste',
      run() {
        throw new Error('boom');
      },
    };
    const h = makeHarness({ builtins: [quebrado] });
    assert.equal(await h.engine.dispatch(makeMessage('!quebra', h)), 'error');
  });
});
