import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import { quiz as quizApi } from '../services/api';
import { CodeBlock, COURSE_LABEL, DifficultyBadge, EmptyState, ErrorState, Loading } from '../components/ui';

export default function MistakeReview() {
  const { course } = useAuth();
  const { data, loading, error, reload } = useAsync(() => quizApi.mistakes(course), [course]);

  if (loading) return <Loading label="Loading your mistakes…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Review my mistakes</h1>
        <p className="mt-1 text-sm text-ink-muted">Every {COURSE_LABEL[course]} question you answered incorrectly, with the reasoning.</p>
      </div>

      {!data.length ? (
        <EmptyState
          title="No mistakes recorded"
          body="Once you miss a question it shows up here so you can come back to it."
          actionLabel="Take a quiz"
          actionTo="/quiz"
        />
      ) : (
        <div className="space-y-4">
          {data.map((m) => (
            <article key={m.attemptId} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-ink-muted">{COURSE_LABEL[m.course]} · {m.topic.replace(/-/g, ' ')}</p>
                <DifficultyBadge level={m.difficulty} />
              </div>
              <p className="mt-2 font-display font-medium">{m.question}</p>
              {m.code && <div className="mt-3"><CodeBlock code={m.code} /></div>}

              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <p className="rounded-lg bg-red-50 px-3 py-2">
                  <span className="text-ink-muted">Your answer: </span>
                  {String.fromCharCode(65 + m.yourAnswer)} — {m.options[m.yourAnswer]}
                </p>
                <p className="rounded-lg bg-signal-50 px-3 py-2">
                  <span className="text-ink-muted">Correct: </span>
                  {String.fromCharCode(65 + m.correctAnswer)} — {m.options[m.correctAnswer]}
                </p>
              </div>

              <p className="mt-3 text-sm"><span className="font-medium">Explanation. </span>{m.explanation}</p>
              {m.concept && <p className="mt-1 text-sm"><span className="font-medium">Concept. </span>{m.concept}</p>}

              <Link className="btn-ghost mt-4" to={`/quiz/${m.course}/${m.topic}?again=1`}>Practise this topic again</Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
