import { Link } from 'react-router-dom';

const features = [
  ['Adaptive Learning', 'Questions get harder when you are ready and step back when you are not, based on your streak, not the clock.', 'M13 2L4 14h7l-1 8 9-12h-7z'],
  ['Personalized Learning Path', 'Topics unlock in order, so you always know the single next thing to study.', 'M5 19a2 2 0 100-4 2 2 0 000 4zM19 9a2 2 0 100-4 2 2 0 000 4zM7 17h6a4 4 0 000-8H9a3 3 0 010-6h6'],
  ['Instant Explanations', 'Every answer comes with the reasoning, the underlying concept and a tip you can act on.', 'M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z'],
  ['Progress Tracking', 'Accuracy, attempts and mastery per topic, tracked separately for Java and Python.', 'M4 20V10M10 20V4M16 20v-7M22 20H2'],
  ['Topic Mastery', 'Mastery needs evidence: enough attempts, enough accuracy and success on applied questions.', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'],
  ['Curated Resources', 'Cheat sheets and video walkthroughs attached to the exact topic you are working on.', 'M4 4h16v12H4zM8 20h8M12 16v4']
];

const courses = [
  { slug: 'java', name: 'Java', blurb: 'Master core Java concepts from beginner to problem-solving level.', topics: 35, hours: 45, tone: 'from-amber-400 to-orange-500', chip: 'bg-java-light text-java' },
  { slug: 'python', name: 'Python', blurb: 'Go from your first print statement to confident problem solving.', topics: 35, hours: 40, tone: 'from-sky-400 to-blue-600', chip: 'bg-python-light text-python' }
];

const steps = ['Choose course', 'Learn topics', 'Take adaptive quiz', 'Get instant feedback', 'Difficulty adjusts', 'Master concepts'];
const stats = [['70', 'Topics'], ['2', 'Languages'], ['3', 'Difficulty levels'], ['100%', 'Free to try']];

export default function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-white">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-signal-500/15 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-signal-100 bg-signal-50 px-3 py-1 text-xs font-semibold text-signal-700">
                <span className="h-1.5 w-1.5 rounded-full bg-signal-500" /> Java &amp; Python, adaptively
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] sm:text-5xl lg:text-6xl">
                Learn smarter.<br />Adapt faster.<br />
                <span className="bg-gradient-to-r from-signal-600 to-emerald-400 bg-clip-text text-transparent">Master Java &amp; Python.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
                Every quiz reads your performance and adjusts. Two correct answers in a row and the questions get harder;
                a miss and the platform steps back, explains the idea and rebuilds the foundation before moving on.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/register" className="btn-primary px-6 py-3 text-base">Start learning</Link>
                <Link to="/login" className="btn-secondary px-6 py-3 text-base">Sign in</Link>
              </div>
              <p className="mt-6 text-xs text-ink-faint">
                Demo: student@example.com / password123 &middot; admin@example.com / password123
              </p>
            </div>

            <div className="relative animate-fade-up [animation-delay:150ms]">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-signal-500/20 to-python-500/20 blur-2xl" />
              <div className="card relative animate-float p-6 shadow-lift">
                <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
                  <span>Java &rarr; Arrays</span>
                  <span className="chip bg-medium-light text-medium">Medium</span>
                </div>
                <p className="mt-4 font-display text-base font-bold">Which declaration creates an integer array?</p>
                <pre className="code-block mt-3 text-[12px]"><code>{`int[] arr = new int[5];`}</code></pre>
                <div className="mt-4 rounded-xl border border-signal-100 bg-easy-light p-4 text-sm text-easy">
                  <p className="font-bold">✓ Correct</p>
                  <p className="mt-1 opacity-90">Mastery 62% &rarr; 72%. Difficulty medium &rarr; hard.</p>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-[72%] rounded-full bg-gradient-to-r from-signal-500 to-emerald-400" /></div>
              </div>
            </div>
          </div>

          <dl className="mt-16 grid grid-cols-2 gap-4 border-t border-line pt-8 sm:grid-cols-4">
            {stats.map(([n, l]) => (
              <div key={l} className="text-center sm:text-left">
                <dt className="font-display text-3xl font-extrabold text-ink">{n}</dt>
                <dd className="mt-1 text-sm text-ink-muted">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <p className="eyebrow">Features</p>
        <h2 className="mt-2 text-3xl font-extrabold">What makes it adaptive</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, body, icon]) => (
            <div key={title} className="card card-hover p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-signal-50 text-signal-600 ring-1 ring-signal-100">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
              </span>
              <h3 className="mt-4 text-base font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Courses */}
      <section id="courses" className="scroll-mt-20 border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="eyebrow">Courses</p>
          <h2 className="mt-2 text-3xl font-extrabold">Two courses, one engine</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {courses.map((c) => (
              <div key={c.slug} className="card card-hover flex flex-col overflow-hidden p-0">
                <div className={`h-2 bg-gradient-to-r ${c.tone}`} />
                <div className="flex flex-1 flex-col p-6">
                  <span className={`chip w-fit ${c.chip}`}>{c.name}</span>
                  <h3 className="mt-3 text-2xl font-extrabold">{c.name}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{c.blurb}</p>
                  <p className="mt-4 text-xs text-ink-muted">{c.topics} topics &middot; beginner to intermediate &middot; about {c.hours} hours</p>
                  <Link to="/register" className="btn-primary mt-5 w-fit">Start {c.name}</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="eyebrow">Process</p>
        <h2 className="mt-2 text-3xl font-extrabold">How it works</h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step} className="card card-hover flex items-center gap-4 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-signal-500 to-signal-700 font-display text-sm font-bold text-white shadow-glow">{i + 1}</span>
              <span className="text-sm font-semibold text-ink-soft">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section id="resources" className="scroll-mt-20 px-4 pb-20 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-navy-900 px-6 py-16 text-center">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-signal-500/30 blur-3xl" />
          <h2 className="relative text-3xl font-extrabold text-white">Cheat sheets and videos for every topic</h2>
          <p className="relative mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300">
            Each topic ships with syntax, common mistakes, interview tips and a curated video walkthrough,
            so revision never means hunting through a search engine mid-session.
          </p>
          <Link to="/register" className="btn-primary relative mt-8 px-6 py-3 text-base">Create a free account</Link>
        </div>
      </section>
    </>
  );
}
