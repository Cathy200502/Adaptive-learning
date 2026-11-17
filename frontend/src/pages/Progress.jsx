import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import { progress as progressApi } from '../services/api';
import { COURSE_LABEL, ErrorState, Loading, ProgressBar, SectionTitle } from '../components/ui';

export default function Progress() {
  const { course } = useAuth();
  const { data, loading, error, reload } = useAsync(() => progressApi.byCourse(course), [course]);

  if (loading) return <Loading label="Loading your progress…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { performance, topics, overallProgress, topicsCompleted, totalTopics, currentTopic } = data;
  const chartData = performance.byDifficulty.map((d) => ({
    level: d.level,
    correct: d.correct,
    wrong: d.attempted - d.correct
  }));
  const practised = topics.filter((t) => t.attempts > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{COURSE_LABEL[course]} progress</h1>
        <p className="mt-1 text-sm text-ink-muted">Everything recorded from your adaptive sessions.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Overall mastery', `${overallProgress}%`],
          ['Topics mastered', `${topicsCompleted} / ${totalTopics}`],
          ['Accuracy', `${performance.accuracy}%`],
          ['Current difficulty', currentTopic?.difficulty || 'easy']
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-sm text-ink-muted">{label}</p>
            <p className="mt-1 font-display text-xl font-semibold capitalize">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle title="Questions by difficulty" />
          {performance.attempted ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6e8ec" />
                  <XAxis dataKey="level" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="correct" stackId="a" fill="#12a37a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="wrong" stackId="a" fill="#e4b0b0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Answer a few questions to see this chart.</p>
          )}
          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-ink-muted">Attempted</dt><dd className="font-medium">{performance.attempted}</dd></div>
            <div><dt className="text-ink-muted">Correct</dt><dd className="font-medium">{performance.correct}</dd></div>
            <div><dt className="text-ink-muted">Wrong</dt><dd className="font-medium">{performance.wrong}</dd></div>
          </dl>
        </div>

        <div className="card p-5">
          <SectionTitle title="Mastery by topic" />
          {practised.length ? (
            <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {practised.map((t) => (
                <li key={t.slug}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{t.name}</span>
                    <span className="tabular-nums text-ink-muted">{t.mastery}%</span>
                  </div>
                  <ProgressBar className="mt-1.5" value={t.mastery} tone={course} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Nothing practised yet in this course.</p>
          )}
        </div>
      </div>

      {data.weakAreas.length > 0 && (
        <div className="card p-5">
          <SectionTitle title="Areas to improve" />
          <ul className="grid gap-2 text-sm sm:grid-cols-3">
            {data.weakAreas.map((w) => (
              <li key={w.slug} className="rounded-lg border border-black/5 p-3">
                <p className="font-medium">{w.name}</p>
                <p className="text-ink-muted">{w.mastery}% mastery · {w.accuracy}% accuracy</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
