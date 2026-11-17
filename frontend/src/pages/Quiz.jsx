import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useAsync from '../hooks/useAsync';
import { quiz as quizApi, topics as topicsApi } from '../services/api';
import TutorPanel from '../components/TutorPanel';
import { CodeBlock, DifficultyBadge, EmptyState, ErrorState, Loading, ProgressBar, StatusPill } from '../components/ui';

/** Topic picker shown when /quiz is opened without a topic. */
function PickTopic({ course }) {
  const { data, loading, error, reload } = useAsync(() => topicsApi.list(course), [course]);
  if (loading) return <Loading label="Loading topics…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const unlocked = data.filter((t) => t.unlocked);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Choose a topic to practise</h1>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {unlocked.map((t) => (
          <Link key={t.slug} to={`/quiz/${course}/${t.slug}`} className="card p-4 hover:border-signal-300">
            <div className="flex items-start justify-between gap-2">
              <span className="font-display font-semibold">{t.name}</span>
              <StatusPill status={t.status} />
            </div>
            <ProgressBar className="mt-3" value={t.mastery} tone={course} />
            <p className="mt-2 text-xs text-ink-muted">{t.mastery}% mastery · level {t.difficulty}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Quiz() {
  const params = useParams();
  const { course: userCourse } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const course = params.course || userCourse;
  const topic = params.topic;

  // ?again=1 (from "Practise again" links) means: if this topic is already finished,
  // start a fresh round straight away. It is honoured once, then removed from the URL.
  const wantsAgain = useRef(searchParams.get('again') === '1');

  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // navigate() is kept in a ref so load() does not change identity (which would re-run the effect)
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const load = useCallback(() => {
    if (!topic) return;
    setState({ loading: true, error: null, data: null });
    setSelected(null);
    setFeedback(null);

    const again = wantsAgain.current;

    quizApi
      .question(course, topic)
      .then(async (data) => {
        // Arrived via "Practise again" and the topic is finished -> begin a fresh round.
        if (again && data.cleared) {
          await quizApi.restart(course, topic);
          return quizApi.question(course, topic);
        }
        return data;
      })
      .then((data) => {
        if (again) {
          wantsAgain.current = false;
          navigateRef.current(`/quiz/${course}/${topic}`, { replace: true }); // drop ?again=1 so a refresh does not restart
        }
        setState({ loading: false, error: null, data });
      })
      .catch((err) => setState({ loading: false, error: err.message, data: null }));
  }, [course, topic]);

  // "Practise again": begin a new round of this topic and load its first question.
  // Declared before any early return because the completed screen below uses it.
  const practiseAgain = async () => {
    setRestarting(true);
    try {
      await quizApi.restart(course, topic);
      toast.push({ title: `New round: ${state.data?.topic?.name || 'this topic'}`, body: 'Starting again from the easy level.' });
      load();
    } catch (err) {
      toast.push({ tone: 'error', title: 'Could not restart the test', body: err.message });
    } finally {
      setRestarting(false);
    }
  };

  useEffect(load, [load]);

  if (!topic) return <PickTopic course={course} />;
  if (state.loading) return <Loading label="Preparing your next question…" />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  const { question, progress, topic: topicInfo, questionNumber, message, cleared, nextTopic, isRetry, bankSize, answeredCorrectly } = state.data;

  // Every question in this topic has been answered correctly - nothing is left to repeat.
  if (cleared) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div className="card border-l-4 border-l-signal-500 p-8 text-center">
          <p className="text-3xl" aria-hidden="true">🎉</p>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight">Topic complete: {topicInfo.name}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            You answered all {bankSize} questions in this topic correctly. Press Practise again to take the test again from the start.
          </p>
          <ProgressBar className="mt-5" value={100} tone={course} />
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button className={nextTopic ? 'btn-ghost' : 'btn-primary'} disabled={restarting} onClick={practiseAgain}>
              {restarting ? 'Starting…' : 'Practise again'}
            </button>
            {nextTopic && (
              <button className="btn-primary" onClick={() => navigate(`/quiz/${course}/${nextTopic.slug}`)}>
                Start {nextTopic.name}
              </button>
            )}
            <Link className="btn-ghost" to="/learning-path">Learning path</Link>
            <Link className="btn-ghost" to="/topics">All topics</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <EmptyState
        title="No questions yet for this topic"
        body={message || 'An admin can add questions from Manage questions.'}
        actionLabel="Back to topics"
        actionTo="/topics"
      />
    );
  }

  const submit = async () => {
    if (selected === null) return;
    setSubmitting(true);
    try {
      const result = await quizApi.answer({ questionId: question.id, selectedAnswer: selected });
      setFeedback(result);
      if (result.mastered) {
        toast.push({
          tone: 'success',
          title: `Topic mastered: ${topicInfo.name}`,
          body: result.nextTopic ? `Next topic unlocked: ${result.nextTopic.name}` : 'That was the last topic of this course.'
        });
      } else if (result.difficultyChanged) {
        toast.push({
          title: `Difficulty ${result.difficultyBefore} → ${result.difficultyAfter}`,
          body: result.correct ? 'You are ready for harder questions.' : 'Stepping back to rebuild the basics.'
        });
      }
    } catch (err) {
      toast.push({ tone: 'error', title: 'Could not submit your answer', body: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const optionClass = (i) => {
    if (!feedback) {
      return selected === i
        ? 'border-signal-500 bg-signal-50'
        : 'border-black/10 hover:border-signal-300 hover:bg-paper';
    }
    if (i === feedback.correctAnswer) return 'border-signal-500 bg-signal-50';
    if (i === selected) return 'border-red-300 bg-red-50';
    return 'border-black/10 opacity-70';
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">{course === 'java' ? 'Java' : 'Python'} · {topicInfo.name}</p>
          <h1 className="font-display text-xl font-semibold">Question {questionNumber}</h1>
        </div>
        <div className="flex items-center gap-2">
          <DifficultyBadge level={question.difficulty} />
          <span className="chip bg-ink/5 text-ink-muted">{question.type}</span>
          {isRetry && <span className="chip bg-red-50 text-red-700 ring-1 ring-red-300">Retry · missed earlier</span>}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-muted">Mastery</span>
          <span className="tabular-nums">{feedback ? feedback.mastery : progress.mastery}%</span>
        </div>
        <ProgressBar className="mt-1.5" value={feedback ? feedback.mastery : progress.mastery} tone={course} />
        <p className="mt-2 text-xs text-ink-muted">
          {progress.attempts} attempts · {progress.accuracy}% accuracy · {answeredCorrectly} of {bankSize} questions answered correctly
        </p>
        {progress.elo !== undefined && (
          <p className="mt-1 text-xs text-ink-muted">
            Skill rating (Elo): <span className="tabular-nums font-medium text-ink">{feedback?.elo ?? progress.elo}</span>
          </p>
        )}
      </div>

      <div className="card p-6">
        <p className="font-display text-lg font-medium">{question.question}</p>
        {question.code && <div className="mt-4"><CodeBlock code={question.code} /></div>}

        <div className="mt-5 space-y-2">
          {question.options.map((option, i) => (
            <button
              key={i}
              type="button"
              disabled={Boolean(feedback)}
              onClick={() => setSelected(i)}
              aria-pressed={selected === i}
              className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${optionClass(i)}`}
            >
              <span className="font-mono text-xs text-ink-muted">{String.fromCharCode(65 + i)}</span>
              <span className="code flex-1 font-sans">{option}</span>
            </button>
          ))}
        </div>

        {!feedback && (
          <button className="btn-primary mt-5 w-full sm:w-auto" disabled={selected === null || submitting} onClick={submit}>
            {submitting ? 'Checking…' : 'Submit answer'}
          </button>
        )}
      </div>

      {feedback && (
        <div className={`card border-l-4 p-6 ${feedback.correct ? 'border-l-signal-500' : 'border-l-red-400'}`}>
          <p className="font-display text-lg font-semibold">
            {feedback.correct ? '✓ Correct' : '✗ Not quite'}
          </p>

          {!feedback.correct && (
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="text-ink-muted">Your answer:</span> {String.fromCharCode(65 + selected)} — {feedback.yourOption}</p>
              <p><span className="text-ink-muted">Correct answer:</span> {String.fromCharCode(65 + feedback.correctAnswer)} — {feedback.correctOption}</p>
            </div>
          )}

          <div className="mt-4 space-y-3 text-sm">
            <p><span className="font-medium">Explanation. </span>{feedback.explanation}</p>
            {feedback.concept && <p><span className="font-medium">Concept. </span>{feedback.concept}</p>}
            {feedback.tip && <p><span className="font-medium">Tip. </span>{feedback.tip}</p>}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-ink-muted">Mastery {feedback.mastery}%</span>
            {feedback.eloAfter !== undefined && (
              <span className="text-ink-muted">
                Elo {feedback.eloBefore} → {feedback.eloAfter}{' '}
                <span className={feedback.eloAfter >= feedback.eloBefore ? 'text-signal-600' : 'text-red-600'}>
                  ({feedback.eloAfter >= feedback.eloBefore ? '+' : ''}{feedback.eloAfter - feedback.eloBefore})
                </span>
              </span>
            )}
            <span className="flex items-center gap-2">
              Difficulty <DifficultyBadge level={feedback.difficultyBefore} />
              {feedback.difficultyChanged && <>→ <DifficultyBadge level={feedback.difficultyAfter} /></>}
            </span>
          </div>

          {!feedback.correct && (
            <TutorPanel
              key={question.id}
              questionId={question.id}
              selectedAnswer={selected}
              topicPath={`/topics/${course}/${topic}`}
              onContinue={load}
            />
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button className={!feedback.correct ? 'btn-ghost' : 'btn-primary'} onClick={load}>
              {feedback.cleared ? 'Finish topic' : feedback.correct ? 'Next question' : 'Skip and continue'}
            </button>
            {feedback.mastered && feedback.nextTopic && (
              <button className="btn-ghost" onClick={() => navigate(`/quiz/${course}/${feedback.nextTopic.slug}`)}>
                Start {feedback.nextTopic.name}
              </button>
            )}
            <Link className="btn-ghost" to={`/topics/${course}/${topic}`}>Topic details</Link>
          </div>
        </div>
      )}
    </div>
  );
}
