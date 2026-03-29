import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

function statusLabel(s) {
  if (s === 'pending') return 'Pending approval';
  if (s === 'approved') return 'Approved';
  if (s === 'rejected') return 'Rejected';
  return s || '—';
}

export default function Approvals() {
  const { company, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [comment, setComment] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [openComment, setOpenComment] = useState(null);

  const load = useCallback(() => {
    return api('/expenses/team')
      .then(setRows)
      .catch((e) => {
        setErr(e.message);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id, decision) {
    setBusyId(id);
    setErr('');
    try {
      await api(`/expenses/${id}/action`, {
        method: 'POST',
        body: JSON.stringify({ decision, comment: comment[id] || '' }),
      });
      setComment((c) => ({ ...c, [id]: '' }));
      setOpenComment(null);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function override(id, decision) {
    setBusyId(id);
    setErr('');
    try {
      await api(`/expenses/${id}/override`, {
        method: 'POST',
        body: JSON.stringify({ decision, comment: comment[id] || '' }),
      });
      setComment((c) => ({ ...c, [id]: '' }));
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusyId(null);
    }
  }

  const isManager = user?.role === 'manager';
  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <span
            className="lg:hidden p-2 rounded-lg border border-white/15 text-slate-400"
            aria-hidden
          >
            <span className="block w-4 space-y-1">
              <span className="block h-0.5 bg-current" />
              <span className="block h-0.5 bg-current" />
              <span className="block h-0.5 bg-current" />
            </span>
          </span>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-slate-500">
              {isManager ? "Manager's view" : isAdmin ? 'Admin' : 'Approvals'}
            </p>
            <h1 className="text-2xl font-semibold text-white mt-0.5">
              {isManager ? 'Team reimbursement' : isAdmin ? 'Approval queue' : 'Approvals'}
            </h1>
          </div>
        </div>
        <div className="flex items-center -space-x-2">
          {['W', 'E', 'V', 'A', 'C', 'B'].map((x, i) => (
            <span
              key={i}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-mist/80 text-[11px] font-medium text-slate-300"
              title="Team"
            >
              {x}
            </span>
          ))}
          <span className="inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-full border border-dashed border-white/20 px-2 text-[10px] text-slate-500">
            +201
          </span>
        </div>
      </header>

      {err && <p className="text-sm text-rose-400">{err}</p>}

      <div>
        <h2 className="text-sm font-medium text-white mb-3">Approvals to review</h2>
        <div className="rounded-lg border border-white/15 bg-black/25 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[960px]">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-slate-500 border-b border-white/10">
                  <th className="px-4 py-3 font-normal">Approval subject</th>
                  <th className="px-4 py-3 font-normal">Request owner</th>
                  <th className="px-4 py-3 font-normal">Category</th>
                  <th className="px-4 py-3 font-normal">Request status</th>
                  <th className="px-4 py-3 font-normal min-w-[220px]">Total amount (company currency)</th>
                  <th className="px-4 py-3 font-normal w-[200px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      No team expenses yet.
                    </td>
                  </tr>
                )}
                {rows.map((e) => {
                  const subject =
                    (e.description && e.description.trim()) ||
                    e.workflowId?.name ||
                    '—';
                  const owner = e.employeeId?.name || '—';
                  const canAct = e.canAct && e.status === 'pending';
                  const readOnly = !canAct;

                  return (
                    <tr key={e._id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-slate-300 max-w-[180px] truncate" title={subject}>
                        {subject}
                      </td>
                      <td className="px-4 py-3 text-white">{owner}</td>
                      <td className="px-4 py-3 text-slate-400">{e.category || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs ${
                            e.status === 'pending'
                              ? 'bg-amber-500/15 text-amber-200 border border-amber-500/25'
                              : e.status === 'approved'
                                ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/25'
                                : 'bg-rose-500/10 text-rose-200 border border-rose-500/25'
                          }`}
                        >
                          {statusLabel(e.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">
                        <span className="text-slate-400">
                          {e.amountOriginal} {e.currencyOriginal}
                        </span>
                        {e.currencyOriginal !== company?.currencyCode && (
                          <span className="text-slate-600"> (receipt)</span>
                        )}
                        <span className="block sm:inline sm:before:content-['_='] sm:before:mx-1 text-accent mt-1 sm:mt-0">
                          {company?.currencySymbol}
                          {Number(e.amountCompany).toFixed(2)} {company?.currencyCode}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {canAct ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={busyId === e._id}
                                onClick={() => act(e._id, 'approve')}
                                className="px-3 py-1.5 rounded-md border border-emerald-500/60 text-emerald-300 text-xs font-medium hover:bg-emerald-500/10 disabled:opacity-40"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={busyId === e._id}
                                onClick={() => act(e._id, 'reject')}
                                className="px-3 py-1.5 rounded-md border border-rose-500/60 text-rose-300 text-xs font-medium hover:bg-rose-500/10 disabled:opacity-40"
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                className="text-[10px] text-slate-500 underline"
                                onClick={() =>
                                  setOpenComment((x) => (x === e._id ? null : e._id))
                                }
                              >
                                {openComment === e._id ? 'Hide note' : 'Note'}
                              </button>
                            </div>
                            {openComment === e._id && (
                              <textarea
                                placeholder="Comment (optional)"
                                className="w-full min-h-[56px] rounded-md bg-black/40 border border-white/10 px-2 py-1.5 text-xs text-white placeholder:text-slate-600"
                                value={comment[e._id] || ''}
                                onChange={(ev) =>
                                  setComment((c) => ({ ...c, [e._id]: ev.target.value }))
                                }
                              />
                            )}
                            {user?.role === 'admin' && (
                              <div className="flex gap-2 pt-1 border-t border-white/5">
                                <button
                                  type="button"
                                  disabled={busyId === e._id}
                                  onClick={() => override(e._id, 'approve')}
                                  className="text-[10px] px-2 py-1 rounded border border-violet-500/40 text-violet-300"
                                >
                                  Force approve
                                </button>
                                <button
                                  type="button"
                                  disabled={busyId === e._id}
                                  onClick={() => override(e._id, 'reject')}
                                  className="text-[10px] px-2 py-1 rounded border border-slate-600 text-slate-400"
                                >
                                  Force reject
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">
                            {readOnly ? '—' : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-600 max-w-3xl">
          After you approve or reject, this row becomes read-only and the action buttons disappear. Amounts show
          receipt currency and the converted total in {company?.currencyCode} for your review.
        </p>
      </div>
    </div>
  );
}
