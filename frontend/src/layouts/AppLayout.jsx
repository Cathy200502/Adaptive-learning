import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CourseSwitcher from '../components/CourseSwitcher';
import Logo from '../components/Logo';
import Icon from '../components/icons';

const studentNav = [
  ['Dashboard', '/dashboard', 'dashboard'],
  ['Courses', '/courses', 'courses'],
  ['Topic Explorer', '/topics', 'topics'],
  ['Learning Path', '/learning-path', 'path'],
  ['Adaptive Quiz', '/quiz', 'quiz'],
  ['Progress', '/progress', 'progress'],
  ['Resources', '/resources', 'resources'],
  ['Mistake Review', '/mistakes', 'mistakes'],
  ['Profile', '/profile', 'profile']
];

const adminNav = [
  ['Admin Dashboard', '/admin', 'admin'],
  ['Manage Courses', '/admin/courses', 'courses'],
  ['Manage Topics', '/admin/topics', 'topics'],
  ['Manage Questions', '/admin/questions', 'quiz'],
  ['Manage Resources', '/admin/resources', 'resources']
];

export default function AppLayout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const signOut = () => { logout(); navigate('/login'); };
  const initials = (user?.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-paper">
      {open && <div className="fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-navy-900 transition-transform duration-200 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between px-5">
          <Link to="/dashboard"><Logo light /></Link>
          <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation">
            <Icon name="close" />
          </button>
        </div>

        <nav aria-label="Application" className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
          <ul className="space-y-1">{studentNav.map(([l, to, i]) => <NavItem key={to} to={to} label={l} icon={i} />)}</ul>
          {isAdmin && (
            <>
              <p className="mb-2 mt-7 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Admin</p>
              <ul className="space-y-1">{adminNav.map(([l, to, i]) => <NavItem key={to} to={to} label={l} icon={i} end={to === '/admin'} />)}</ul>
            </>
          )}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-signal-700 text-xs font-bold text-white">{initials}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
              <p className="truncate text-xs capitalize text-slate-400">{user?.role || 'student'}</p>
            </div>
            <button type="button" onClick={signOut} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white" aria-label="Log out" title="Log out">
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-white/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setOpen(true)} className="btn-ghost -ml-2 px-2.5 py-2 lg:hidden" aria-expanded={open} aria-label="Open navigation">
              <Icon name="menu" />
            </button>
            <span className="hidden text-sm text-ink-muted sm:block">Learning workspace</span>
          </div>
          <div className="flex items-center gap-3"><CourseSwitcher size="sm" /></div>
        </header>
        <main className="mx-auto max-w-6xl animate-fade-up px-4 py-8 sm:px-6 lg:px-8"><Outlet /></main>
      </div>
    </div>
  );
}

function NavItem({ to, label, icon, end }) {
  return (
    <li>
      <NavLink to={to} end={end}
        className={({ isActive }) =>
          `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            isActive ? 'bg-gradient-to-r from-signal-600 to-signal-500 text-white shadow-glow' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
        <Icon name={icon} />
        {label}
      </NavLink>
    </li>
  );
}
