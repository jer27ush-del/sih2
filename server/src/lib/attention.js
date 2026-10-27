// Reasons a case needs this officer's action now. Derived from existing data; nothing is stored.
import { pendingHandoff } from './workflow.js';

export function needsAttention(user, c, now = new Date()) {
  const reasons = [];
  const open = c.status !== 'RESOLVED';
  const code = user.bureau?.code ?? null;
  const isAdmin = user.role === 'ADMIN';

  const handoff = pendingHandoff(c.actions ?? []);
  if (open && handoff && (isAdmin || handoff.toCode === code)) {
    reasons.push('HANDOFF_AWAITING_ACK');
  }

  const leads = isAdmin || (code !== null && c.leadBureau?.code === code);
  if (open && leads && new Date(c.dueDate) < now) {
    reasons.push('OVERDUE');
  }
  return reasons;
}
