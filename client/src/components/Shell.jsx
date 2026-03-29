import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const linkClass = ({ isActive }) =>
  [
    'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border',
    isActive
      ? 'bg-mist/80 border-accent/40 text-white shadow-glow'
      : 'border-transparent text-slate-400 hover:text-white hover:bg-mist/40',
  ].join(' ');

export default function Shell() {
  const { user, company, logout } = useAuth();
  const nav = useNavigate();
  const role = user?.role;

  return (
    <div className="min-h-screen flex bg-grid-radial bg-mesh">
      <aside className="w-64 shrink-0 border-r border-mist/80 bg-ink/90 backdrop-blur-xl flex flex-col">
        <div className="p-6 border-b border-mist/60">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-accent/90">Lumen Ledger</div>
          <p className="mt-1 text-lg font-semibold text-white text-balance">Reimbursement OS</p>
          <p className="mt-2 text-xs text-slate-500">
            Base currency{' '}
            <span className="font-mono text-accent">
              {company?.currencyCode} {company?.currencySymbol}
            </span>
          </p>
          {role && (
            <p className="mt-2 text-[10px] font-mono uppercase tracking-widest text-slate-600">
              Signed in as <span className="text-slate-400 capitalize">{role}</span>
            </p>
          )}
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavLink to="/" end className={linkClass}>
            <span className="text-lg">◆</span> Overview
          </NavLink>

          {role === 'employee' && (
            <>
              <NavLink to="/expenses" className={linkClass}>
                <span className="text-lg">◇</span> My claims
              </NavLink>
              <NavLink to="/expenses/new" className={linkClass}>
                <span className="text-lg">＋</span> New expense
              </NavLink>
            </>
          )}

          {role === 'manager' && (
            <NavLink to="/approvals" className={linkClass}>
              <span className="text-lg">✓</span> Manager&apos;s view
            </NavLink>
          )}

          {role === 'admin' && (
            <>
              <NavLink to="/approvals" className={linkClass}>
                <span className="text-lg">✓</span> Approval queue
              </NavLink>
              <div className="pt-4 pb-1 px-2 text-[10px] font-mono uppercase tracking-widest text-slate-600">
                Administration
              </div>
              <NavLink to="/admin/users" className={linkClass}>
                <span className="text-lg">◎</span> User management
              </NavLink>
              <NavLink to="/admin/approval-rules" className={linkClass}>
                <span className="text-lg">⎔</span> Approval rules
              </NavLink>
              <NavLink to="/admin/workflows" className={linkClass}>
                <span className="text-lg">⚙</span> Advanced workflows
              </NavLink>
              <NavLink to="/admin/all" className={linkClass}>
                <span className="text-lg">≡</span> All expenses
              </NavLink>
            </>
          )}
        </nav>
        <div className="p-4 border-t border-mist/60">
          <div className="rounded-xl bg-mist/50 p-3 mb-3">
            <p className="text-sm font-medium text-white">{user?.name}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              nav('/login');
            }}
            className="w-full py-2.5 rounded-xl border border-mist text-sm text-slate-400 hover:border-accent/40 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
