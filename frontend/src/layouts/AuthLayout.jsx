import { Link, Outlet } from 'react-router-dom';
import Logo from '../components/Logo';

const points = ['Difficulty that follows your streak', 'A learning path that unlocks in order', 'Instant explanations for every answer'];

export default function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-signal-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-python-500/20 blur-3xl" />
        <Link to="/" className="relative"><Logo light /></Link>
        <div className="relative">
          <h2 className="max-w-md font-display text-4xl font-extrabold leading-tight">Learn Java &amp; Python at the pace your understanding sets.</h2>
          <ul className="mt-8 space-y-4">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-slate-300">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-signal-500/20 text-emerald-300">✓</span>{p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">&copy; {new Date().getFullYear()} Adaptive Intelligence</p>
      </aside>
      <div className="flex items-center justify-center bg-paper p-4 sm:p-8">
        <div className="w-full max-w-md animate-fade-up">
          <Link to="/" className="mb-6 block lg:hidden"><Logo /></Link>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
