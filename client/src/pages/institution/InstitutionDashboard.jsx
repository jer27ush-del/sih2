import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import AppHeader from '../../components/AppHeader.jsx';
import StatCard from '../../components/StatCard.jsx';
import { PriorityBadge, StatusBadge } from '../../components/Badges.jsx';
import { formatDate } from '../../format.js';
import { useAuth } from '../../auth/AuthContext.jsx';

const LINKS = [
  { to: '/institution', label: 'Dashboard' },
  { to: '/institution/submit', label: 'Submit Complaint' },
];

export default function InstitutionDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/complaints/summary'), api('/complaints')])
      .then(([s, list]) => {
        setSummary(s);
        setComplaints(list.complaints);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="min-h-screen">
      <AppHeader links={LINKS} />
      <section className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">My Complaints</h1>
            <p className="mt-1 text-slate-600">{user.institution?.name} ({user.institution?.aicteId})</p>
          </div>
          <Link to="/institution/submit" className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
            Submit complaint
          </Link>
        </div>

        {error && <p role="alert" className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {summary && (
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Total" value={summary.total} />
            <StatCard label="Pending" value={summary.pending} tone="amber" />
            <StatCard label="In progress" value={summary.inProgress} tone="blue" />
            <StatCard label="Resolved" value={summary.resolved} tone="emerald" />
            <StatCard label="Overdue" value={summary.overdue} tone="red" />
          </div>
        )}

        <div className="mt-8 overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Case ID</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Lead cell</th>
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3 font-medium">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {complaints.map((c) => (
                <tr key={c.caseId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/institution/complaints/${c.caseId}`} className="font-medium text-blue-700 hover:underline">
                      {c.caseId}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{c.category}</td>
                  <td className="px-4 py-3"><PriorityBadge priority={c.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3">{c.leadBureau?.code ?? '—'}</td>
                  <td className="px-4 py-3">{formatDate(c.receivedAt)}</td>
                  <td className="px-4 py-3">{formatDate(c.dueDate)}</td>
                </tr>
              ))}
              {complaints.length === 0 && !error && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No complaints yet. Use "Submit complaint" to raise one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
