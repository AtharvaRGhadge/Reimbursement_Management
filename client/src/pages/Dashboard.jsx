import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const { user, company } = useAuth();
  const role = user?.role;
  const [pending, setPending] = useState(null);
  const [mine, setMine] = useState([]);

  useEffect(() => {
    if (role === 'manager' || role === 'admin') {
      api('/expenses/pending')
        .then(setPending)
        .catch(() => setPending([]));
    }
    if (role === 'employee') {
      api('/expenses/mine')
        .then((r) => setMine(r.slice(0, 5)))
        .catch(() => setMine([]));
    }
  }, [role]);

  if (role === 'admin') {
    return (
      <div className="space-y-10">
        <header className="relative">
          <div className="absolute -left-4 top-0 h-full w-1 rounded-full bg-gradient-to-b from-flare to-accent opacity-80" />
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-slate-500 pl-2">Admin</p>
          <h1 className="text-4xl font-semibold text-white tracking-tight pl-2">Hello, {user?.name?.split(' ')[0]}</h1>
          <p className="mt-2 text-slate-500 max-w-xl pl-2">
            {company?.name} · configure people, rules, and review the company ledger.
          </p>
        </header>

        {company?.joinCode && (
          <div className="rounded-xl border border-accent/25 bg-accent/5 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-mono uppercase text-slate-500">Company join code</p>
              <p className="font-mono text-lg text-accent tracking-wider">{company.joinCode}</p>
              <p className="text-xs text-slate-500 mt-1">Share with employees and managers so they can sign up and join this org.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(company.joinCode);
              }}
              className="px-4 py-2 rounded-lg border border-accent/40 text-sm text-accent hover:bg-accent/10"
            >
              Copy code
            </button>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/approvals"
            className="group rounded-2xl border border-mist bg-mist/30 p-6 hover:border-accent/40 hover:shadow-glow transition-all"
          >
            <p className="font-mono text-xs uppercase text-slate-500">Approval queue</p>
            <p className="mt-2 text-3xl font-mono text-white">{pending === null ? '—' : pending.length}</p>
            <p className="mt-2 text-sm text-slate-400 group-hover:text-accent transition-colors">Review pending →</p>
          </Link>
          <Link
            to="/admin/users"
            className="group rounded-2xl border border-mist bg-mist/20 p-6 hover:border-flare/40 transition-all"
          >
            <p className="font-mono text-xs uppercase text-slate-500">People</p>
            <p className="mt-2 text-lg text-white">User management</p>
            <p className="mt-2 text-sm text-slate-500">Roles & managers</p>
          </Link>
          <Link
            to="/admin/all"
            className="group rounded-2xl border border-mist bg-mist/20 p-6 hover:border-accent/40 transition-all"
          >
            <p className="font-mono text-xs uppercase text-slate-500">Ledger</p>
            <p className="mt-2 text-lg font-mono text-accent">{company?.currencySymbol}</p>
            <p className="mt-2 text-sm text-slate-500">All expenses</p>
          </Link>
        </div>
      </div>
    );
  }

  if (role === 'manager') {
    return (
      <div className="space-y-10">
        <header className="relative">
          <div className="absolute -left-4 top-0 h-full w-1 rounded-full bg-gradient-to-b from-accent to-flare opacity-80" />
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-slate-500 pl-2">Manager</p>
          <h1 className="text-4xl font-semibold text-white tracking-tight pl-2">Hello, {user?.name?.split(' ')[0]}</h1>
          <p className="mt-2 text-slate-500 max-w-xl pl-2">
            {company?.name} · approve team expenses in {company?.currencyCode}.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Link
            to="/approvals"
            className="group rounded-2xl border border-mist bg-mist/30 p-6 hover:border-accent/40 hover:shadow-glow transition-all"
          >
            <p className="font-mono text-xs uppercase text-slate-500">Inbox</p>
            <p className="mt-2 text-3xl font-mono text-white">{pending === null ? '—' : pending.length}</p>
            <p className="mt-2 text-sm text-slate-400 group-hover:text-accent transition-colors">
              Manager&apos;s view →
            </p>
          </Link>
          <div className="rounded-2xl border border-mist bg-mist/20 p-6">
            <p className="font-mono text-xs uppercase text-slate-500">Role</p>
            <p className="mt-2 text-xl capitalize text-white">Manager</p>
            <p className="mt-2 text-sm text-slate-500">You only see team approvals and this overview.</p>
          </div>
        </div>
      </div>
    );
  }

  /* employee */
  return (
    <div className="space-y-10">
      <header className="relative">
        <div className="absolute -left-4 top-0 h-full w-1 rounded-full bg-gradient-to-b from-accent to-flare opacity-80" />
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-slate-500 pl-2">Employee</p>
        <h1 className="text-4xl font-semibold text-white tracking-tight pl-2">Hello, {user?.name?.split(' ')[0]}</h1>
        <p className="mt-2 text-slate-500 max-w-xl pl-2">
          {company?.name} · reporting currency{' '}
          <span className="font-mono text-accent">{company?.currencyCode}</span>
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-mist bg-mist/20 p-6">
          <p className="font-mono text-xs uppercase text-slate-500">Role</p>
          <p className="mt-2 text-xl capitalize text-white">Employee</p>
          <p className="mt-2 text-sm text-slate-500">Submit claims and track status — admin tools are hidden.</p>
        </div>
        <div className="rounded-2xl border border-mist bg-mist/20 p-6">
          <p className="font-mono text-xs uppercase text-slate-500">Ledger</p>
          <p className="mt-2 text-xl font-mono text-accent">{company?.currencySymbol}</p>
          <p className="mt-2 text-sm text-slate-500">Approvers see amounts in this currency.</p>
        </div>
        <Link
          to="/expenses/new"
          className="rounded-2xl border border-accent/30 bg-accent/5 p-6 hover:bg-accent/10 transition-colors"
        >
          <p className="font-mono text-xs uppercase text-accent">Quick action</p>
          <p className="mt-2 text-lg text-white">New expense</p>
          <p className="mt-2 text-sm text-slate-500">Upload receipt or enter details →</p>
        </Link>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-white">Recent claims</h2>
          <Link to="/expenses" className="text-sm text-accent hover:underline">
            View all
          </Link>
        </div>
        <div className="rounded-2xl border border-mist/80 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-void/80 text-left text-xs font-mono uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Company amt</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {mine.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No expenses yet.{' '}
                    <Link to="/expenses/new" className="text-accent underline">
                      Create one
                    </Link>
                  </td>
                </tr>
              )}
              {mine.map((e) => (
                <tr key={e._id} className="border-t border-mist/60 hover:bg-mist/20">
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(e.expenseDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-white">{e.category}</td>
                  <td className="px-4 py-3 text-right font-mono text-accent">
                    {company?.currencySymbol}
                    {e.amountCompany?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    draft: 'bg-slate-600/30 text-slate-300',
    pending: 'bg-warn/15 text-warn border border-warn/30',
    approved: 'bg-accent/15 text-accent border border-accent/30',
    rejected: 'bg-danger/15 text-danger border border-danger/30',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs capitalize ${map[status] || ''}`}>
      {status}
    </span>
  );
}
