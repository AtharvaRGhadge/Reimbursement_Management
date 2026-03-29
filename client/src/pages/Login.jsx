import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login(email, password);
      nav('/', { replace: true });
    } catch (ex) {
      setErr(ex.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-grid-radial bg-mesh">
      <div className="w-full max-w-md rounded-3xl border border-mist/80 bg-ink/90 p-10 shadow-card backdrop-blur-xl">
        <div className="font-mono text-xs uppercase tracking-[0.25em] text-accent/90 mb-2">Welcome back</div>
        <h1 className="text-3xl font-semibold text-white mb-2">Sign in</h1>
        <p className="text-slate-500 text-sm mb-4">Access your reimbursement workspace.</p>
        <p className="text-xs text-slate-600 mb-8 leading-relaxed border border-white/5 rounded-xl px-4 py-3 bg-black/20">
          New organization?
          Sign up as admin; team members join with a company code.
        </p>
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-mono uppercase text-slate-500 mb-1.5">Email</label>
            <input
              className="w-full rounded-xl bg-void border border-mist px-4 py-3 text-sm focus:border-accent outline-none transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase text-slate-500 mb-1.5">Password</label>
            <input
              className="w-full rounded-xl bg-void border border-mist px-4 py-3 text-sm focus:border-accent outline-none transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-accent text-ink font-semibold text-sm hover:brightness-110 disabled:opacity-50 transition-all shadow-glow"
          >
            {busy ? 'Signing in…' : 'Continue'}
          </button>
        </form>
        <div className="mt-6 flex flex-col gap-2 text-center text-sm text-slate-500">
          <Link to="/forgot-password" className="text-slate-400 hover:text-accent hover:underline">
            Forgot password?
          </Link>
          <p>
            No account?{' '}
            <Link to="/signup" className="text-accent hover:underline">
              Signup
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
