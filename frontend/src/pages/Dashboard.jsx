import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import { progress as progressApi } from '../services/api';
import { COURSE_LABEL, DifficultyBadge, EmptyState, ErrorState, Loading, ProgressBar, SectionTitle } from '../components/ui';

export default function Dashboard() {
  const { user, course } = useAuth();
  const { data, loading, error, reload } = useAsync(() => progressApi.dashboard(course), [course]);

  if (loading) return <Loading label="Loading your dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { summary, weakAreas, activity, masteryByTopic, notifications } = data;
  const current = summary.currentTopic;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Welcome back, {user.name.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          You are studying {COURSE_LABEL[course]} · streak {user.streak?.count || 0} day{(user.streak?.count || 0) === 1 ? '' : 's'}
        </p>
      </div>

      {notifications?.length > 0 && (
        <div className="card border-l-4 border-l-signal-500 bg-signal-50/50 p-4">
          <p className="font-display font-semibold">{notifications[0].title}</p>
          <p className="text-sm text-ink-muted">{notifications[0].body}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Overall mastery', `${summary.overallProgress}%`],
          ['Topics completed', `${summary.topicsCompleted} / ${summary.totalTopics}`],
          ['Current topic', current?.name || '—'],
          ['Current difficulty', current ? current.difficulty : 'easy']
        ].map(([label, value]) => (
          <div key={label} className="card card-hover p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
            <p className="mt-2 truncate font-display text-2xl font-extrabold capitalize">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="card p-5">
            <SectionTitle title="Continue learning" />
            {current ? (
              <>
                <p className="font-display text-lg font-semibold">{current.name}</p>
                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar value={current.mastery} className="max-w-sm" />
                  <span className="text-sm text-ink-muted">{current.mastery}%</span>
                  <DifficultyBadge level={current.difficulty} />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link className="btn-primary" to={`/quiz/${course}/${current.slug}`}>Continue learning</Link>
                  <Link className="btn-ghost" to={`/topics/${course}/${current.slug}`}>Topic details</Link>
                </div>
              </>
            ) : (
              <EmptyState title="Every topic is complete" body="Switch course to keep going." actionLabel="Browse courses" actionTo="/courses" />
            )}
          </div>

          <div className="card p-5">
            <SectionTitle title="Topic mastery" action={<Link className="text-sm text-signal-700 underline" to="/progress">Full progress</Link>} />
            <ul className="space-y-3">
              {masteryByTopic.map((t) => (
                <li key={t.slug} className="grid grid-cols-[1fr_auto] items-center gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <ProgressBar value={t.mastery} className="mt-1.5" tone={course} />
                  </div>
                  <span className="text-sm tabular-nums text-ink-muted">{t.mastery}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <SectionTitle title="Areas to improve" />
            {weakAreas.length ? (
              <>
                <ul className="space-y-2 text-sm">
                  {weakAreas.map((w) => (
                    <li key={w.slug} className="flex items-center justify-between gap-3">
                      <span>{w.name}</span>
                      <span className="text-ink-muted">{w.accuracy}% accuracy</span>
                    </li>
                  ))}
                </ul>
                <Link className="btn-ghost mt-4 w-full" to={`/quiz/${course}/${weakAreas[0].slug}`}>Practise weak areas</Link>
              </>
            ) : (
              <p className="text-sm text-ink-muted">Answer a few questions and weak spots will show up here.</p>
            )}
          </div>

          <div className="card p-5">
            <SectionTitle title="Recent activity" />
            {activity.length ? (
              <ul className="space-y-3 text-sm">
                {activity.map((a, i) => (
                  <li key={i} className="flex gap-3">
                    <span aria-hidden className={a.kind === 'wrong' ? 'text-red-600' : 'text-signal-600'}>
                      {a.kind === 'mastered' ? '★' : a.kind === 'wrong' ? '✗' : '✓'}
                    </span>
                    <span>
                      <span className="block">{a.label}</span>
                      <span className="text-xs text-ink-muted">{a.meta}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Nothing yet. Your first quiz will fill this in.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
