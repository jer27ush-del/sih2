import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getToken } from '../../api.js';
import AppHeader from '../../components/AppHeader.jsx';
import StatCard from '../../components/StatCard.jsx';
import { DnaBadge, PriorityBadge, StatusBadge } from '../../components/Badges.jsx';
import { formatDate } from '../../format.js';

const LINKS = [
  { to: '/officer', label: 'Queue' },
  { to: '/monitor', label: 'Monitor' },
  { to: '/analytics', label: 'Analytics' },
];

const STATUSES = ['SUBMITTED', 'PENDING', 'IN_PROGRESS', 'TRANSFERRED', 'RESOLVED'];
const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];
const STATES = [
  ['OVERDUE', 'Overdue'],
  ['DUE_SOON', 'Due within 3 days'],
  ['HANDOFF_WAITING', 'Handoff waiting'],
  ['COORDINATION', 'Coordination required'],
];
const SLA_TEXT = { OVERDUE: 'Overdue', DUE_SOON: 'Due soon', ON_TRACK: 'On track', CLOSED: 'Closed' };
const SLA_TONE = { OVERDUE: 'text-red-700 font-medium', DUE_SOON: 'text-amber-800 font-medium', ON_TRACK: 'text-slate-600', CLOSED: 'text-slate-400' };
const SEVERITY_TONE = { high: 'bg-red-100 text-red-800', medium: 'bg-amber-100 text-amber-900', low: 'bg-slate-100 text-slate-700' };

const EMPTY_FILTERS = { q: '', cell: '', region: '', status: '', priority: '', state: '', from: '', to: '' };
const fieldClass = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';

export default function MonitorDashboard() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [results, setResults] = useState({ total: 0, cases: [] });
  const [error, setError] = useState('');

  function search(f) {
    const params = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    api(`/monitor/cases?${params}`).then(setResults).catch((err) => setError(err.message));
  }

  useEffect(() => {
    api('/monitor/summary').then(setData).catch((err) => setError(err.message));
    search(EMPTY_FILTERS);
  }, []);

  function applyFilters(e) {
    e.preventDefault();
    search(filters);
  }

  async function exportCsv(f) {
    const params = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    const token = getToken();
    const res = await fetch(`/api/monitor/cases.csv?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      setError('The export could not be created. Please try again.');
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'aicte-cases.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    search(EMPTY_FILTERS);
  }

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <main className="min-h-screen">
      <AppHeader links={LINKS} />
      <section className="space-y-8 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Monitoring</h1>
          <p className="mt-1 text-slate-600">All cells, all institutions.</p>
        </div>

        {error && <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Total" value={data.summary.total} />
              <StatCard label="Pending" value={data.summary.pending} tone="amber" />
              <StatCard label="In progress" value={data.summary.inProgress} tone="blue" />
              <StatCard label="Resolved" value={data.summary.resolved} tone="emerald" />
              <StatCard label="Overdue" value={data.summary.overdue} tone="red" />
              <StatCard label="Due within 3 days" value={data.summary.dueSoon} tone="amber" />
              <StatCard label="Handoffs waiting" value={data.summary.handoffsWaiting} tone="blue" />
              <StatCard label="Coordination needed" value={data.summary.coordination} tone="red" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
                <h2 className="font-semibold">Alerts</h2>
                {data.alerts.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No alerts.</p>
                ) : (
                  <ul className="mt-4 divide-y divide-slate-200 text-sm">
                    {data.alerts.slice(0, 20).map((a, i) => (
                      <li key={`${a.caseId}-${a.type}-${i}`} className="flex flex-wrap items-center gap-2 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_TONE[a.severity]}`}>
                          {a.severity === 'high' ? 'High' : 'Medium'}
                        </span>
                        <Link to={`/officer/complaints/${a.caseId}`} className="font-mono text-blue-700 hover:underline">
                          {a.caseId}
                        </Link>
                        <span className="text-slate-700">{a.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
                <h2 className="font-semibold">Workload by cell</h2>
                <table className="mt-4 w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="py-2 font-medium">Cell</th>
                      <th className="py-2 font-medium">Open</th>
                      <th className="py-2 font-medium">Overdue</th>
                      <th className="py-2 font-medium">Due soon</th>
                      <th className="py-2 font-medium">Awaiting ack.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.workload.map((w) => (
                      <tr key={w.code}>
                        <td className="py-2 font-medium">{w.code}</td>
                        <td className="py-2">{w.open}</td>
                        <td className="py-2">{w.overdue}</td>
                        <td className="py-2">{w.dueSoon}</td>
                        <td className="py-2">{w.waitingAck}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
          <h2 className="font-semibold">Search and filter</h2>
          <form onSubmit={applyFilters} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium lg:col-span-2">
              Institution name, ID, or case ID
              <input className={fieldClass} value={filters.q} onChange={set('q')} />
            </label>
            <label className="text-sm font-medium">
              Cell
              <select className={fieldClass} value={filters.cell} onChange={set('cell')}>
                <option value="">All cells</option>
                {data?.cells.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">
              Region
              <input className={fieldClass} value={filters.region} onChange={set('region')} placeholder="e.g. South" />
            </label>
            <label className="text-sm font-medium">
              Status
              <select className={fieldClass} value={filters.status} onChange={set('status')}>
                <option value="">Any status</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">
              Priority
              <select className={fieldClass} value={filters.priority} onChange={set('priority')}>
                <option value="">Any priority</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">
              Alert type
              <select className={fieldClass} value={filters.state} onChange={set('state')}>
                <option value="">Any</option>
                {STATES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">
              Received from
              <input type="date" className={fieldClass} value={filters.from} onChange={set('from')} />
            </label>
            <label className="text-sm font-medium">
              Received to
              <input type="date" className={fieldClass} value={filters.to} onChange={set('to')} />
            </label>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
              <button type="submit" className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
                Apply filters
              </button>
              <button type="button" onClick={() => exportCsv(filters)} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
                Export CSV
              </button>
              <button type="button" onClick={clearFilters} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
                Clear
              </button>
            </div>
          </form>
        </div>

        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
          <p className="px-4 pt-4 text-sm text-slate-600">
            {results.total} matching case{results.total === 1 ? '' : 's'}{results.total > results.cases.length ? ` (showing first ${results.cases.length})` : ''}
          </p>
          <table className="mt-3 min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Case ID</th>
                <th className="px-4 py-3 font-medium">Institution</th>
                <th className="px-4 py-3 font-medium">Cell</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Deadline</th>
                <th className="px-4 py-3 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {results.cases.map((c) => (
                <tr key={c.caseId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/officer/complaints/${c.caseId}`} className="font-mono font-medium text-blue-700 hover:underline">
                      {c.caseId}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {c.institution?.name}
                    <span className="block text-xs text-slate-500">{c.institution?.region}</span>
                  </td>
                  <td className="px-4 py-3">
                    {c.leadBureau?.code ?? '—'}
                    {c.handoffTo && <span className="block text-xs text-violet-800">→ awaiting {c.handoffTo}</span>}
                  </td>
                  <td className="px-4 py-3"><PriorityBadge priority={c.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3">
                    <span className={SLA_TONE[c.slaState]}>{SLA_TEXT[c.slaState]}</span>
                    <span className="block text-xs text-slate-500">{formatDate(c.dueDate)}</span>
                  </td>
                  <td className="px-4 py-3 space-x-1">
                    <DnaBadge label={c.dnaLabel} />
                    {c.overlap && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">Coordinate</span>}
                  </td>
                </tr>
              ))}
              {results.cases.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">No cases match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
