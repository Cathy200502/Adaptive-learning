import { Link } from 'react-router-dom';

export const COURSE_LABEL = { java: 'Java', python: 'Python' };

export function ProgressBar({ value = 0, tone = 'signal', className = '' }) {
  const tones = { signal: 'bg-gradient-to-r from-signal-500 to-emerald-400', java: 'bg-java-500', python: 'bg-python-500' };
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-slate-200/80 ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full rounded-full transition-all duration-700 ease-out ${tones[tone] || tones.signal}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function DifficultyBadge({ level = 'easy' }) {
  const map = {
    easy: 'bg-signal-50 text-signal-700 ring-1 ring-signal-300',
    medium: 'bg-amber-50 text-amber-700 ring-1 ring-amber-300',
    hard: 'bg-red-50 text-red-700 ring-1 ring-red-300'
  };
  return <span className={`chip ${map[level] || map.easy}`}>{level[0].toUpperCase() + level.slice(1)}</span>;
}

export function StatusPill({ status }) {
  const map = {
    completed: ['Completed', 'bg-signal-50 text-signal-700'],
    current: ['In progress', 'bg-amber-50 text-amber-700'],
    available: ['Unlocked', 'bg-slate-100 text-ink-muted'],
    locked: ['Locked', 'bg-slate-100 text-ink-muted']
  };
  const [label, cls] = map[status] || map.available;
  return <span className={`chip ${cls}`}>{status === 'locked' ? '🔒 ' : ''}{label}</span>;
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-3 py-16 text-ink-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-signal-500 border-t-transparent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card border-red-100 bg-red-50/40 p-6">
      <p className="font-display font-semibold text-red-800">Something went wrong</p>
      <p className="mt-1 text-sm text-ink-muted">{message || 'Please try again.'}</p>
      {onRetry && (
        <button className="btn-ghost mt-4" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, body, actionLabel, actionTo, onAction }) {
  return (
    <div className="card border-dashed p-10 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{body}</p>}
      {actionTo && (
        <Link to={actionTo} className="btn-primary mt-5">
          {actionLabel}
        </Link>
      )}
      {onAction && (
        <button className="btn-primary mt-5" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function CodeBlock({ code, language }) {
  if (!code) return null;
  return (
    <pre className="code overflow-x-auto rounded-xl bg-navy-900 px-4 py-3 text-emerald-100 ring-1 ring-white/5">
      <code>{code}</code>
      {language && <span className="sr-only">{language}</span>}
    </pre>
  );
}

export function SectionTitle({ title, action }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <h2 className="font-display text-base font-bold text-ink">{title}</h2>
      {action}
    </div>
  );
}
