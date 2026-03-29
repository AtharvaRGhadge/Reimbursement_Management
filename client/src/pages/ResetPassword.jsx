import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function ResetPassword() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, token, password }),
      });
      nav('/login');
    } catch (ex) {
      setErr(ex.message || 'Reset failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-grid-radial bg-mesh">
      <div className="w-full max-w-md rounded-3xl border border-mist/80 bg-ink/90 p-10 shadow-card backdrop-blur-xl">
        <h1 className="text-2xl font-semibold text-white mb-2">Set new password</h1>
        <p className="text-slate-500 text-sm mb-6">Use the token from your email (or dev output).</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            required
            className="w-full rounded-xl bg-void border border-mist px-4 py-3 text-sm"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-xl bg-void border border-mist px-4 py-3 text-sm font-mono"
            placeholder="Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <input
            type="password"
            required
            minLength={8}
            className="w-full rounded-xl bg-void border border-mist px-4 py-3 text-sm"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {err && <p className="text-sm text-danger">{err}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-flare text-ink font-semibold text-sm disabled:opacity-50"
          >
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
        <p className="mt-8 text-center text-sm text-slate-500">
          <Link to="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
