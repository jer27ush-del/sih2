export default function OverlapAlert({ show }) {
  if (!show) return null;
  return (
    <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Potential Overlapping Cases – Coordination Required</p>
      <p className="mt-1">
        Similar complaints from this institution are with different AICTE cells. Those cells should coordinate before acting.
      </p>
    </div>
  );
}
