import { Link } from 'react-router-dom';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../services/api';
import { ErrorState, Loading, SectionTitle } from '../../components/ui';

export default function AdminDashboard() {
  const { data, loading, error, reload } = useAsync(() => admin.stats(), []);

  if (loading) return <Loading label="Loading platform statistics…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const cards = [
    ['Users', data.stats.users],
    ['Courses', data.stats.courses],
    ['Topics', data.stats.topics],
    ['Questions', data.stats.questions],
    ['Resources', data.stats.resources],
    ['Quiz attempts', data.stats.attempts]
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Admin dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">Content and activity across the platform.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-sm text-ink-muted">{label}</p>
            <p className="mt-1 font-display text-2xl font-extrabold tracking-tight tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <SectionTitle title="Content by course" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink-muted">
              <tr><th className="py-2">Course</th><th>Topics</th><th>Questions</th><th>Resources</th></tr>
            </thead>
            <tbody>
              {data.byCourse.map((c) => (
                <tr key={c.course} className="border-t border-black/5">
                  <td className="py-2 font-medium">{c.name}</td>
                  <td>{c.topics}</td>
                  <td>{c.questions}</td>
                  <td>{c.resources}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link className="btn-ghost" to="/admin/topics">Manage topics</Link>
        <Link className="btn-ghost" to="/admin/questions">Manage questions</Link>
        <Link className="btn-ghost" to="/admin/resources">Manage resources</Link>
        <Link className="btn-ghost" to="/admin/courses">Manage courses</Link>
      </div>
    </div>
  );
}
