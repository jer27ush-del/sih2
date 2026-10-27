import { DnaBadge } from './Badges.jsx';

export default function SimilarCases({ matches = [] }) {
  if (matches.length === 0) {
    return <p className="text-sm text-slate-500">No similar complaints from this institution in the last 180 days.</p>;
  }
  return (
    <ul className="divide-y divide-slate-200 rounded-md bg-white ring-1 ring-slate-200">
      {matches.map((m) => (
        <li key={m.caseId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
          <span className="font-mono font-medium">{m.caseId}</span>
          <DnaBadge label={m.label} />
          {typeof m.score === 'number' && (
            <span className="text-slate-600">{Math.round(m.score * 100)}% shared terms</span>
          )}
          <span className="text-slate-600">Cell: {m.leadBureau?.code ?? 'Unassigned'}</span>
        </li>
      ))}
    </ul>
  );
}
