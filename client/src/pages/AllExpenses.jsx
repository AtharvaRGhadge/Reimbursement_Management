import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AllExpenses() {
  const { company } = useAuth();
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/expenses/all')
      .then(setRows)
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white">All expenses</h1>
        <p className="text-slate-500 mt-1">Company-wide ledger (admin view).</p>
      </div>
      {err && <p className="text-danger text-sm">{err}</p>}
      <div className="rounded-2xl border border-mist/80 overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-void/80 text-left text-xs font-mono uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">{company?.currencyCode}</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e._id} className="border-t border-mist/60 hover:bg-mist/10">
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-white">{e.employeeId?.name}</td>
                <td className="px-4 py-3">{e.category}</td>
                <td className="px-4 py-3 text-right font-mono text-accent">
                  {company?.currencySymbol}
                  {e.amountCompany?.toFixed(2)}
                </td>
                <td className="px-4 py-3 capitalize text-slate-300">{e.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
