import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import AppHeader from '../../components/AppHeader.jsx';
import FileDropzone from '../../components/FileDropzone.jsx';
import { DnaBadge, PriorityBadge } from '../../components/Badges.jsx';
import OverlapAlert from '../../components/OverlapAlert.jsx';
import SimilarCases from '../../components/SimilarCases.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';

const CATEGORIES = ['Academic', 'Examination', 'Faculty', 'Infrastructure', 'Fees', 'Other'];
const MIN_DESCRIPTION = 20;

const LINKS = [
  { to: '/institution', label: 'Dashboard' },
  { to: '/institution/submit', label: 'Submit Complaint' },
];

const fieldClass = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-blue-600 focus:outline-none';

function overallDnaLabel(similar) {
  if (similar.some((m) => m.label === 'DUPLICATE')) return 'DUPLICATE';
  if (similar.length > 0) return 'RELATED';
  return 'NEW_ISSUE';
}

export default function SubmitComplaint() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('form');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Ask the server for priority, routing, and similar cases once the description is long enough.
  useEffect(() => {
    if (!category || description.trim().length < MIN_DESCRIPTION) {
      setAssessment(null);
      setAnalysing(false);
      return;
    }
    let current = true;
    setAnalysing(true);
    const timer = setTimeout(() => {
      api('/complaints/suggest', { method: 'POST', body: { category, description } })
        .then((data) => current && setAssessment(data))
        .catch(() => current && setAssessment(null))
        .finally(() => current && setAnalysing(false));
    }, 600);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [category, description]);

  const similar = assessment?.similar ?? [];
  const canContinue = Boolean(category) && description.trim().length >= MIN_DESCRIPTION && assessment && !analysing;

  function handleNext(e) {
    e.preventDefault();
    if (canContinue) setStep('review');
  }

  async function handleSubmit() {
    setError('');
    setSubmitting(true);
    const body = new FormData();
    body.append('category', category);
    body.append('description', description.trim());
    files.forEach((file) => body.append('documents', file));

    try {
      const data = await api('/complaints', { method: 'POST', body });
      navigate(`/institution/complaints/${data.complaint.caseId}`, { state: { submitted: true } });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  const sourceLabel = assessment?.source === 'ai' ? 'AI assessment' : 'Rule-based assessment';

  return (
    <main className="min-h-screen">
      <AppHeader links={LINKS} />
      <section className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-slate-500">Step {step === 'form' ? '1' : '2'} of 2</p>
        <h1 className="mt-1 text-2xl font-semibold">{step === 'form' ? 'Submit Complaint' : 'Review and Submit'}</h1>

        {step === 'form' && (
          <form onSubmit={handleNext} className="mt-6 space-y-6 rounded-xl bg-white p-6 ring-1 ring-slate-200">
            <div>
              <p className="text-sm font-medium">Institution name</p>
              <p className="mt-1 text-slate-700">{user.institution?.name} ({user.institution?.aicteId})</p>
            </div>

            <label className="block text-sm font-medium">
              Category
              <select className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value)} required>
                <option value="">Select category</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Description
              <textarea
                rows={5}
                className={fieldClass}
                placeholder="Describe the complaint in detail (at least 20 characters)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </label>

            <div className="rounded-md bg-slate-50 p-4">
              <p className="text-sm font-medium">Priority assessment</p>
              {analysing && <p className="mt-2 text-sm text-slate-500">Analysing the description…</p>}
              {!analysing && assessment && (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <PriorityBadge priority={assessment.priority} />
                    <span className="text-sm text-slate-600">
                      Suggested cell: {assessment.bureau?.name ?? 'to be assigned'} · Expected disposal in {assessment.slaDays} days
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{assessment.reason} <span className="text-slate-400">({sourceLabel})</span></p>
                </div>
              )}
              {!analysing && !assessment && (
                <p className="mt-2 text-sm text-slate-500">Choose a category and describe the complaint to get a priority assessment.</p>
              )}
            </div>

            {!analysing && assessment && (
              <div className="space-y-3 rounded-md bg-slate-50 p-4">
                <p className="text-sm font-medium">Similarity check</p>
                <SimilarCases matches={similar} />
                <OverlapAlert show={assessment.overlap} />
              </div>
            )}

            <div>
              <p className="text-sm font-medium">Supporting documents (optional)</p>
              <div className="mt-2">
                <FileDropzone files={files} onChange={setFiles} />
              </div>
            </div>

            <div className="flex justify-between">
              <Link to="/institution" className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={!canContinue}
                className="rounded-md bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </form>
        )}

        {step === 'review' && assessment && (
          <div className="mt-6 space-y-6 rounded-xl bg-white p-6 ring-1 ring-slate-200">
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Institution</dt><dd className="font-medium">{user.institution?.name}</dd></div>
              <div><dt className="text-slate-500">Category</dt><dd className="font-medium">{category}</dd></div>
              <div>
                <dt className="text-slate-500">Priority</dt>
                <dd className="mt-1 flex items-center gap-2"><PriorityBadge priority={assessment.priority} /><span className="text-xs text-slate-500">{sourceLabel}</span></dd>
              </div>
              <div>
                <dt className="text-slate-500">Similarity</dt>
                <dd className="mt-1"><DnaBadge label={overallDnaLabel(similar)} /></dd>
              </div>
              <div><dt className="text-slate-500">Suggested cell</dt><dd className="font-medium">{assessment.bureau?.name ?? 'To be assigned'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-slate-500">Why this priority</dt><dd>{assessment.reason}</dd></div>
            </dl>

            <div className="space-y-3">
              <SimilarCases matches={similar} />
              <OverlapAlert show={assessment.overlap} />
            </div>

            <div>
              <p className="text-sm text-slate-500">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{description.trim()}</p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Attached documents</p>
              {files.length === 0 ? (
                <p className="mt-1 text-sm">None</p>
              ) : (
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {files.map((f, i) => <li key={`${f.name}-${i}`}>{f.name}</li>)}
                </ul>
              )}
            </div>

            {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep('form')}
                disabled={submitting}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-md bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit complaint'}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
