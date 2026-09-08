import type { ReactNode } from 'react';

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return <div className="loading">{label}</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Algo deu errado.';
  return <div className="alert alert-error">{message}</div>;
}

export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {description ? <p className="muted">{description}</p> : null}
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'on' | 'off' | 'warn';
}) {
  const cls = tone === 'default' ? 'badge' : `badge badge-${tone}`;
  return <span className={cls}>{children}</span>;
}

export function PageHead({ title, description }: { title: string; description?: string }) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
