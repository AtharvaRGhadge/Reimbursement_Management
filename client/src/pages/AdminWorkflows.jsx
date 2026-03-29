import { useEffect, useState } from 'react';
import { api } from '../api.js';

const emptyStep = () => ({
  mode: 'single',
  useManager: false,
  approverUserId: '',
  approverUserIds: [],
  ruleType: 'all',
  percentage: 60,
  specificUserId: '',
  hybridPct: 60,
  hybridSpec: '',
});

export default function AdminWorkflows() {
  const [workflows, setWorkflows] = useState([]);
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState('');
  const [name, setName] = useState('Custom workflow');
  const [isManagerApproverFirst, setIsManagerApproverFirst] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [steps, setSteps] = useState([emptyStep()]);
  const [busy, setBusy] = useState(false);

  function load() {
    api('/workflows')
      .then(setWorkflows)
      .catch((e) => setErr(e.message));
    api('/users')
      .then(setUsers)
      .catch(() => {});
  }

  useEffect(() => {
    load();
  }, []);

  function setStep(i, patch) {
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, emptyStep()]);
  }

  function removeStep(i) {
    setSteps((prev) => prev.filter((_, j) => j !== i));
  }

  function buildRule(s) {
    if (s.mode === 'single') return { type: 'all' };
    if (s.ruleType === 'all') return { type: 'all' };
    if (s.ruleType === 'percentage') return { type: 'percentage', percentage: Number(s.percentage) || 60 };
    if (s.ruleType === 'specific_user')
      return { type: 'specific_user', specificUserId: s.specificUserId || undefined };
    if (s.ruleType === 'hybrid') {
      const parts = [];
      parts.push({ kind: 'percentage', percentage: Number(s.hybridPct) || 60 });
      if (s.hybridSpec) parts.push({ kind: 'specific_user', userId: s.hybridSpec });
      return {
        type: 'hybrid',
        hybridOperator: 'OR',
        hybridParts: parts,
      };
    }
    return { type: 'all' };
  }

  function buildStepsPayload() {
    return steps.map((s, order) => {
      if (s.mode === 'single') {
        return {
          order,
          mode: 'single',
          useManager: !!s.useManager,
          approverUserId: s.useManager ? undefined : s.approverUserId || undefined,
          rule: { type: 'all' },
        };
      }
      return {
        order,
        mode: 'group',
        useManager: false,
        approverUserIds: (s.approverUserIds || []).filter(Boolean),
        rule: buildRule(s),
      };
    });
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api('/workflows', {
        method: 'POST',
        body: JSON.stringify({
          name,
          isManagerApproverFirst,
          isDefault,
          steps: buildStepsPayload(),
        }),
      });
      setSteps([emptyStep()]);
      load();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeWf(id) {
    if (!confirm('Delete this workflow?')) return;
    setErr('');
    try {
      await api(`/workflows/${id}`, { method: 'DELETE' });
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold text-white">Approval rules</h1>
        <p className="text-slate-500 mt-1">
          Sequence steps (manager → finance → director) or group steps with % / named approver rules.
        </p>
      </div>
      {err && <p className="text-danger text-sm">{err}</p>}

      <form onSubmit={save} className="rounded-2xl border border-mist/80 bg-mist/15 p-6 space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-mono uppercase text-slate-500">Name</span>
            <input
              className="mt-1 w-full rounded-xl bg-void border border-mist px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              checked={isManagerApproverFirst}
              onChange={(e) => setIsManagerApproverFirst(e.target.checked)}
            />
            <span className="text-sm text-slate-300">Document: manager-first intent (flag)</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            <span className="text-sm text-slate-300">Set as default for new expenses</span>
          </label>
        </div>

        <div className="space-y-4">
          {steps.map((s, i) => (
            <div key={i} className="rounded-xl border border-mist/60 p-4 bg-void/40">
              <div className="flex justify-between items-center mb-3">
                <span className="font-mono text-xs text-accent">Step {i + 1}</span>
                {steps.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-slate-500 hover:text-danger"
                    onClick={() => removeStep(i)}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block sm:col-span-2">
                  <span className="text-xs text-slate-500">Mode</span>
                  <select
                    className="mt-1 w-full rounded-lg bg-void border border-mist px-2 py-2 text-sm"
                    value={s.mode}
                    onChange={(e) => setStep(i, { mode: e.target.value })}
                  >
                    <option value="single">Single approver (sequential)</option>
                    <option value="group">Group (conditional rule)</option>
                  </select>
                </label>
                {s.mode === 'single' && (
                  <>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={s.useManager}
                        onChange={(e) => setStep(i, { useManager: e.target.checked })}
                      />
                      <span className="text-sm">Use employee&apos;s manager</span>
                    </label>
                    {!s.useManager && (
                      <select
                        className="rounded-lg bg-void border border-mist px-2 py-2 text-sm"
                        value={s.approverUserId}
                        onChange={(e) => setStep(i, { approverUserId: e.target.value })}
                      >
                        <option value="">Pick user</option>
                        {users.map((u) => (
                          <option key={u._id || u.id} value={u._id || u.id}>
                            {u.name} ({u.role})
                          </option>
                        ))}
                      </select>
                    )}
                  </>
                )}
                {s.mode === 'group' && (
                  <>
                    <label className="block sm:col-span-2">
                      <span className="text-xs text-slate-500">Approvers (hold Ctrl to multi-select)</span>
                      <select
                        multiple
                        className="mt-1 w-full rounded-lg bg-void border border-mist px-2 py-2 text-sm min-h-[100px]"
                        value={s.approverUserIds}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                          setStep(i, { approverUserIds: selected });
                        }}
                      >
                        {users.map((u) => (
                          <option key={u._id || u.id} value={u._id || u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-500">Rule</span>
                      <select
                        className="mt-1 w-full rounded-lg bg-void border border-mist px-2 py-2 text-sm"
                        value={s.ruleType}
                        onChange={(e) => setStep(i, { ruleType: e.target.value })}
                      >
                        <option value="all">All must approve</option>
                        <option value="percentage">% threshold</option>
                        <option value="specific_user">Specific approver passes step</option>
                        <option value="hybrid">Hybrid: % OR specific user</option>
                      </select>
                    </label>
                    {s.ruleType === 'percentage' && (
                      <label className="block">
                        <span className="text-xs text-slate-500">Approve if ≥ %</span>
                        <input
                          type="number"
                          className="mt-1 w-full rounded-lg bg-void border border-mist px-2 py-2 text-sm"
                          value={s.percentage}
                          onChange={(e) => setStep(i, { percentage: e.target.value })}
                        />
                      </label>
                    )}
                    {s.ruleType === 'specific_user' && (
                      <select
                        className="rounded-lg bg-void border border-mist px-2 py-2 text-sm"
                        value={s.specificUserId}
                        onChange={(e) => setStep(i, { specificUserId: e.target.value })}
                      >
                        <option value="">CFO / named approver</option>
                        {users.map((u) => (
                          <option key={u._id || u.id} value={u._id || u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {s.ruleType === 'hybrid' && (
                      <div className="sm:col-span-2 grid sm:grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder="% part"
                          className="rounded-lg bg-void border border-mist px-2 py-2 text-sm"
                          value={s.hybridPct}
                          onChange={(e) => setStep(i, { hybridPct: e.target.value })}
                        />
                        <select
                          className="rounded-lg bg-void border border-mist px-2 py-2 text-sm"
                          value={s.hybridSpec}
                          onChange={(e) => setStep(i, { hybridSpec: e.target.value })}
                        >
                          <option value="">Specific user OR</option>
                          {users.map((u) => (
                            <option key={u._id || u.id} value={u._id || u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addStep}
          className="text-sm text-accent hover:underline"
        >
          + Add step
        </button>

        <div>
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2.5 rounded-xl bg-flare text-ink font-semibold text-sm disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save workflow'}
          </button>
        </div>
      </form>

      <div>
        <h2 className="text-lg font-medium text-white mb-3">Saved workflows</h2>
        <ul className="space-y-2">
          {workflows.map((w) => (
            <li
              key={w._id}
              className="flex items-center justify-between rounded-xl border border-mist/60 px-4 py-3 bg-mist/10"
            >
              <span>
                {w.name}{' '}
                {w.isDefault && (
                  <span className="ml-2 text-xs font-mono text-accent">default</span>
                )}
              </span>
              <button
                type="button"
                className="text-xs text-danger hover:underline"
                onClick={() => removeWf(w._id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
