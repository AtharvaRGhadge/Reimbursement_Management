import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Tesseract from 'tesseract.js';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const inputClass =
  'w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-accent/60 outline-none';

const CATEGORIES = ['General', 'Meals', 'Transport', 'Lodging', 'Travel', 'Software', 'Office'];
const PAID_BY = [
  { value: 'employee', label: 'Employee' },
  { value: 'company_card', label: 'Company card' },
  { value: 'company', label: 'Company paid' },
];

function sumByStatus(rows, status) {
  return rows.filter((e) => e.status === status).reduce((s, e) => s + (Number(e.amountCompany) || 0), 0);
}

export default function MyExpenses() {
  const { company, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [workflowId, setWorkflowId] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);

  const [form, setForm] = useState({
    description: '',
    detailNotes: '',
    remarks: '',
    category: 'General',
    paidBy: 'employee',
    expenseDate: new Date().toISOString().slice(0, 10),
    amountOriginal: '',
    currencyOriginal: 'USD',
    receiptImage: '',
    ocrPayload: null,
  });

  const loadList = useCallback(() => {
    return api('/expenses/mine').then(setRows);
  }, []);

  const loadWorkflows = useCallback(async () => {
    const [w, mine] = await Promise.all([
      api('/workflows/available'),
      api('/employee-rules/for-me').catch(() => ({ workflowId: null })),
    ]);
    setWorkflows(w);
    if (mine?.workflowId) setWorkflowId(mine.workflowId);
    else {
      const def = w.find((x) => x.isDefault);
      setWorkflowId(def?._id || w[0]?._id || '');
    }
  }, []);

  useEffect(() => {
    loadList().catch((e) => setErr(e.message));
    loadWorkflows().catch(() => {});
  }, [loadList, loadWorkflows]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openNew();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const draftSum = useMemo(() => sumByStatus(rows, 'draft'), [rows]);
  const pendingSum = useMemo(() => sumByStatus(rows, 'pending'), [rows]);
  const approvedSum = useMemo(() => sumByStatus(rows, 'approved'), [rows]);

  function resetForm() {
    setForm({
      description: '',
      detailNotes: '',
      remarks: '',
      category: 'General',
      paidBy: 'employee',
      expenseDate: new Date().toISOString().slice(0, 10),
      amountOriginal: '',
      currencyOriginal: company?.currencyCode || 'USD',
      receiptImage: '',
      ocrPayload: null,
    });
  }

  function openNew() {
    setSelectedId('new');
    setDetail(null);
    resetForm();
    if (company?.currencyCode) {
      setForm((f) => ({ ...f, currencyOriginal: company.currencyCode }));
    }
  }

  const loadDetail = useCallback(async (id) => {
    if (!id || id === 'new') return;
    const d = await api(`/expenses/${id}`);
    setDetail(d);
    setForm({
      description: d.description || '',
      detailNotes: d.detailNotes || '',
      remarks: d.remarks || '',
      category: d.category || 'General',
      paidBy: d.paidBy || 'employee',
      expenseDate: d.expenseDate ? new Date(d.expenseDate).toISOString().slice(0, 10) : '',
      amountOriginal: String(d.amountOriginal ?? ''),
      currencyOriginal: d.currencyOriginal || 'USD',
      receiptImage: d.receiptImage || '',
      ocrPayload: d.ocrPayload || null,
    });
    const wid = d.workflowId?._id || d.workflowId;
    if (wid) setWorkflowId(wid);
  }, []);

  useEffect(() => {
    if (selectedId && selectedId !== 'new') {
      loadDetail(selectedId).catch((e) => setErr(e.message));
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  function buildBody() {
    return {
      workflowId,
      amountOriginal: Number(form.amountOriginal) || 0,
      currencyOriginal: form.currencyOriginal || 'USD',
      category: form.category || 'General',
      description: form.description,
      detailNotes: form.detailNotes,
      remarks: form.remarks,
      paidBy: form.paidBy,
      expenseDate: form.expenseDate,
      receiptImage: form.receiptImage || undefined,
      ocrPayload: form.ocrPayload || undefined,
    };
  }

  async function saveDraft() {
    setErr('');
    setBusy(true);
    try {
      const body = buildBody();
      if (selectedId === 'new') {
        const exp = await api('/expenses', { method: 'POST', body: JSON.stringify(body) });
        setSelectedId(exp._id);
        await loadList();
        await loadDetail(exp._id);
      } else if (selectedId) {
        await api(`/expenses/${selectedId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        await loadList();
        await loadDetail(selectedId);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitExpense() {
    setErr('');
    setBusy(true);
    try {
      let id = selectedId;
      const body = buildBody();
      if (id === 'new') {
        const exp = await api('/expenses', { method: 'POST', body: JSON.stringify(body) });
        id = exp._id;
        setSelectedId(id);
      } else if (id) {
        await api(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      }
      if (!id) return;
      await api(`/expenses/${id}/submit`, { method: 'PATCH', body: '{}' });
      await loadList();
      await loadDetail(id);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function runOcrFile(file) {
    if (!file) return;
    setOcrBusy(true);
    setErr('');
    setSelectedId('new');
    setDetail(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      setForm((f) => ({ ...f, receiptImage: dataUrl }));
      try {
        const {
          data: { text },
        } = await Tesseract.recognize(file, 'eng', { logger: () => {} });
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        const joined = lines.join(' ');
        const amountMatch = joined.match(/(\d+[\.,]\d{2})\b/);
        const dateMatch = joined.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        let expenseDate = form.expenseDate;
        if (dateMatch) {
          const y = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
          expenseDate = `${y}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`;
        }
        const lower = joined.toLowerCase();
        let category = form.category;
        if (/meal|restaurant|dining|coffee/.test(lower)) category = 'Meals';
        else if (/uber|taxi|transit/.test(lower)) category = 'Transport';
        else if (/hotel/.test(lower)) category = 'Lodging';
        else if (/flight/.test(lower)) category = 'Travel';
        setForm((f) => ({
          ...f,
          amountOriginal: amountMatch ? amountMatch[1].replace(',', '.') : f.amountOriginal,
          expenseDate,
          category,
          description: f.description || lines.slice(0, 3).join(' · '),
          ocrPayload: { rawText: text.slice(0, 4000) },
        }));
      } catch {
        setErr('OCR could not read this image — fill fields manually.');
      } finally {
        setOcrBusy(false);
      }
    };
    reader.readAsDataURL(file);
  }

  const isDraft = detail?.status === 'draft' || selectedId === 'new';
  const status = detail?.status || (selectedId === 'new' ? 'draft' : null);

  const stepIndex =
    status === 'draft' ? 0 : status === 'pending' ? 1 : status === 'approved' || status === 'rejected' ? 2 : 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-slate-500">Employee&apos;s view</p>
        <h1 className="text-2xl font-semibold text-white mt-1">Reimbursements</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload a receipt for OCR, or start new. Amounts convert to {company?.currencyCode} for approvers.
        </p>
      </div>

      {err && <p className="text-sm text-rose-400">{err}</p>}

      <div className="flex flex-wrap gap-3">
        <label className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-sm text-white cursor-pointer hover:border-accent/50">
          {ocrBusy ? 'Scanning…' : 'Upload'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={ocrBusy}
            onChange={(e) => runOcrFile(e.target.files?.[0])}
          />
        </label>
        <button
          type="button"
          onClick={openNew}
          className="px-4 py-2 rounded-lg border border-accent/40 bg-accent/10 text-sm text-accent hover:bg-accent/20"
        >
          New
        </button>
      </div>

      <div className="flex flex-wrap items-stretch justify-center gap-3 sm:gap-4">
        <SummaryCard label="To submit" sub="Draft" amount={draftSum} symbol={company?.currencySymbol} />
        <div className="hidden sm:flex items-center text-slate-600">→</div>
        <SummaryCard label="Waiting approval" sub="In review" amount={pendingSum} symbol={company?.currencySymbol} />
        <div className="hidden sm:flex items-center text-slate-600">→</div>
        <SummaryCard label="Approved" sub="Settled" amount={approvedSum} symbol={company?.currencySymbol} />
      </div>

      <div className="grid lg:grid-cols-[1fr_min(440px,100%)] gap-8 items-start">
        <div className="rounded-xl border border-white/10 overflow-hidden bg-black/20">
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm min-w-[900px]">
              <thead>
                <tr className="text-left text-[10px] sm:text-xs font-mono uppercase tracking-wider text-slate-500 border-b border-white/10">
                  <th className="px-3 py-2.5">Employee</th>
                  <th className="px-3 py-2.5">Description</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5">Paid by</th>
                  <th className="px-3 py-2.5">Remarks</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr
                    key={e._id}
                    onClick={() => setSelectedId(e._id)}
                    className={`border-b border-white/5 cursor-pointer hover:bg-white/[0.04] ${
                      selectedId === e._id ? 'bg-accent/5' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-slate-300">{user?.name}</td>
                    <td className="px-3 py-2 text-white max-w-[140px] truncate">{e.description || '—'}</td>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                      {e.expenseDate ? new Date(e.expenseDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{e.category}</td>
                    <td className="px-3 py-2 text-slate-500">{paidByLabel(e.paidBy)}</td>
                    <td className="px-3 py-2 text-slate-500 max-w-[100px] truncate">{e.remarks || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-accent whitespace-nowrap">
                      {e.amountOriginal} {e.currencyOriginal}
                      <span className="block text-[10px] text-slate-500">
                        ≈ {company?.currencySymbol}
                        {Number(e.amountCompany).toFixed(2)} {company?.currencyCode}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={e.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <p className="p-8 text-center text-slate-500 text-sm">No expenses yet — use Upload or New.</p>
          )}
        </div>

        <aside className="rounded-xl border border-white/15 bg-gradient-to-b from-black/50 to-black/30 p-5 lg:sticky lg:top-6 space-y-5">
          {!selectedId ? (
            <p className="text-sm text-slate-500">Select a row or create New / Upload to edit here.</p>
          ) : (
            <>
              <Stepper step={stepIndex} status={status} />

              <div>
                <label className="block">
                  <span className="text-xs text-slate-500">Attach receipt</span>
                  <label className="mt-1 flex items-center justify-center px-3 py-2 rounded-lg border border-dashed border-white/20 text-xs text-slate-400 cursor-pointer hover:border-accent/40">
                    {form.receiptImage ? 'Change image' : 'Choose file'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={!isDraft}
                      onChange={(e) => runOcrFile(e.target.files?.[0])}
                    />
                  </label>
                </label>
                {form.receiptImage && (
                  <img
                    src={form.receiptImage}
                    alt=""
                    className="mt-2 rounded-lg max-h-36 object-contain border border-white/10"
                  />
                )}
              </div>

              <Field label="Description">
                <input
                  className={inputClass}
                  value={form.description}
                  readOnly={!isDraft}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </Field>
              <Field label="Expense date">
                <input
                  type="date"
                  className={inputClass}
                  value={form.expenseDate}
                  readOnly={!isDraft}
                  onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                />
              </Field>
              <Field label="Category">
                <select
                  className={inputClass}
                  disabled={!isDraft}
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Paid by">
                <select
                  className={inputClass}
                  disabled={!isDraft}
                  value={form.paidBy}
                  onChange={(e) => setForm((f) => ({ ...f, paidBy: e.target.value }))}
                >
                  {PAID_BY.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Total amount">
                  <input
                    className={`${inputClass} font-mono`}
                    readOnly={!isDraft}
                    value={form.amountOriginal}
                    onChange={(e) => setForm((f) => ({ ...f, amountOriginal: e.target.value }))}
                    inputMode="decimal"
                  />
                </Field>
                <Field label="Currency">
                  <input
                    className={`${inputClass} font-mono uppercase`}
                    readOnly={!isDraft}
                    value={form.currencyOriginal}
                    onChange={(e) => setForm((f) => ({ ...f, currencyOriginal: e.target.value.toUpperCase() }))}
                    maxLength={4}
                  />
                </Field>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Receipt currency is preserved; your company ledger uses{' '}
                <span className="text-accent font-mono">{company?.currencyCode}</span> for approval (converted on
                save).
              </p>
              <Field label="Remarks">
                <input
                  className={inputClass}
                  readOnly={!isDraft}
                  value={form.remarks}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                />
              </Field>
              <Field label="Additional notes">
                <textarea
                  className={`${inputClass} min-h-[72px]`}
                  readOnly={!isDraft}
                  value={form.detailNotes}
                  onChange={(e) => setForm((f) => ({ ...f, detailNotes: e.target.value }))}
                />
              </Field>

              {isDraft && (
                <Field label="Workflow">
                  <select
                    className={inputClass}
                    value={workflowId}
                    onChange={(e) => setWorkflowId(e.target.value)}
                  >
                    {workflows.map((w) => (
                      <option key={w._id} value={w._id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {isDraft && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    disabled={busy || !workflowId}
                    onClick={() => saveDraft()}
                    className="flex-1 min-w-[120px] py-2 rounded-lg border border-white/20 text-sm text-white hover:bg-white/5"
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    disabled={busy || !workflowId}
                    onClick={submitExpense}
                    className="flex-1 min-w-[120px] py-2 rounded-lg bg-accent text-black text-sm font-semibold hover:brightness-110 disabled:opacity-40"
                  >
                    Submit
                  </button>
                </div>
              )}

              {!isDraft && detail?.history?.length > 0 && (
                <div>
                  <p className="text-xs font-mono uppercase text-slate-500 mb-2">Approval log</p>
                  <div className="rounded-lg border border-white/10 overflow-hidden text-xs">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-white/10">
                          <th className="px-2 py-1.5">Approver</th>
                          <th className="px-2 py-1.5">Status</th>
                          <th className="px-2 py-1.5">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.history.map((h, i) => (
                          <tr key={i} className="border-b border-white/5">
                            <td className="px-2 py-1.5 text-slate-300">{h.approverName}</td>
                            <td className="px-2 py-1.5 text-white">{h.statusLabel}</td>
                            <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                              {h.at ? new Date(h.at).toLocaleString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function SummaryCard({ label, sub, amount, symbol }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-4">
      <p className="text-[10px] font-mono uppercase text-slate-500">{label}</p>
      <p className="text-lg font-mono text-white mt-1">
        {symbol}
        {amount.toFixed(2)}
      </p>
      <p className="text-xs text-slate-600 mt-0.5">{sub}</p>
    </div>
  );
}

function Stepper({ step, status }) {
  const labels = ['Draft', 'Waiting approval', 'Done'];
  const done = status === 'approved' || status === 'rejected';
  const idx = done ? 2 : step;
  return (
    <div className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-500">
      {labels.map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 && <span className="text-slate-600">›</span>}
          <span
            className={
              i <= idx ? 'text-accent font-medium' : i === idx ? 'text-white' : ''
            }
          >
            {l}
          </span>
        </span>
      ))}
      {status === 'rejected' && <span className="ml-2 text-rose-400">(Rejected)</span>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function StatusBadge({ status }) {
  const map = {
    draft: 'bg-slate-700/50 text-slate-300 border border-slate-600/50',
    pending: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
    approved: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
    rejected: 'bg-rose-500/10 text-rose-300 border border-rose-500/30',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] capitalize ${map[status] || ''}`}>
      {status}
    </span>
  );
}

function paidByLabel(v) {
  const p = PAID_BY.find((x) => x.value === v);
  return p ? p.label : v || '—';
}
