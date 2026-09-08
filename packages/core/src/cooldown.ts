type Key = string;

/**
 * Cooldown por escopo + comando, em memoria.
 *
 * Deliberadamente NAO fica no Redis: e estado descartavel e local ao processo
 * que atende aquele chat. Um restart zerar cooldowns e aceitavel; uma ida a
 * rede por mensagem, nao.
 */
export class CooldownStore {
  private readonly hits = new Map<Key, number>();
  private lastSweep = Date.now();

  private static key(scopeDbId: string, command: string): Key {
    return `${scopeDbId}:${command}`;
  }

  /** Segundos restantes, ou 0 se estiver liberado. */
  remaining(scopeDbId: string, command: string, cooldownSec: number): number {
    if (cooldownSec <= 0) return 0;

    const expiresAt = this.hits.get(CooldownStore.key(scopeDbId, command));
    if (expiresAt === undefined) return 0;

    const left = expiresAt - Date.now();
    return left > 0 ? Math.ceil(left / 1000) : 0;
  }

  mark(scopeDbId: string, command: string, cooldownSec: number): void {
    if (cooldownSec <= 0) return;
    this.hits.set(CooldownStore.key(scopeDbId, command), Date.now() + cooldownSec * 1000);
    this.sweep();
  }

  /** Limpa entradas vencidas de vez em quando, para o Map nao crescer sem fim. */
  private sweep(): void {
    const now = Date.now();
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;

    for (const [key, expiresAt] of this.hits) {
      if (expiresAt <= now) this.hits.delete(key);
    }
  }

  clear(): void {
    this.hits.clear();
  }
}
