import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    if (!form.email.trim() || !form.password) { setError('Enter your email and password'); return; }

    setLoading(true);
    try {
      const user = await login({ email: form.email.trim(), password: form.password });
      navigate(location.state?.from || (user.role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <h1 className="font-display text-3xl font-extrabold">Welcome back</h1>
      <p className="mt-2 text-sm text-ink-soft">Sign in to pick up where your learning path left off.</p>

      <form className="card mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        {error && <p className="rounded-lg bg-hard-light px-3 py-2 text-sm text-hard" role="alert">{error}</p>}

        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email"
                 value={form.email} onChange={update('email')} placeholder="you@example.com" />
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <div className="relative">
            <input id="password" className="input pr-16" type={showPassword ? 'text' : 'password'}
                   autoComplete="current-password" value={form.password} onChange={update('password')} />
            <button type="button" onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-ink-faint hover:text-ink">
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        <p className="text-center text-sm text-ink-faint">
          New here? <Link to="/register" className="text-brand hover:underline">Create an account</Link>
        </p>
      </form>

      <div className="mt-4 rounded-lg border border-line bg-surface p-3 text-xs text-ink-faint">
        <p className="font-medium text-ink-soft">Demo accounts</p>
        <p className="mt-1">student@example.com / password123</p>
        <p>admin@example.com / password123</p>
      </div>
    </div>
  );
}
