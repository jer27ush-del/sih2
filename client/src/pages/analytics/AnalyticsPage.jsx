import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import AppHeader from '../../components/AppHeader.jsx';
import StatCard from '../../components/StatCard.jsx';

const LINKS = [
  { to: '/officer', label: 'Queue' },
  { to: '/monitor', label: 'Monitor' },
  { to: '/analytics', label: 'Analytics' },
];

const RISK_TONE = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-amber-100 text-amber-900',
  HIGH: 'bg-red-100 text-red-800',
};

const dash = (v, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`);

function ReportTable({ title, rows, labelKey, labelHeader }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
      <h2 className="px-6 pt-5 font-semibold">{title}</h2>
      <table className="mt-3 min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-6 py-3 font-medium">{labelHeader}</th>
            <th className="px-6 py-3 font-medium">Total</th>
            <th className="px-6 py-3 font-medium">Open</th>
            <th className="px-6 py-3 font-medium">Resolved</th>
            <th className="px-6 py-3 font-medium">Overdue</th>
            <th className="px-6 py-3 font-medium">Disposal rate</th>
            <th className="px-6 py-3 font-medium">Avg. days to resolve</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((r) => (
            <tr key={r[labelKey]}>
              <td className="px-6 py-3 font-medium">{r[labelKey]}{r.name ? <span className="block text-xs font-normal text-slate-500">{r.name}</span> : null}</td>
              <td className="px-6 py-3">{r.total}</td>
              <td className="px-6 py-3">{r.open}</td>
              <td className="px-6 py-3">{r.resolved}</td>
              <td className="px-6 py-3">{r.overdue}</td>
              <td className="px-6 py-3">{dash(r.disposalRate, '%')}</td>
              <td className="px-6 py-3">{dash(r.avgResolutionDays)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="px-6 py-6 text-center text-slate-500">No data yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function AnalyticsPage() {
  const [report, setReport] = useState(null);
  const [volumeChange, setVolumeChange] = useState(0);
  const [capacity, setCapacity] = useState(15);
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/analytics/report').then(setReport).catch((err) => setError(err.message));
  }, []);

  // Re-run the what-if forecast shortly after the slider or capacity changes.
  useEffect(() => {
    const timer = setTimeout(() => {
      api(`/analytics/forecast?volumeChange=${volumeChange}&capacity=${capacity}`)
        .then(setForecast)
        .catch((err) => setError(err.message));
    }, 300);
    return () => clearTimeout(timer);
  }, [volumeChange, capacity]);

  const maxAgeing = report ? Math.max(1, ...report.ageing.map((b) => b.count)) : 1;

  return (
    <main className="min-h-screen">
      <AppHeader links={LINKS} />
      <section className="space-y-8 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="mt-1 text-slate-600">Performance reports and a what-if workload forecast.</p>
        </div>

        {error && <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {report && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Total cases" value={report.overall.total} />
              <StatCard label="Open" value={report.overall.open} tone="blue" />
              <StatCard label="Disposal rate" value={dash(report.overall.disposalRate, '%')} tone="emerald" />
              <StatCard label="Avg. days to resolve" value={dash(report.overall.avgResolutionDays)} tone="amber" />
            </div>

            <ReportTable title="Bureau-wise performance" rows={report.bureaus} labelKey="code" labelHeader="Cell" />
            <ReportTable title="Region-wise performance" rows={report.regions} labelKey="region" labelHeader="Region" />

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
                <h2 className="font-semibold">Ageing of open cases</h2>
                <ul className="mt-4 space-y-3 text-sm">
                  {report.ageing.map((b) => (
                    <li key={b.key}>
                      <div className="flex justify-between"><span>{b.label}</span><span className="font-medium">{b.count}</span></div>
                      <div className="mt-1 h-2 rounded bg-slate-100">
                        <div className="h-2 rounded bg-blue-600" style={{ width: `${(b.count / maxAgeing) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
                <h2 className="font-semibold">Monthly trend</h2>
                <table className="mt-4 w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr><th className="py-2 font-medium">Month</th><th className="py-2 font-medium">Received</th><th className="py-2 font-medium">Resolved</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {report.trend.map((m) => (
                      <tr key={m.month}><td className="py-2">{m.month}</td><td className="py-2">{m.received}</td><td className="py-2">{m.resolved}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
          <h2 className="font-semibold">What-if simulator</h2>
          <p className="mt-1 text-sm text-slate-600">
            Test how a change in complaint volume would affect each cell over the next four weeks.
          </p>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <label className="text-sm font-medium">
              Complaint volume change: {volumeChange > 0 ? '+' : ''}{volumeChange}%
              <input
                type="range"
                min={-50}
                max={200}
                step={5}
                value={volumeChange}
                onChange={(e) => setVolumeChange(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </label>
            <label className="text-sm font-medium">
              Open cases each cell can handle (capacity)
              <input
                type="number"
                min={1}
                max={500}
                value={capacity}
                onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))}
                className="mt-2 w-32 rounded-md border border-slate-300 px-3 py-1.5"
              />
            </label>
          </div>

          {forecast && (
            <>
              <p className="mt-6 text-sm text-slate-600">
                Baseline: {forecast.baselinePerWeek} complaints a week, projected {forecast.projectedPerWeek} a week
                with this change.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Cell</th>
                      <th className="px-4 py-3 font-medium">Open now</th>
                      <th className="px-4 py-3 font-medium">New expected</th>
                      <th className="px-4 py-3 font-medium">Resolved per week</th>
                      <th className="px-4 py-3 font-medium">Projected open</th>
                      <th className="px-4 py-3 font-medium">Load</th>
                      <th className="px-4 py-3 font-medium">Delay risk</th>
                      <th className="px-4 py-3 font-medium">Weeks to clear</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {forecast.cells.map((c) => (
                      <tr key={c.code}>
                        <td className="px-4 py-3 font-medium">{c.code}</td>
                        <td className="px-4 py-3">{c.currentOpen}</td>
                        <td className="px-4 py-3">{c.expectedNew}</td>
                        <td className="px-4 py-3">{c.resolvedPerWeek}</td>
                        <td className="px-4 py-3">{c.projectedOpen}</td>
                        <td className="px-4 py-3">{c.loadPercent}%</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${RISK_TONE[c.delayRisk]}`}>{c.delayRisk}</span>
                        </td>
                        <td className="px-4 py-3">{dash(c.weeksToClear)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Load is projected open cases divided by capacity. Medium risk starts above 80%, and high risk above 100%.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
