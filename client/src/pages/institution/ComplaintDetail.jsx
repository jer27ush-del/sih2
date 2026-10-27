import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import AppHeader from '../../components/AppHeader.jsx';
import { DnaBadge, PriorityBadge, StatusBadge } from '../../components/Badges.jsx';
import OverlapAlert from '../../components/OverlapAlert.jsx';
import SimilarCases from '../../components/SimilarCases.jsx';
import { formatDate, formatSize } from '../../format.js';

const LINKS = [
  { to: '/institution', label: 'Dashboard' },
  { to: '/institution/submit', label: 'Submit Complaint' },
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

function ResponseForm({ caseId, onDone }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api(`/complaints/${caseId}/response`, { method: 'POST', body: { message } });
      setMessage('');
      onDone(data.complaint);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-medium">
        Your response (at least 10 characters)
        <textarea
          rows={4}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy || message.trim().length < 10}
        className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {busy ? 'Sending…' : 'Send response'}
      </button>
    </form>
  );
}

export default function ComplaintDetail() {
  const { caseId } = useParams();
  const location = useLocation();
  const [complaint, setComplaint] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/complaints/${caseId}`)
      .then((data) => setComplaint(data.complaint))
      .catch((err) => setError(err.message));
  }, [caseId]);

  return (
    <main className="min-h-screen">
      <AppHeader links={LINKS} />
      <section className="mx-auto max-w-4xl p-6">
        <Link to="/institution" className="text-sm text-blue-700 hover:underline">← Back to dashboard</Link>

        {location.state?.submitted && (
          <div className="mt-4 rounded-xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
            <p className="font-semibold text-emerald-800">Complaint Submitted Successfully!</p>
            <p className="mt-1 text-sm text-emerald-900">
              Your complaint is registered. Complaint ID: <span className="font-mono font-semibold">{caseId}</span>
            </p>
          </div>
        )}

        {error && <p role="alert" className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {complaint && (
          <div className="mt-6 space-y-6">
            {complaint.status === 'PENDING' && (
              <div className="rounded-xl bg-amber-50 p-6 ring-1 ring-amber-200">
                <h2 className="font-semibold text-amber-900">More information requested</h2>
                <p className="mt-1 text-sm text-amber-900">
                  An AICTE cell needs more information. See the latest note in the action history, then reply below.
                </p>
                <div className="mt-4">
                  <ResponseForm caseId={complaint.caseId} onDone={setComplaint} />
                </div>
              </div>
            )}

            <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-mono text-xl font-semibold">{complaint.caseId}</h1>
                <div className="flex gap-2">
                  <PriorityBadge priority={complaint.priority} />
                  <StatusBadge status={complaint.status} />
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-slate-500">Category</dt><dd className="font-medium">{complaint.category}</dd></div>
                <div><dt className="text-slate-500">Assigned cell</dt><dd className="font-medium">{complaint.leadBureau?.name ?? 'Not yet assigned'}</dd></div>
                <div><dt className="text-slate-500">Received</dt><dd className="font-medium">{formatDate(complaint.receivedAt)}</dd></div>
                <div><dt className="text-slate-500">Expected disposal</dt><dd className="font-medium">{formatDate(complaint.dueDate)}</dd></div>
              </dl>

              <div className="mt-6">
                <p className="text-sm text-slate-500">Description</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{complaint.description}</p>
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Similarity check</h2>
                <DnaBadge label={complaint.dnaLabel} />
              </div>
              <div className="mt-4">
                <SimilarCases
                  matches={complaint.related.map((r) => ({ caseId: r.caseId, label: r.relation, leadBureau: r.leadBureau }))}
                />
              </div>
              <div className="mt-4">
                <OverlapAlert show={complaint.overlap} />
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
              <h2 className="font-semibold">Attached documents</h2>
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
        )}
      </section>
    </main>
  );
}
