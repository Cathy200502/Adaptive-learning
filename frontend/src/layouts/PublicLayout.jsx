import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

const navItems = [
  ['Home', '/'],
  ['Courses', '/#courses'],
  ['Features', '/#features'],
  ['Resources', '/#resources']
];

/** Header + footer shell used by the public (signed-out) pages. */
export default function PublicLayout() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link to="/"><Logo /></Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {navItems.map(([label, href]) => (
              <a key={label} href={href} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface transition hover:text-emerald-300">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard" className="btn-primary px-4 py-2 text-sm">Go to dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="btn-secondary px-3 py-2 text-sm">Login</Link>
                <Link to="/register" className="btn-primary px-3 py-2 text-sm">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-white/5 bg-navy-900 text-slate-400">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div>
            <Logo light />
            <p className="mt-2 max-w-xs text-sm text-slate-400">
              Adaptive quizzes for Java and Python that meet you where your understanding actually is.
            </p>
          </div>
          <FooterColumn
            title="Product"
            links={[['Courses', '/courses'], ['Learning path', '/learning-path'], ['Progress', '/progress']]}
          />
          <FooterColumn
            title="Learn"
            links={[['Resources', '/resources'], ['Topic explorer', '/topics'], ['Mistake review', '/mistakes']]}
          />
          <FooterColumn
            title="About"
            external
            links={[
              ['Contact', 'mailto:hello@example.com'],
              ['GitHub', 'https://github.com'],
              ['Java docs', 'https://docs.oracle.com/javase/tutorial/'],
              ['Python docs', 'https://docs.python.org/3/tutorial/index.html']
            ]}
          />
        </div>
        <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} Adaptive Intelligence. Built as a learning platform demo.
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({ title, links, external }) {
  return (
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-slate-400">
        {links.map(([label, href]) => (
          <li key={label}>
            {external ? (
              <a className="transition hover:text-emerald-300" href={href} target="_blank" rel="noreferrer">{label}</a>
            ) : (
              <Link className="transition hover:text-emerald-300" to={href}>{label}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
