import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', selectedCourse: 'java' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = 'Enter your full name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address';
    if (form.password.length < 6) next.password = 'Use at least 6 characters';
    if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event) {
    event.preventDefault();
    setServerError('');
    if (!validate()) return;

    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        selectedCourse: form.selectedCourse
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const field = (key) => (errors[key] ? 'input border-hard focus:border-hard' : 'input');

  return (
    <div className="w-full">
      <h1 className="font-display text-3xl font-extrabold">Create your account</h1>
      <p className="mt-2 text-sm text-ink-soft">Start at easy. The engine takes it from there.</p>

      <form className="card mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        {serverError && <p className="rounded-lg bg-hard-light px-3 py-2 text-sm text-hard" role="alert">{serverError}</p>}

        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" className={field('name')} value={form.name} onChange={update('name')} autoComplete="name" />
          {errors.name && <p className="mt-1 text-xs text-hard">{errors.name}</p>}
        </div>

        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className={field('email')} value={form.email} onChange={update('email')} autoComplete="email" />
          {errors.email && <p className="mt-1 text-xs text-hard">{errors.email}</p>}
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <div className="relative">
            <input id="password" type={showPassword ? 'text' : 'password'} className={`${field('password')} pr-16`}
                   value={form.password} onChange={update('password')} autoComplete="new-password" />
            <button type="button" onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-ink-faint hover:text-ink">
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-hard">{errors.password}</p>}
        </div>

        <div>
          <label className="label" htmlFor="confirmPassword">Confirm password</label>
          <input id="confirmPassword" type={showPassword ? 'text' : 'password'} className={field('confirmPassword')}
                 value={form.confirmPassword} onChange={update('confirmPassword')} autoComplete="new-password" />
          {errors.confirmPassword && <p className="mt-1 text-xs text-hard">{errors.confirmPassword}</p>}
        </div>

        <div>
          <span className="label">Start with</span>
          <div className="flex gap-2">
            {['java', 'python'].map((slug) => (
              <button key={slug} type="button" onClick={() => setForm((f) => ({ ...f, selectedCourse: slug }))}
                aria-pressed={form.selectedCourse === slug}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  form.selectedCourse === slug ? 'border-brand bg-brand-light text-brand-dark' : 'border-line text-ink-soft hover:bg-surface'}`}>
                {slug}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>

        <p className="text-center text-sm text-ink-faint">
          Already have an account? <Link to="/login" className="text-brand hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
