import { CONFIG } from './config.js';
// Routing and access rules for officers.

export const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };

// Supporting cells are the other cells holding complaints linked to this case.
export function supportingCellsFor(leadCode, related = []) {
  const cells = new Map();
  for (const r of related) {
    const cell = r.leadBureau;
    if (cell && cell.code !== leadCode) cells.set(cell.code, { code: cell.code, name: cell.name });
  }
  return [...cells.values()];
}

// Cells that have acted on the case at any point. A cell that handed a case off stays involved.
export function involvedCodes(actions = []) {
  return [...new Set(actions.map((a) => a.bureau).filter(Boolean))];
}

// Expects a serialized complaint: { leadBureau, related, actions, overlap }
export function routingOf(complaint) {
  const lead = complaint.leadBureau ?? null;
  return {
    lead,
    supporting: supportingCellsFor(lead?.code, complaint.related),
    involved: CONFIG.access.cellsKeepReadOnlyAfterHandoff ? involvedCodes(complaint.actions) : [],
    overlap: Boolean(complaint.overlap),
  };
}

// LEAD, SUPPORT, HANDED_OFF (read-only), ADMIN, or null when the user has no access.
export function accessFor(user, routing) {
  if (user.role === 'ADMIN') return 'ADMIN';
  const code = user.bureau?.code;
  if (!code) return null;
  if (routing.lead?.code === code) return 'LEAD';
  if (routing.supporting.some((s) => s.code === code)) return 'SUPPORT';
  if ((routing.involved ?? []).includes(code)) return 'HANDED_OFF';
  return null;
}

export function canViewComplaint(user, routing) {
  return accessFor(user, routing) !== null;
}

export function sortForQueue(items) {
  return [...items].sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      new Date(a.dueDate) - new Date(b.dueDate)
  );
}

export function groupByPriority(items) {
  const groups = { HIGH: [], MEDIUM: [], LOW: [] };
  for (const item of items) (groups[item.priority] ??= []).push(item);
  return groups;
}
