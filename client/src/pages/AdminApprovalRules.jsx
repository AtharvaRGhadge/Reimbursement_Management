import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

function defaultLines() {
  return [
    { userId: '', required: false, order: 0 },
    { userId: '', required: false, order: 1 },
    { userId: '', required: false, order: 2 },
  ];
}

export default function AdminApprovalRules() {
  const [users, setUsers] = useState([]);
  const [rules, setRules] = useState([]);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);

  const [employeeId, setEmployeeId] = useState('');
  const [description, setDescription] = useState('');
  const [ruleManagerId, setRuleManagerId] = useState('');
  const [isManagerApprover, setIsManagerApprover] = useState(true);
  const [lines, setLines] = useState(defaultLines);
  const [approversSequential, setApproversSequential] = useState(true);
  const [minApprovalPercentage, setMinApprovalPercentage] = useState(60);

  const employees = useMemo(() => users.filter((u) => u.role === 'employee'), [users]);
  const managers = useMemo(() => users.filter((u) => u.role === 'manager'), [users]);
  const approverPool = useMemo(() => {
    if (!employeeId) return users.filter((u) => u.role === 'manager' || u.role === 'admin');
    return users.filter((u) => (u._id || u.id) !== employeeId);
  }, [users, employeeId]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => (e._id || e.id) === employeeId),
    [employees, employeeId]
  );

  function load() {
    api('/users').then(setUsers).catch((e) => setErr(e.message));
    api('/employee-rules')
      .then(setRules)
      .catch((e) => setErr(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    const emp = employees.find((e) => (e._id || e.id) === employeeId);
    const existing = rules.find(
      (r) => String(r.employeeId?._id || r.employeeId) === String(employeeId)
    );
    if (existing) {
      setDescription(existing.description || '');
      setRuleManagerId(existing.ruleManagerId?._id || existing.ruleManagerId || '');
      setIsManagerApprover(!!existing.isManagerApprover);
      setApproversSequential(!!existing.approversSequential);
      setMinApprovalPercentage(existing.minApprovalPercentage ?? 60);
      if (existing.approvers?.length) {
        setLines(
          existing.approvers.map((a, i) => ({
            userId: a.userId?._id || a.userId,
            required: !!a.required,
            order: a.order ?? i,
          }))
        );
      } else {
        setLines(defaultLines());
      }
    } else {
      setDescription('');
      setRuleManagerId(emp?.managerId || '');
      setIsManagerApprover(true);
      setLines(defaultLines());
      setApproversSequential(true);
      setMinApprovalPercentage(60);
    }
  }, [employeeId, employees, rules]);

  function setLine(i, patch) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { userId: '', required: false, order: prev.length }]);
  }

  async function saveRule(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setToast('');
    try {
      const approvers = lines
        .filter((l) => l.userId)
        .map((l, i) => ({
          userId: l.userId,
          required: !!l.required,
          order: i,
        }));
      await api('/employee-rules', {
        method: 'POST',
        body: JSON.stringify({
          employeeId,
          description,
          ruleManagerId: ruleManagerId || null,
          isManagerApprover,
          approvers,
          approversSequential,
          minApprovalPercentage: Number(minApprovalPercentage) || 60,
        }),
      });
      setToast('Approval rule saved and synced to this employee’s workflow.');
      load();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-6xl space-y-10">
      <header className="border-b border-white/15 pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-slate-500">Admin view</p>
        <h1 className="mt-2 text-3xl font-semibold text-white tracking-tight">Approval rules</h1>
        <p className="mt-1 text-sm text-slate-500 max-w-2xl">
          Define who approves each employee’s expenses: manager gate, ordered approvers, or parallel voting
          with a minimum percentage.
        </p>
      </header>

      {err && <p className="text-sm text-rose-400">{err}</p>}
      {toast && (
        <p className="text-sm text-accent border border-accent/30 rounded-lg px-4 py-3 bg-accent/5">{toast}</p>
      )}

      <form
        onSubmit={saveRule}
        className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-start"
      >
        <div className="space-y-6 rounded-xl border border-white/15 bg-black/25 p-6">
          <p className="font-mono text-xs uppercase text-slate-500">Rule scope</p>
          <label className="block">
            <span className="text-xs text-slate-400">User</span>
            <select
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="mt-1 w-full bg-transparent border-b border-white/25 text-white py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">Select employee…</option>
              {employees.map((u) => (
                <option key={u._id || u.id} value={u._id || u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Description about rule</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Approval rule for miscellaneous expenses"
              className="mt-1 w-full bg-transparent border-b border-white/25 text-white placeholder:text-slate-600 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Manager (dynamic default)</span>
            <select
              value={ruleManagerId}
              onChange={(e) => setRuleManagerId(e.target.value)}
              className="mt-1 w-full bg-transparent border-b border-white/25 text-white py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">— use employee’s assigned manager —</option>
              {managers.map((m) => (
                <option key={m._id || m.id} value={m._id || m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-600">
              Defaults to {selectedEmployee?.managerId ? 'their current manager' : 'none'}; override here for
              this rule only.
            </p>
          </label>
        </div>

        <div className="space-y-6 rounded-xl border border-white/15 bg-black/25 p-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isManagerApprover}
              onChange={(e) => setIsManagerApprover(e.target.checked)}
              className="mt-1 rounded border-white/30"
            />
            <span>
              <span className="text-white text-sm">Is manager an approver?</span>
              <span className="block text-xs text-slate-500 mt-1">
                If checked, the request is routed to the manager first (before the list below).
              </span>
            </span>
          </label>

          <div>
            <p className="text-xs font-mono uppercase text-slate-500 mb-3">Approvers</p>
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-white/10">
                    <th className="px-3 py-2 font-normal">#</th>
                    <th className="px-3 py-2 font-normal">Approver</th>
                    <th className="px-3 py-2 font-normal w-28">Required</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                      <td className="px-3 py-2">
                        <select
                          value={line.userId}
                          onChange={(e) => setLine(i, { userId: e.target.value })}
                          className="w-full bg-transparent border-b border-white/20 text-white py-1 text-sm"
                        >
                          <option value="">—</option>
                          {approverPool.map((u) => (
                            <option key={u._id || u.id} value={u._id || u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={line.required}
                          onChange={(e) => setLine(i, { required: e.target.checked })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={addLine}
              className="mt-3 text-xs text-accent underline underline-offset-4"
            >
              + Add approver
            </button>
            <p className="mt-3 text-xs text-slate-600">
              Required: that approver’s approval is mandatory (parallel mode enforces this before applying %).
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={approversSequential}
              onChange={(e) => setApproversSequential(e.target.checked)}
              className="mt-1 rounded border-white/30"
            />
            <span>
              <span className="text-white text-sm">Approvers sequence</span>
              <span className="block text-xs text-slate-500 mt-1">
                On: sequential (one after another). Off: parallel — everyone receives the request together;
                use minimum % for non-required approvers.
              </span>
            </span>
          </label>

          {!approversSequential && (
            <label className="block">
              <span className="text-xs text-slate-400">Minimum approval percentage</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={minApprovalPercentage}
                  onChange={(e) => setMinApprovalPercentage(e.target.value)}
                  className="w-24 bg-transparent border-b border-white/25 text-white py-2 text-sm outline-none"
                />
                <span className="text-slate-400">%</span>
              </div>
            </label>
          )}

          <button
            type="submit"
            disabled={busy || !employeeId}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-white text-black text-sm font-semibold hover:bg-slate-200 disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Save rule'}
          </button>
        </div>
      </form>
    </div>
  );
}
