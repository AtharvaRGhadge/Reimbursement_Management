import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const cellInput =
  'w-full bg-transparent border-b border-white/25 text-white placeholder:text-slate-600 py-1.5 text-sm outline-none focus:border-accent';

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [nName, setNName] = useState('');
  const [nEmail, setNEmail] = useState('');
  const [nRole, setNRole] = useState('employee');
  const [nManagerId, setNManagerId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api('/users')
      .then(setUsers)
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const managers = users.filter((u) => u.role === 'manager');

  async function createUser(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: nName,
          email: nEmail,
          role: nRole,
          managerId: nRole === 'employee' && nManagerId ? nManagerId : undefined,
        }),
      });
      setToast(
        res.temporaryPassword
          ? `User created. Temporary password: ${res.temporaryPassword}`
          : 'User created.'
      );
      setNName('');
      setNEmail('');
      setNManagerId('');
      setShowNew(false);
      load();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  async function patchUser(u, patch) {
    setErr('');
    try {
      await api(`/users/${u._id || u.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  }

  async function sendPassword(u) {
    setErr('');
    setToast('');
    try {
      const res = await api(`/users/${u._id || u.id}/send-password`, { method: 'POST', body: '{}' });
      setToast(res.temporaryPassword ? `New password: ${res.temporaryPassword}` : res.message);
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <div className="max-w-5xl space-y-8">
      <header className="border-b border-white/15 pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-slate-500">Admin view</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-white tracking-tight">User management</h1>
            <p className="mt-1 text-sm text-slate-500 max-w-xl">
              Create people on the fly, assign roles, reporting lines, and issue temporary passwords
              (email is simulated in dev — check server logs).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNew((s) => !s)}
            className="shrink-0 px-5 py-2 rounded-lg border border-white/30 text-sm font-medium text-white hover:bg-white/5"
          >
            {showNew ? 'Close' : 'New'}
          </button>
        </div>
      </header>

      {err && <p className="text-sm text-rose-400">{err}</p>}
      {toast && (
        <p className="text-sm text-accent border border-accent/30 rounded-lg px-4 py-3 bg-accent/5">{toast}</p>
      )}

      {showNew && (
        <form
          onSubmit={createUser}
          className="rounded-xl border border-dashed border-white/20 bg-black/30 p-6 space-y-4"
        >
          <p className="text-xs font-mono uppercase text-slate-500">Add user</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-slate-500">User (name)</span>
              <input
                className={cellInput}
                value={nName}
                onChange={(e) => setNName(e.target.value)}
                required
                placeholder="marc"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">Email</span>
              <input
                className={cellInput}
                type="email"
                value={nEmail}
                onChange={(e) => setNEmail(e.target.value)}
                required
                placeholder="marc@gmail.com"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">Role</span>
              <select
                className="w-full bg-transparent border-b border-white/25 text-white py-1.5 text-sm outline-none"
                value={nRole}
                onChange={(e) => setNRole(e.target.value)}
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
              </select>
            </label>
            {nRole === 'employee' && (
              <label className="block">
                <span className="text-xs text-slate-500">Manager</span>
                <select
                  className="w-full bg-transparent border-b border-white/25 text-white py-1.5 text-sm outline-none"
                  value={nManagerId}
                  onChange={(e) => setNManagerId(e.target.value)}
                >
                  <option value="">—</option>
                  {managers.map((m) => (
                    <option key={m._id || m.id} value={m._id || m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-slate-200 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save user'}
          </button>
        </form>
      )}

      <div className="rounded-xl border border-white/15 overflow-hidden bg-black/20">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs font-mono uppercase tracking-wider text-slate-500 border-b border-white/10">
              <th className="px-4 py-3 font-normal">User</th>
              <th className="px-4 py-3 font-normal">Role</th>
              <th className="px-4 py-3 font-normal">Manager</th>
              <th className="px-4 py-3 font-normal">Email</th>
              <th className="px-4 py-3 font-normal w-40">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id || u.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                <td className="px-4 py-3 align-top">
                  <input
                    className={cellInput}
                    defaultValue={u.name}
                    onBlur={(e) => {
                      if (e.target.value !== u.name) patchUser(u, { name: e.target.value });
                    }}
                  />
                </td>
                <td className="px-4 py-3 align-top">
                  <select
                    className="w-full bg-transparent border-b border-white/25 text-white py-1.5 text-sm capitalize"
                    value={u.role}
                    onChange={(e) => patchUser(u, { role: e.target.value })}
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-3 align-top">
                  {u.role === 'employee' ? (
                    <select
                      className="w-full bg-transparent border-b border-white/25 text-white py-1.5 text-sm"
                      value={u.managerId || ''}
                      onChange={(e) => patchUser(u, { managerId: e.target.value || null })}
                    >
                      <option value="">—</option>
                      {managers.map((m) => (
                        <option key={m._id || m.id} value={m._id || m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-slate-600 py-1.5 inline-block">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400 align-top">{u.email}</td>
                <td className="px-4 py-3 align-top">
                  {u.role === 'admin' && (u._id || u.id) !== me?.id ? (
                    <span className="text-slate-600 text-xs">—</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sendPassword(u)}
                      className="text-xs underline decoration-white/30 underline-offset-4 text-white hover:decoration-accent hover:text-accent"
                    >
                      Send password
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-600 max-w-2xl">
        Forgot password on the sign-in page uses the same reset flow: request a token, then set a new password.
        “Send password” generates a random password immediately (production would email it).
      </p>
    </div>
  );
}
