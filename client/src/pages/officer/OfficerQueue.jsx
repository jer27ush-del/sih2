import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import AppHeader from '../../components/AppHeader.jsx';
import StatCard from '../../components/StatCard.jsx';
import { StatusBadge } from '../../components/Badges.jsx';
import { formatDate } from '../../format.js';
import { useAuth } from '../../auth/AuthContext.jsx';

const LINKS = [
  { to: '/officer', label: 'Queue' },
  { to: '/monitor', label: 'Monitor' },
  { to: '/analytics', label: 'Analytics' },
];

const COLUMNS = [
  { key: 'HIGH', title: 'High priority', border: 'border-red-300' },
  { key: 'MEDIUM', title: 'Medium priority', border: 'border-amber-300' },
  { key: 'LOW', title: 'Low priority', border: 'border-green-300' },
];

function CaseCard({ item }) {
  const overdue = new Date(item.dueDate) < new Date();
  return (
    <li className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-2">
        <Link to={`/officer/complaints/${item.caseId}`} className="font-mono text-sm font-medium text-blue-700 hover:underline">
          {item.caseId}
        </Link>
        <StatusBadge status={item.status} />
      </div>
      <p className="mt-1 text-sm">
        {item.category} · {item.institution?.name ?? 'Unknown institution'}
      </p>
      <div className="mt-2 flex flex-wrap gap-1 text-xs">
        <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-800">Lead: {item.routing.lead?.code ?? 'Unassigned'}</span>
        {item.routing.supporting.map((s) => (
          <span key={s.code} className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">Support: {s.code}</span>
        ))}
        {item.routing.overlap && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">Coordination required</span>
        )}
      </div>
      <p className={`mt-2 text-xs ${overdue ? 'font-medium text-red-700' : 'text-slate-500'}`}>
        Due {formatDate(item.dueDate)}{overdue ? ' · overdue' : ''}
      </p>
    </li>
  );
}

export default function OfficerQueue() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/officer/queue').then(setData).catch((err) => setError(err.message));
  }, []);

  const scope = user.bureau ? `${user.bureau.name} (${user.bureau.code})` : 'All cells';
  const allItems = data ? Object.values(data.queues).flat() : [];
  const overdueCount = allItems.filter((i) => new Date(i.dueDate) < new Date()).length;
  const coordinationCount = allItems.filter((i) => i.routing.overlap).length;

  return (
    <main className="min-h-screen">
      <AppHeader links={LINKS} />
      <section className="p-6">
        <h1 className="text-2xl font-semibold">Case Queue</h1>
        <p className="mt-1 text-slate-600">Scope: {scope}</p>

        {error && <p role="alert" className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {data && (
          <>
            {data.attention.length > 0 && (
              <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
                <h2 className="font-semibold text-amber-900">Needs your attention ({data.attention.length})</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {data.attention.map((item) => (
                    <li key={item.caseId} className="flex flex-wrap items-center gap-2">
                      <Link to={`/officer/complaints/${item.caseId}`} className="font-mono text-blue-700 hover:underline">
                        {item.caseId}
                      </Link>
                      {item.attention.includes('HANDOFF_AWAITING_ACK') && (
                        <span className="rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-900">Handoff waiting for your acknowledgement</span>
                      )}
                      {item.attention.includes('OVERDUE') && (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">Overdue</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Open cases" value={data.total} />
              <StatCard label="High priority" value={data.queues.HIGH.length} tone="red" />
              <StatCard label="Overdue" value={overdueCount} tone="amber" />
              <StatCard label="Need coordination" value={coordinationCount} tone="blue" />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              {COLUMNS.map((col) => (
                <div key={col.key} className={`rounded-xl border-t-4 bg-slate-100 p-4 ${col.border}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold">{col.title}</h2>
                    <span className="text-sm text-slate-600">{data.queues[col.key].length}</span>
                  </div>
                  {data.queues[col.key].length === 0 ? (
                    <p className="text-sm text-slate-500">No open cases.</p>
                  ) : (
                    <ul className="space-y-3">
                      {data.queues[col.key].map((item) => <CaseCard key={item.caseId} item={item} />)}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {data.handedOff.length > 0 && (
              <div className="mt-10">
                <h2 className="font-semibold">Handed off · view only</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Cases your cell transferred. You can follow them but not act on them.
                </p>
                <ul className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {data.handedOff.map((item) => <CaseCard key={item.caseId} item={item} />)}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
