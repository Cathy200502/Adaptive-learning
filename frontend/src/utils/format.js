// Small presentation helpers shared across pages.

export const clampPercent = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export const percent = (n) => `${clampPercent(n)}%`;

export const accuracy = (correct, attempts) =>
  !attempts ? 0 : clampPercent((correct / attempts) * 100);

export const titleCase = (str = '') =>
  str
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const relativeTime = (value) => {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const pluralize = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
