import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useAsync from '../hooks/useAsync';
import { auth as authApi, progress as progressApi } from '../services/api';
import { COURSE_LABEL, ErrorState, Loading, ProgressBar, SectionTitle } from '../components/ui';

export default function Profile() {
  const { user, updateUser, course, switchCourse } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => progressApi.overview(), []);
  const [name, setName] = useState(user.name);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [saving, setSaving] = useState(false);

  if (loading) return <Loading label="Loading your profile…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const summary = data.courses[course];

  const saveName = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await authApi.updateProfile({ name });
      updateUser(updated);
      toast.push({ tone: 'success', title: 'Profile updated' });
    } catch (err) {
      toast.push({ tone: 'error', title: 'Could not update profile', body: err.message });
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pw.newPassword.length < 6) return toast.push({ tone: 'error', title: 'New password must be at least 6 characters' });
    try {
      await authApi.changePassword(pw);
      setPw({ currentPassword: '', newPassword: '' });
      toast.push({ tone: 'success', title: 'Password changed' });
    } catch (err) {
      toast.push({ tone: 'error', title: 'Could not change password', body: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Profile</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle title="Account" />
          <form className="space-y-4" onSubmit={saveName}>
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" className="field bg-paper" value={user.email} disabled />
            </div>
            <div>
              <label className="label" htmlFor="preferred">Preferred course</label>
              <select id="preferred" className="field" value={course} onChange={(e) => switchCourse(e.target.value)}>
                {Object.entries(COURSE_LABEL).map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
              </select>
            </div>
            <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <SectionTitle title={`${COURSE_LABEL[course]} at a glance`} />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-ink-muted">Overall mastery</dt><dd className="font-medium">{summary.overallProgress}%</dd></div>
              <div><dt className="text-ink-muted">Topics completed</dt><dd className="font-medium">{summary.topicsCompleted} / {summary.totalTopics}</dd></div>
              <div><dt className="text-ink-muted">Questions attempted</dt><dd className="font-medium">{data.performance.attempted}</dd></div>
              <div><dt className="text-ink-muted">Accuracy</dt><dd className="font-medium">{data.performance.accuracy}%</dd></div>
              <div><dt className="text-ink-muted">Learning streak</dt><dd className="font-medium">{user.streak?.count || 0} days</dd></div>
              <div><dt className="text-ink-muted">Role</dt><dd className="font-medium capitalize">{user.role}</dd></div>
            </dl>
            <ProgressBar className="mt-4" value={summary.overallProgress} tone={course} />
          </div>

          <div className="card p-5">
            <SectionTitle title="Change password" />
            <form className="space-y-4" onSubmit={savePassword}>
              <div>
                <label className="label" htmlFor="current">Current password</label>
                <input id="current" type="password" className="field" value={pw.currentPassword}
                  onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="new">New password</label>
                <input id="new" type="password" className="field" value={pw.newPassword}
                  onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
              </div>
              <button className="btn-ghost">Update password</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
