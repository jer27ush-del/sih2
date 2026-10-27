const STATUS = {
  SUBMITTED: ['Submitted', 'bg-slate-100 text-slate-700'],
  PENDING: ['Pending', 'bg-amber-100 text-amber-800'],
  IN_PROGRESS: ['In progress', 'bg-blue-100 text-blue-800'],
  TRANSFERRED: ['Transferred', 'bg-violet-100 text-violet-800'],
  RESOLVED: ['Resolved', 'bg-emerald-100 text-emerald-800'],
};

const PRIORITY = {
  HIGH: ['High', 'bg-red-100 text-red-800'],
  MEDIUM: ['Medium', 'bg-amber-100 text-amber-800'],
  LOW: ['Low', 'bg-green-100 text-green-800'],
};

const DNA = {
  DUPLICATE: ['Duplicate', 'bg-rose-100 text-rose-800'],
  RELATED: ['Related', 'bg-violet-100 text-violet-800'],
  NEW_ISSUE: ['New issue', 'bg-sky-100 text-sky-800'],
};

const pill = 'rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap';

export function StatusBadge({ status }) {
  const [label, classes] = STATUS[status] ?? [status, 'bg-slate-100 text-slate-700'];
  return <span className={`${pill} ${classes}`}>{label}</span>;
}

export function PriorityBadge({ priority }) {
  const [label, classes] = PRIORITY[priority] ?? [priority, 'bg-slate-100 text-slate-700'];
  return <span className={`${pill} ${classes}`}>{label}</span>;
}

export function DnaBadge({ label }) {
  const [text, classes] = DNA[label] ?? [label, 'bg-slate-100 text-slate-700'];
  return <span className={`${pill} ${classes}`}>{text}</span>;
}
