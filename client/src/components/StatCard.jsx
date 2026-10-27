export default function StatCard({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-white ring-slate-200 text-slate-900',
    amber: 'bg-amber-50 ring-amber-200 text-amber-900',
    blue: 'bg-blue-50 ring-blue-200 text-blue-900',
    emerald: 'bg-emerald-50 ring-emerald-200 text-emerald-900',
    red: 'bg-red-50 ring-red-200 text-red-900',
  };
  return (
    <div className={`rounded-xl p-5 ring-1 ${tones[tone]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}
