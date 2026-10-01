import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function AuthScreen({ onSignedIn }) {
  const [mode, setMode] = useState('login');
  const [codeRequired, setCodeRequired] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', inviteCode: '' });
  const [status, setStatus] = useState({ busy: false, error: '' });

  useEffect(() => {
    api.authConfig().then((c) => setCodeRequired(c.signupCodeRequired)).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const signingUp = mode === 'signup';

  async function submit(e) {
    e.preventDefault();
    setStatus({ busy: true, error: '' });
    try {
      const user = signingUp
        ? await api.signup(form)
        : await api.login(form.email, form.password);
      onSignedIn(user);
    } catch (err) {
      setStatus({ busy: false, error: err.message });
    }
  }

  function switchMode() {
    setMode(signingUp ? 'login' : 'signup');
    setStatus({ busy: false, error: '' });
  }

  return (
    <main className="auth">
      <div className="auth-card">
        <h1>Finance Tracker</h1>
        <p className="muted">
          {signingUp ? 'Create an account to start tracking your spending.' : 'Sign in to see your spending and goals.'}
        </p>

        <form className="form" onSubmit={submit}>
          {signingUp && (
            <label className="field"><span>Name <em>(optional)</em></span>
              <input autoComplete="name" maxLength={80} value={form.name} onChange={set('name')} />
            </label>
          )}
          <label className="field"><span>Email</span>
            <input type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
          </label>
          <label className="field"><span>Password</span>
            <input
              type="password" required minLength={signingUp ? 8 : undefined}
              autoComplete={signingUp ? 'new-password' : 'current-password'}
              value={form.password} onChange={set('password')}
            />
            {signingUp && <small className="muted">At least 8 characters</small>}
          </label>
          {signingUp && codeRequired && (
            <label className="field"><span>Invite code</span>
              <input required autoComplete="off" value={form.inviteCode} onChange={set('inviteCode')} />
              <small className="muted">Ask the person who shared this app with you.</small>
            </label>
          )}

          {status.error && <p className="error" role="alert">{status.error}</p>}

          <button className="primary block" type="submit" disabled={status.busy}>
            {status.busy ? 'Please wait…' : signingUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          {signingUp ? 'Already have an account?' : 'New here?'}{' '}
          <button className="link" onClick={switchMode}>{signingUp ? 'Sign in' : 'Create an account'}</button>
        </p>
      </div>
    </main>
  );
}
