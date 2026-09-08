import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatDuration, render } from '../src/variables.js';
import { makeContext } from './helpers.js';

describe('render', () => {
  it('substitui o nome de quem usou o comando', () => {
    const ctx = makeContext();
    assert.equal(render('Olá {user}!', ctx), 'Olá Viewer!');
  });

  it('é insensível a maiúsculas na variável', () => {
    const ctx = makeContext();
    assert.equal(render('{USER} e {User}', ctx), 'Viewer e Viewer');
  });

  it('resolve argumentos posicionais e o conjunto todo', () => {
    const ctx = makeContext({ args: ['um', 'dois', 'tres'] });
    assert.equal(render('{arg1}/{arg3} => {args}', ctx), 'um/tres => um dois tres');
  });

  it('deixa vazio o argumento que não veio', () => {
    const ctx = makeContext({ args: [] });
    assert.equal(render('[{arg2}]', ctx), '[]');
  });

  it('usa o primeiro argumento como alvo, sem o @', () => {
    const ctx = makeContext({ args: ['@fulano'] });
    assert.equal(render('{target} recebeu', ctx), 'fulano recebeu');
  });

  it('cai no próprio usuário quando não há alvo', () => {
    const ctx = makeContext({ args: [] });
    assert.equal(render('{target}', ctx), 'Viewer');
  });

  it('menciona conforme a plataforma', () => {
    assert.equal(render('{mention}', makeContext({ platform: 'TWITCH' })), '@Viewer');
    assert.equal(render('{mention}', makeContext({ platform: 'DISCORD' })), '<@u1>');
  });

  it('sorteia uma das opções de {random}', () => {
    const ctx = makeContext();
    const out = render('{random:a|b|c}', ctx);
    assert.ok(['a', 'b', 'c'].includes(out), `saiu "${out}"`);
  });

  it('injeta o contador de usos', () => {
    const ctx = makeContext();
    assert.equal(render('usado {count} vezes', ctx, { count: 42 }), 'usado 42 vezes');
  });

  it('não executa nada que pareça código', () => {
    const ctx = makeContext();
    const perigoso = '${process.exit(1)} {{7*7}} <%= 1 %>';
    assert.equal(render(perigoso, ctx), perigoso);
  });

  it('ignora variável desconhecida em vez de quebrar', () => {
    const ctx = makeContext();
    assert.equal(render('{naoexiste}', ctx), '{naoexiste}');
  });
});

describe('formatDuration', () => {
  it('mostra só segundos abaixo de um minuto', () => {
    assert.equal(formatDuration(45_000), '45s');
  });

  it('compõe dias, horas, minutos e segundos', () => {
    const ms = (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000;
    assert.equal(formatDuration(ms), '2d 3h 4m 5s');
  });

  it('não produz valor negativo', () => {
    assert.equal(formatDuration(-5000), '0s');
  });
});
