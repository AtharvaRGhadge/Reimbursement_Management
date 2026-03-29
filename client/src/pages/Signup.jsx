import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Signup() {
  const { signup, user } = useAuth();
  const [countries, setCountries] = useState([]);
  const [accountType, setAccountType] = useState('admin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/meta/countries')
      .then(setCountries)
      .catch(() => setErr('Could not load countries'));
  }, []);

  useEffect(() => {
    const t = joinCode.trim();
    if (t.length < 4) {
      setPreviewName('');
      return;
    }
    const id = setTimeout(() => {
      api(`/meta/company-preview/${encodeURIComponent(t)}`)
        .then((d) => setPreviewName(d.companyName || ''))
        .catch(() => setPreviewName(''));
    }, 400);
    return () => clearTimeout(id);
  }, [joinCode]);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      if (password !== passwordConfirm) {
        setErr('Passwords do not match');
        return;
      }
      await signup({
        accountType,
        name,
        email,
        password,
        passwordConfirm,
        countryCode: accountType === 'admin' ? countryCode : undefined,
        joinCode: accountType !== 'admin' ? joinCode : undefined,
      });
    } catch (ex) {
      setErr(ex.message || 'Signup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-grid-radial bg-mesh">
      <div className="w-full max-w-lg rounded-3xl border border-mist/80 bg-ink/90 p-10 shadow-card backdrop-blur-xl">
        <div className="font-mono text-xs uppercase tracking-[0.25em] text-flare/90 mb-2">Provision</div>
        <h1 className="text-3xl font-semibold text-white mb-2">Create an account</h1>
        <p className="text-slate-500 text-sm mb-6 text-balance">
          Choose how you&apos;re joining: <strong className="text-slate-400">Admin</strong> creates a new company;
          <strong className="text-slate-400"> Employee</strong> or <strong className="text-slate-400">Manager</strong>{' '}
          join an existing org with the company code from your admin.
        </p>

        <div className="grid grid-cols-3 gap-2 mb-8">
          {[
            { id: 'admin', label: 'Admin' },
            { id: 'employee', label: 'Employee' },
            { id: 'manager', label: 'Manager' },
          ].map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setAccountType(o.id)}
              className={`py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                accountType === o.id
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-mist text-slate-400 hover:border-slate-500'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-mono uppercase text-slate-500 mb-1.5">Your name</label>
            <input
              className="w-full rounded-xl bg-void border border-mist px-4 py-3 text-sm focus:border-accent outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase text-slate-500 mb-1.5">Work email</label>
            <input
              className="w-full rounded-xl bg-void border border-mist px-4 py-3 text-sm focus:border-accent outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase text-slate-500 mb-1.5">Password</label>
            <input
              className="w-full rounded-xl bg-void border border-mist px-4 py-3 text-sm focus:border-accent outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase text-slate-500 mb-1.5">Confirm password</label>
            <input
              className="w-full rounded-xl bg-void border border-mist px-4 py-3 text-sm focus:border-accent outline-none"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              type="password"
              required
              minLength={8}
            />
          </div>

          {accountType === 'admin' && (
            <div>
              <label className="block text-xs font-mono uppercase text-slate-500 mb-1.5">
                Country (company base currency)
              </label>
              <select
                className="w-full rounded-xl bg-void border border-mist px-4 py-3 text-sm focus:border-accent outline-none"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                required
              >
                <option value="">Select…</option>
                {countries.map((c) => (
                  <option key={c.countryCode} value={c.countryCode}>
                    {c.name} — {c.currencyCode} ({c.currencySymbol})
                  </option>
                ))}
              </select>
            </div>
          )}

          {accountType !== 'admin' && (
            <div>
              <label className="block text-xs font-mono uppercase text-slate-500 mb-1.5">Company join code</label>
              <input
                className="w-full rounded-xl bg-void border border-mist px-4 py-3 text-sm font-mono uppercase focus:border-accent outline-none"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="e.g. A1B2C3D4"
                required
                autoComplete="off"
              />
              {previewName && (
                <p className="mt-2 text-xs text-accent">Joining: {previewName}</p>
              )}
            </div>
          )}

          {err && <p className="text-sm text-danger">{err}</p>}
          <button
            type="submit"
            disabled={busy || (accountType === 'admin' && !countries.length)}
            className="w-full py-3 rounded-xl bg-flare text-ink font-semibold text-sm hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {busy ? 'Creating…' : accountType === 'admin' ? 'Create organization' : 'Join company'}
          </button>
        </form>
        <p className="mt-8 text-center text-sm text-slate-500">
          Already have access?{' '}
          <Link to="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
