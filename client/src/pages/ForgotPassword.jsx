import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setToken('');
    try {
      const data = await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMsg(data.message || 'Check your email.');
      if (data.devToken) setToken(data.devToken);
    } catch (ex) {
      setMsg(ex.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-grid-radial bg-mesh">
      <div className="w-full max-w-md rounded-3xl border border-mist/80 bg-ink/90 p-10 shadow-card backdrop-blur-xl">
        <h1 className="text-2xl font-semibold text-white mb-2">Forgot password</h1>
        <p className="text-slate-500 text-sm mb-6">
          Enter your email. In production we’d send a reset link; in development a token may appear below.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            required
            className="w-full rounded-xl bg-void border border-mist px-4 py-3 text-sm"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-accent text-ink font-semibold text-sm disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send reset'}
          </button>
        </form>
        {msg && <p className="mt-4 text-sm text-slate-400">{msg}</p>}
        {token && (
          <p className="mt-2 text-xs font-mono text-warn break-all">
            Dev token: {token} — use on the reset page with the same email.
          </p>
        )}
        <p className="mt-8 text-center text-sm text-slate-500">
          <Link to="/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
