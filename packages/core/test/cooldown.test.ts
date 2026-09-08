import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CooldownStore } from '../src/cooldown.js';

describe('CooldownStore', () => {
  it('libera quando nunca foi usado', () => {
    const store = new CooldownStore();
    assert.equal(store.remaining('s1', 'ping', 5), 0);
  });

  it('bloqueia logo após marcar', () => {
    const store = new CooldownStore();
    store.mark('s1', 'ping', 5);
    assert.ok(store.remaining('s1', 'ping', 5) > 0);
  });

  it('isola escopos diferentes', () => {
    const store = new CooldownStore();
    store.mark('s1', 'ping', 5);
    assert.equal(store.remaining('s2', 'ping', 5), 0);
  });

  it('isola comandos diferentes', () => {
    const store = new CooldownStore();
    store.mark('s1', 'ping', 5);
    assert.equal(store.remaining('s1', 'dado', 5), 0);
  });

  it('trata cooldown zero como sempre liberado', () => {
    const store = new CooldownStore();
    store.mark('s1', 'ping', 0);
    assert.equal(store.remaining('s1', 'ping', 0), 0);
  });
});
