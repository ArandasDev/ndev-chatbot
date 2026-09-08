import { useStats } from '../lib/queries.js';
import { Empty, ErrorBox, Loading } from './ui.js';

export function StatsPanel({ basePath }: { basePath: string }) {
  const stats = useStats(basePath);

  if (stats.isPending) return <Loading />;
  if (stats.isError) return <ErrorBox error={stats.error} />;

  const top = stats.data?.top ?? [];
  if (top.length === 0) {
    return (
      <div className="card">
        <Empty
          title="Sem dados ainda"
          description="As estatísticas aparecem depois que os comandos começarem a ser usados no chat."
        />
      </div>
    );
  }

  const max = Math.max(...top.map((row) => row.uses));

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Mais usados</h2>
          <p>Últimos 7 dias</p>
        </div>
      </div>

      <div className="stack">
        {top.map((row) => (
          <div key={row.command} className="bar-row">
            <span className="cmd-name">{row.command}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(row.uses / max) * 100}%` }} />
            </div>
            <span className="muted" style={{ textAlign: 'right' }}>
              {row.uses}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
