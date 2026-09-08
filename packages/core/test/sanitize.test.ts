import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sanitizeReply } from '../src/sanitize.js';

describe('sanitizeReply', () => {
  it('neutraliza @everyone e @here sem apagar o texto', () => {
    const out = sanitizeReply('oi @everyone e @here', 'DISCORD');
    assert.ok(!/@everyone/.test(out), 'a menção crua não pode sobrar');
    assert.ok(out.includes('everyone'), 'a palavra continua legível');
    assert.ok(out.includes('\u200b'), 'o zero-width foi inserido');
  });

  it('achata quebras de linha na Twitch', () => {
    assert.equal(sanitizeReply('linha1\nlinha2', 'TWITCH'), 'linha1 linha2');
  });

  it('preserva quebras de linha no Discord', () => {
    assert.equal(sanitizeReply('linha1\nlinha2', 'DISCORD'), 'linha1\nlinha2');
  });

  it('remove barra inicial que viraria comando de moderação na Twitch', () => {
    assert.equal(sanitizeReply('/ban alguem', 'TWITCH'), 'ban alguem');
    assert.equal(sanitizeReply('.timeout alguem', 'TWITCH'), 'timeout alguem');
  });

  it('trunca no limite da plataforma', () => {
    const longo = 'a'.repeat(1000);
    const twitch = sanitizeReply(longo, 'TWITCH');
    assert.ok(twitch.length <= 450, `saiu com ${twitch.length}`);
    assert.ok(twitch.endsWith('\u2026'));

    assert.equal(sanitizeReply(longo, 'DISCORD').length, 1000);
  });
});
