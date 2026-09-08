import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RESERVED_COMMAND_NAMES } from '../src/constants.js';

// Os builtins importam o service, que instancia o Prisma Client no import.
// A URL nao e usada (nenhuma query roda aqui), mas o construtor exige que exista.
process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/none';

const { BUILTINS } = await import('../src/builtins/index.js');
const { createRegistry } = await import('../src/registry.js');

describe('builtins', () => {
  it('não tem nome nem apelido duplicado', () => {
    const names = BUILTINS.flatMap((command) => [command.name, ...(command.aliases ?? [])]);
    assert.equal(new Set(names).size, names.length, `duplicado em: ${names.join(', ')}`);
  });

  it('mantém RESERVED_COMMAND_NAMES em dia', () => {
    const names = BUILTINS.flatMap((command) => [command.name, ...(command.aliases ?? [])]);
    const faltando = names.filter((name) => !RESERVED_COMMAND_NAMES.includes(name as never));

    assert.deepEqual(
      faltando,
      [],
      'todo builtin precisa estar em RESERVED_COMMAND_NAMES, senão dá para criar um customizado que nunca dispara',
    );
  });

  it('todo builtin tem descrição', () => {
    for (const command of BUILTINS) {
      assert.ok(command.description.length > 0, `${command.name} sem descrição`);
    }
  });

  it('os comandos de gerenciamento são restritos a moderadores', () => {
    const registry = createRegistry(BUILTINS);
    for (const name of ['addcmd', 'editcmd', 'delcmd']) {
      const command = registry.find(name, 'TWITCH');
      assert.ok(command, `${name} não registrado`);
      assert.equal(command.modOnly, true, `${name} precisa ser modOnly`);
    }
  });
});
