import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const COURSES = [
  { slug: 'java', label: 'Java' },
  { slug: 'python', label: 'Python' }
];

/**
 * Switches the learner's active course. The choice is persisted on the user
 * document, so every page (dashboard, path, quiz, resources) follows it and
 * Java/Python progress stays completely separate.
 */
export default function CourseSwitcher({ size = 'md' }) {
  const { course, switchCourse } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const choose = async (slug) => {
    if (slug === course || busy) return;
    setBusy(true);
    try {
      await switchCourse(slug);
      toast?.push({ tone: 'success', title: `Switched to ${slug === 'java' ? 'Java' : 'Python'}` });
      // Reload data on the current page with the new course.
      window.dispatchEvent(new Event('ail:course-changed'));
    } catch (err) {
      toast?.push({ tone: 'error', title: 'Could not switch course', body: err.message });
    } finally {
      setBusy(false);
    }
  };

  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  return (
    <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="group" aria-label="Select course">
      {COURSES.map((c) => (
        <button
          key={c.slug}
          type="button"
          disabled={busy}
          onClick={() => choose(c.slug)}
          aria-pressed={course === c.slug}
          className={`rounded-lg font-semibold transition-colors disabled:opacity-60 ${pad} ${
            course === c.slug ? 'bg-white text-brand-dark shadow-sm ring-1 ring-black/5' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
