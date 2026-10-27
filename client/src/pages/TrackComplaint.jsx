import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { formatDate } from '../format.js';

const inputClass = 'mt-2 w-full rounded-md border-2 border-slate-600 bg-white px-4 py-3 text-lg';

export default function TrackComplaint() {
  const [caseId, setCaseId] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const data = await api('/track', { method: 'POST', body: { caseId, email } });
      setResult(data.complaint);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link to="/" className="text-lg text-blue-900 underline">Back to home</Link>
      <h1 className="mt-6 text-3xl font-bold">Track your complaint</h1>
      <p className="mt-3 text-lg">
        Enter your complaint ID and the email address your institution registered with. You will see the current
        status and the date of each update.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <div>
          <label htmlFor="case-id" className="block text-lg font-semibold">Complaint ID</label>
          <p id="case-id-hint" className="text-base text-slate-700">For example CMP-2026-00124. It is shown when the complaint is submitted.</p>
          <input
            id="case-id"
            aria-describedby="case-id-hint"
            className={inputClass}
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            autoComplete="off"
            required
          />
        </div>

        <div>
          <label htmlFor="track-email" className="block text-lg font-semibold">Email address</label>
          <p id="track-email-hint" className="text-base text-slate-700">The email your institution used when it registered.</p>
          <input
            id="track-email"
            type="email"
            aria-describedby="track-email-hint"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        {error && <p role="alert" className="rounded-md bg-red-50 p-4 text-lg text-red-800">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-blue-900 px-6 py-3 text-lg font-semibold text-white hover:bg-blue-950 disabled:opacity-60"
        >
          {busy ? 'Checking…' : 'Track complaint'}
        </button>
      </form>

      {result && (
        <section aria-labelledby="result-heading" className="mt-10 rounded-xl bg-white p-6 ring-2 ring-slate-500">
          <h2 id="result-heading" className="text-2xl font-bold">Complaint {result.caseId}</h2>
          <p className="mt-4 text-xl"><span className="font-semibold">Status: </span>{result.status}</p>
          <p className="mt-3 text-lg">{result.explanation}</p>

          <dl className="mt-6 grid gap-4 text-lg sm:grid-cols-2">
            <div><dt className="font-semibold">Office handling it</dt><dd>{result.office}</dd></div>
            <div><dt className="font-semibold">Expected by</dt><dd>{formatDate(result.expectedBy)}</dd></div>
            <div><dt className="font-semibold">Last updated</dt><dd>{formatDate(result.lastUpdated)}</dd></div>
          </dl>

          <h3 className="mt-8 text-xl font-semibold">Updates so far</h3>
          <ol className="mt-3 list-decimal space-y-3 pl-6 text-lg">
            {result.updates.map((u, i) => (
              <li key={i}>{u.what}, on {formatDate(u.when)}</li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
