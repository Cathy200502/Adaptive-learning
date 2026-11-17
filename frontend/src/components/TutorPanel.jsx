import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tutor as tutorApi } from '../services/api';
import { CodeBlock, Loading } from './ui';

const STEPS = ['Misconception', 'Explanation', 'Example', 'Practice', 'Reassessment'];

/** Where each phase sits on the progress strip. */
const STEP_INDEX = { learn: 2, practice: 3, reassess: 4, done: 4 };

function Stepper({ phase, hasPractice }) {
  const active = STEP_INDEX[phase] ?? 0;
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" aria-label="Tutor progress">
      {STEPS.map((label, i) => {
        if (label === 'Practice' && !hasPractice) return null;
        const done = i < active || phase === 'done';
        const current = i === active && phase !== 'done';
        return (
          <li
            key={label}
            aria-current={current ? 'step' : undefined}
            className={`chip ${current ? 'bg-signal-50 text-signal-700 ring-1 ring-signal-300' : done ? 'bg-signal-50 text-signal-700' : 'bg-ink/5 text-ink-muted'}`}
          >
            {done ? '✓ ' : ''}{label}
          </li>
        );
      })}
    </ol>
  );
}

/** One multiple-choice question that is graded by the server. */
function MiniQuestion({ heading, item, onSubmit, onNext, nextLabel }) {
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      setResult(await onSubmit(selected));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const optionClass = (i) => {
    if (!result) return selected === i ? 'border-signal-500 bg-signal-50' : 'border-black/10 hover:border-signal-300 hover:bg-paper';
    if (i === result.correctAnswer) return 'border-signal-500 bg-signal-50';
    if (i === selected) return 'border-red-300 bg-red-50';
    return 'border-black/10 opacity-70';
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{heading}</p>
      <p className="font-display text-base font-medium">{item.question}</p>
      {item.code && <CodeBlock code={item.code} />}
      <div className="space-y-2">
        {item.options.map((option, i) => (
          <button
            key={i}
            type="button"
            disabled={Boolean(result)}
            onClick={() => setSelected(i)}
            aria-pressed={selected === i}
            className={`flex w-full items-start gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${optionClass(i)}`}
          >
            <span className="font-mono text-xs text-ink-muted">{String.fromCharCode(65 + i)}</span>
            <span className="code flex-1 font-sans">{option}</span>
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!result ? (
        <button className="btn-primary" disabled={selected === null || busy} onClick={submit}>
          {busy ? 'Checking…' : 'Check answer'}
        </button>
      ) : (
        <div className="space-y-3">
          <p className={`text-sm font-medium ${result.correct ? 'text-signal-700' : 'text-red-700'}`}>
            {result.correct ? '✓ Correct' : '✗ Not quite'}
          </p>
          <p className="text-sm">{result.explanation}</p>
          <button className="btn-primary" onClick={() => onNext(result)}>{nextLabel}</button>
        </div>
      )}
    </div>
  );
}

/**
 * The adaptive tutor loop shown after a wrong answer:
 * misconception -> explanation -> example -> mini practice -> reassessment -> understood?
 * YES continues the quiz; NO asks for a simpler explanation (up to 3 levels).
 */
export default function TutorPanel({ questionId, selectedAnswer, topicPath, onContinue }) {
  const [lesson, setLesson] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | learn | practice | reassess | done | exhausted | error
  const [outcome, setOutcome] = useState(null);
  const [error, setError] = useState('');
  const [exhausted, setExhausted] = useState(null);

  const fetchLesson = useCallback(async (previousToken) => {
    setPhase('loading');
    setError('');
    try {
      const data = await tutorApi.lesson({ questionId, selectedAnswer, previousToken });
      if (data.exhausted) {
        setExhausted(data);
        setPhase('exhausted');
        return;
      }
      setLesson(data);
      setOutcome(null);
      setPhase('learn');
    } catch (err) {
      setError(err.message);
      setPhase('error');
    }
  }, [questionId, selectedAnswer]);

  useEffect(() => { fetchLesson(); }, [fetchLesson]);

  if (phase === 'loading') return <div className="mt-5 rounded-lg border border-black/10 bg-paper px-4"><Loading label="Working out what went wrong…" /></div>;

  if (phase === 'error') {
    return (
      <div className="mt-5 rounded-lg border border-black/10 bg-paper p-4 text-sm">
        <p className="font-medium">The tutor could not load</p>
        <p className="mt-1 text-ink-muted">{error}</p>
        <button className="btn-ghost mt-3" onClick={() => fetchLesson()}>Try again</button>
      </div>
    );
  }

  if (phase === 'exhausted') {
    return (
      <div className="mt-5 rounded-lg border border-black/10 bg-paper p-4 text-sm">
        <p className="font-medium">Let's come back to this one</p>
        <p className="mt-1 text-ink-muted">{exhausted?.message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="btn-ghost" to={exhausted?.topicLink || topicPath}>Read the topic</Link>
          <button className="btn-primary" onClick={onContinue}>Continue</button>
        </div>
      </div>
    );
  }

  const hasPractice = Boolean(lesson.practice);
  const token = lesson.sessionToken;

  return (
    <section className="mt-5 space-y-4 rounded-lg border border-signal-300 bg-signal-50/40 p-4" aria-label="Adaptive tutor">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">Let's fix this together</h2>
        <span className="text-xs text-ink-muted">
          {lesson.level === 1 ? 'Standard explanation' : `Simpler explanation ${lesson.level - 1}`}
          {lesson.source === 'fallback' ? ' · built-in notes' : ''}
        </span>
      </div>
      <Stepper phase={phase} hasPractice={hasPractice} />

      {phase === 'learn' && (
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium">What may have gone wrong</p>
            <p className="mt-1">{lesson.misconception}</p>
          </div>
          <div>
            <p className="font-medium">Explanation</p>
            <p className="mt-1">{lesson.explanation}</p>
          </div>
          <div>
            <p className="font-medium">A simple example{lesson.example.title ? `: ${lesson.example.title}` : ''}</p>
            {lesson.example.code && <div className="mt-2"><CodeBlock code={lesson.example.code} /></div>}
            <p className="mt-2">{lesson.example.walkthrough}</p>
          </div>
          <button className="btn-primary" onClick={() => setPhase(hasPractice ? 'practice' : 'reassess')}>
            {hasPractice ? 'Try a mini practice' : 'Test my understanding'}
          </button>
        </div>
      )}

      {phase === 'practice' && (
        <MiniQuestion
          key={`${token}-practice`}
          heading="Mini practice"
          item={lesson.practice}
          onSubmit={(i) => tutorApi.check({ sessionToken: token, step: 'practice', selectedAnswer: i })}
          onNext={() => setPhase('reassess')}
          nextLabel="Continue to reassessment"
        />
      )}

      {phase === 'reassess' && (
        <MiniQuestion
          key={`${token}-reassess`}
          heading="Reassessment"
          item={lesson.reassessment}
          onSubmit={(i) => tutorApi.check({ sessionToken: token, step: 'reassess', selectedAnswer: i })}
          onNext={(result) => { setOutcome(result); setPhase('done'); }}
          nextLabel="See result"
        />
      )}

      {phase === 'done' && outcome && (
        <div className="space-y-3 text-sm" role="status">
          {outcome.understood ? (
            <>
              <p className="font-display text-base font-semibold text-signal-700">🎉 You've got it</p>
              <p className="text-ink-muted">You answered the reassessment correctly, so this idea is clear. Let's keep going.</p>
              <button className="btn-primary" onClick={onContinue}>Continue</button>
            </>
          ) : (
            <>
              <p className="font-display text-base font-semibold text-red-700">Not yet, and that's fine</p>
              <p className="text-ink-muted">
                {outcome.canSimplify
                  ? 'Let me explain it a different, simpler way.'
                  : 'That was the simplest explanation available. Read the topic notes, then try again later.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {outcome.canSimplify ? (
                  <button className="btn-primary" onClick={() => fetchLesson(token)}>Explain it more simply</button>
                ) : (
                  <Link className="btn-primary" to={topicPath}>Read the topic</Link>
                )}
                <button className="btn-ghost" onClick={onContinue}>Continue anyway</button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
