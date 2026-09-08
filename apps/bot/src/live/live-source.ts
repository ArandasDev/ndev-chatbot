/** Snapshot de um canal que esta ao vivo. */
export interface LiveStream {
  login: string;
  displayName: string;
  title: string;
  gameName: string;
  startedAt: Date;
  thumbnailUrl: string;
}

export type LiveHandler = (stream: LiveStream) => Promise<void>;

/**
 * Fonte de eventos de live.
 *
 * O MVP implementa com polling do Helix. Trocar por EventSub (webhook) e
 * implementar esta mesma interface: nada fora daqui muda.
 */
export interface LiveEventSource {
  start(onLive: LiveHandler): Promise<void>;
  stop(): Promise<void>;
}
