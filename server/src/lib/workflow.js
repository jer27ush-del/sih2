// Case workflow rules for officers: what each user may do next, and handoff state.

// The handoff is pending when the latest transfer has not been acknowledged yet.
// The transfer action's bureau is the receiving cell.
export function pendingHandoff(actions = []) {
  let pending = null;
  for (const a of actions) {
    if (a.type === 'TRANSFERRED') pending = a;
    else if (a.type === 'ACKNOWLEDGED') pending = null;
  }
  return pending ? { toCode: pending.bureau, at: pending.createdAt } : null;
}

// Expects a serialized complaint: { status, leadBureau: {code}|null, actions: [...] }
export function allowedActionsFor(user, complaint) {
  const code = user.bureau?.code ?? null;
  const isAdmin = user.role === 'ADMIN';
  const isLead = isAdmin || (code !== null && complaint.leadBureau?.code === code);
  const open = complaint.status !== 'RESOLVED';
  const handoff = pendingHandoff(complaint.actions);

  if (open && handoff) {
    return isAdmin || code === handoff.toCode ? ['ACKNOWLEDGE'] : [];
  }
  if (open && isLead) {
    const actions = [];
    if (complaint.status !== 'PENDING') actions.push('REQUEST_INFO');
    actions.push('TRANSFER', 'RESOLVE');
    return actions;
  }
  return [];
}
