import { BUILTINS } from './builtins/index.js';
import { createEngine, type Engine, type EngineLogger } from './engine.js';
import { createRegistry } from './registry.js';
import {
  findForDispatch,
  incrementUses,
  logCommandUse,
} from './services/command.service.js';
import { getScope } from './settings-cache.js';

/**
 * Motor com as dependencias reais (Prisma + builtins). Fica separado do
 * engine.ts para que o motor continue importavel - e testavel - sem banco.
 */
export function createDefaultEngine(logger?: EngineLogger): Engine {
  return createEngine({
    registry: createRegistry(BUILTINS),
    getScope,
    findCommand: findForDispatch,
    incrementUses,
    logUse: logCommandUse,
    logger,
  });
}
