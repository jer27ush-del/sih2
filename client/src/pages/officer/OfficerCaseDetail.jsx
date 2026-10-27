import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import AppHeader from '../../components/AppHeader.jsx';
import { DnaBadge, PriorityBadge, StatusBadge } from '../../components/Badges.jsx';
import OverlapAlert from '../../components/OverlapAlert.jsx';
import SimilarCases from '../../components/SimilarCases.jsx';
import { formatDate, formatSize } from '../../format.js';

const LINKS = [
  { to: '/officer', label: 'Queue' },
  { to: '/monitor', label: 'Monitor' },
  { to: '/analytics', label: 'Analytics' },
];

const ACTION_LABELS = {
  SUBMITTED: 'Complaint submitted',
  ASSIGNED: 'Assigned to cell',
  TRANSFERRED: 'Transferred',
  INFO_REQUESTED: 'More information requested',
  ACKNOWLEDGED: 'Handoff acknowledged',
  NOTE: 'Note added',
  RESOLVED: 'Resolved',
};

const ACTION_META = {
  REQUEST_INFO: { label: 'Request more information', needsRemarks: true, tone: 'bg-amber-600 hover:bg-amber-700' },
  TRANSFER: { label: 'Transfer to another cell', needsRemarks: true, tone: 'bg-violet-700 hover:bg-violet-800' },
  ACKNOWLEDGE: { label: 'Acknowledge handoff', needsRemarks: false, tone: 'bg-blue-700 hover:bg-blue-800' },
  RESOLVE: { label: 'Mark resolved', needsRemarks: true, tone: 'bg-emerald-700 hover:bg-emerald-800' },
};

function ActionPanel({ caseId, allowed, cells, currentCode, onDone }) {
  const [active, setActive] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (allowed.length === 0) {
    return <p className="text-sm text-slate-500">No actions are available for your cell on this case right now.</p>;
  }

  const meta = active ? ACTION_META[active] : null;
  const canConfirm =
    Boolean(meta) &&
    !busy &&
    (!meta.needsRemarks || remarks.trim().length >= 10) &&
    (active !== 'TRANSFER' || Boolean(target));

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const data = await api(`/officer/complaints/${caseId}/actions`, {
        method: 'POST',
        body: { action: active, remarks, targetBureau: active === 'TRANSFER' ? target : undefined },
      });
      setActive(null);
      setRemarks('');
      setTarget('');
      onDone(data.complaint);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {allowed.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => {
              setActive(a);
              setError('');
            }}
            className={`rounded-md px-3 py-2 text-sm font-medium text-white ${ACTION_META[a].tone} ${active === a ? 'ring-2 ring-slate-400 ring-offset-1' : ''}`}
          >
            {ACTION_META[a].label}
          </button>
        ))}
      </div>

      {meta && (
        <div className="space-y-3 rounded-md bg-slate-50 p-4">
          {active === 'TRANSFER' && (
            <label className="block text-sm font-medium">
              Receiving cell
              <select
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Select cell</option>
                {cells.filter((c) => c.code !== currentCode).map((c) => (
                  <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                ))}
              </select>
            </label>
          )}

          {meta.needsRemarks ? (
            <label className="block text-sm font-medium">
              Remarks (at least 10 characters)
              <textarea
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </label>
          ) : (
            <p className="text-sm text-slate-600">Confirm to take ownership of this case.</p>
          )}

          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setActive(null)} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={submit}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OfficerCaseDetail() {
  const { caseId } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/officer/complaints/${caseId}`)
      .then((data) => setComplaint(data.complaint))
      .catch((err) => setError(err.message));
  }, [caseId]);

  return (
    <main className="min-h-screen">
      <AppHeader links={LINKS} />
      <section className="mx-auto max-w-5xl p-6">
        <Link to="/officer" className="text-sm text-blue-700 hover:underline">← Back to queue</Link>

        {error && <p role="alert" className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {complaint && (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h1 className="font-mono text-xl font-semibold">{complaint.caseId}</h1>
                  <div className="flex gap-2">
                    <PriorityBadge priority={complaint.priority} />
                    <StatusBadge status={complaint.status} />
                    <DnaBadge label={complaint.dnaLabel} />
                  </div>
                </div>
                <p className="mt-4 text-sm"><span className="text-slate-500">Category:</span> {complaint.category}</p>
                <p className="mt-4 whitespace-pre-wrap text-sm">{complaint.description}</p>
              </div>

              <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
                <h2 className="font-semibold">Similar complaints</h2>
                <div className="mt-4">
                  <SimilarCases
                    matches={complaint.related.map((r) => ({ caseId: r.caseId, label: r.relation, leadBureau: r.leadBureau }))}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
                <h2 className="font-semibold">Action history</h2>
                <ol className="mt-4 space-y-4 border-l-2 border-slate-200 pl-5 text-sm">
                  {complaint.actions.map((a) => (
                    <li key={a.id}>
                      <p className="font-medium">{ACTION_LABELS[a.type] ?? a.type}</p>
                      <p className="text-slate-500">{a.actorName} · {new Date(a.createdAt).toLocaleString('en-IN')}</p>
                      {a.remarks && <p className="mt-1 whitespace-pre-wrap">{a.remarks}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
                {complaint.access === 'HANDED_OFF' && (
                  <p className="mb-4 rounded-md bg-violet-50 px-3 py-2 text-sm text-violet-900">
                    Your cell handed this case off. You can follow it, but not act on it.
                  </p>
                )}
                <h2 className="font-semibold">Actions</h2>
                <div className="mt-4">
                  <ActionPanel
                    caseId={complaint.caseId}
                    allowed={complaint.allowed}
                    cells={complaint.cells}
                    currentCode={complaint.routing.lead?.code}
                    onDone={setComplaint}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
                <h2 className="font-semibold">Routing</h2>
                <dl className="mt-4 space-y-4 text-sm">
                  <div>
                    <dt className="text-slate-500">Lead cell</dt>
                    <dd className="font-medium">{complaint.routing.lead?.name ?? 'Not yet assigned'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Supporting cells</dt>
                    <dd className="mt-1 flex flex-wrap gap-2">
                      {complaint.routing.supporting.length === 0 ? (
                        <span>None</span>
                      ) : (
                        complaint.routing.supporting.map((s) => (
                          <span key={s.code} className="rounded bg-slate-100 px-2 py-0.5">{s.name}</span>
                        ))
                      )}
                    </dd>
                  </div>
                  {complaint.handoff && (
                    <div>
                      <dt className="text-slate-500">Handoff</dt>
                      <dd className="font-medium text-violet-800">Awaiting acknowledgement by {complaint.handoff.toCode}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-slate-500">Expected disposal</dt>
                    <dd className="font-medium">{formatDate(complaint.dueDate)}</dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <OverlapAlert show={complaint.routing.overlap} />
                </div>
              </div>

              <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
                <h2 className="font-semibold">Institution</h2>
                <p className="mt-3 text-sm font-medium">{complaint.institution?.name}</p>
                <p className="text-sm text-slate-600">{complaint.institution?.aicteId}</p>
                <p className="text-sm text-slate-600">Region: {complaint.institution?.region}</p>
                <p className="mt-2 text-sm text-slate-600">Received {formatDate(complaint.receivedAt)}</p>
              </div>

              <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
                <h2 className="font-semibold">Documents</h2>
                {complaint.attachments.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No documents attached.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-200 text-sm">
                    {complaint.attachments.map((a) => (
                      <li key={a.id} className="flex justify-between py-2">
                        <span>{a.fileName}</span>
                        <span className="text-slate-500">{formatSize(a.sizeBytes)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
