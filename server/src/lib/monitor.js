import { CONFIG } from './config.js';
// Monitoring rules: deadlines, alerts, workload, and filtering. All functions take a `now` for testing.
import { pendingHandoff } from './workflow.js';

export const DUE_SOON_DAYS = CONFIG.monitor.dueSoonDays;
export const HANDOFF_STALE_HOURS = CONFIG.monitor.handoffStaleHours;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export const isOpen = (c) => c.status !== 'RESOLVED';

export function slaStateOf(c, now = new Date()) {
  if (!isOpen(c)) return 'CLOSED';
  const remaining = new Date(c.dueDate).getTime() - now.getTime();
  if (remaining < 0) return 'OVERDUE';
  if (remaining <= DUE_SOON_DAYS * DAY_MS) return 'DUE_SOON';
  return 'ON_TRACK';
}

export function handoffHours(c, now = new Date()) {
  const pending = pendingHandoff(c.actions ?? []);
  if (!pending) return null;
  return (now.getTime() - new Date(pending.at).getTime()) / HOUR_MS;
}

export function summarize(cases, now = new Date()) {
  const open = cases.filter(isOpen);
  return {
    total: cases.length,
    pending: cases.filter((c) => ['SUBMITTED', 'PENDING'].includes(c.status)).length,
    inProgress: cases.filter((c) => ['IN_PROGRESS', 'TRANSFERRED'].includes(c.status)).length,
    resolved: cases.length - open.length,
    overdue: open.filter((c) => slaStateOf(c, now) === 'OVERDUE').length,
    dueSoon: open.filter((c) => slaStateOf(c, now) === 'DUE_SOON').length,
    handoffsWaiting: open.filter((c) => pendingHandoff(c.actions ?? [])).length,
    coordination: open.filter((c) => c.overlap).length,
  };
}

export function buildAlerts(cases, now = new Date()) {
  const alerts = [];
  for (const c of cases) {
    if (!isOpen(c)) continue;
    const state = slaStateOf(c, now);
    if (state === 'OVERDUE') {
      alerts.push({ severity: 'high', type: 'OVERDUE', caseId: c.caseId, message: 'Past the expected disposal date' });
    } else if (state === 'DUE_SOON') {
      alerts.push({ severity: 'medium', type: 'DUE_SOON', caseId: c.caseId, message: `Due within ${DUE_SOON_DAYS} days` });
    }

    const hours = handoffHours(c, now);
    if (hours !== null && hours >= HANDOFF_STALE_HOURS) {
      const to = pendingHandoff(c.actions).toCode;
      alerts.push({
        severity: 'high',
        type: 'HANDOFF_STALE',
        caseId: c.caseId,
        message: `Handoff to ${to} unacknowledged for ${Math.floor(hours)} hours`,
      });
    }

    if (c.overlap) {
      alerts.push({
        severity: 'medium',
        type: 'COORDINATION',
        caseId: c.caseId,
        message: 'Overlapping cases with another cell. Coordination required',
      });
    }
  }
  const rank = { high: 0, medium: 1, low: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export function workloadByCell(cells, cases, now = new Date()) {
  return cells.map((cell) => {
    const led = cases.filter((c) => isOpen(c) && c.leadBureau?.code === cell.code);
    return {
      code: cell.code,
      name: cell.name,
      open: led.length,
      overdue: led.filter((c) => slaStateOf(c, now) === 'OVERDUE').length,
      dueSoon: led.filter((c) => slaStateOf(c, now) === 'DUE_SOON').length,
      waitingAck: cases.filter((c) => isOpen(c) && pendingHandoff(c.actions ?? [])?.toCode === cell.code).length,
    };
  });
}

function matchesState(c, state, now) {
  if (state === 'OVERDUE') return slaStateOf(c, now) === 'OVERDUE';
  if (state === 'DUE_SOON') return slaStateOf(c, now) === 'DUE_SOON';
  if (state === 'HANDOFF_WAITING') return isOpen(c) && Boolean(pendingHandoff(c.actions ?? []));
  if (state === 'COORDINATION') return isOpen(c) && Boolean(c.overlap);
  return true;
}

// f: { q, cell, region, status, priority, state, from, to } (dates as YYYY-MM-DD)
export function applyFilters(cases, f = {}, now = new Date()) {
  const q = f.q?.toLowerCase();
  const to = f.to ? new Date(`${f.to}T23:59:59.999Z`) : null;
  const from = f.from ? new Date(`${f.from}T00:00:00.000Z`) : null;

  return cases.filter((c) => {
    if (q && ![c.caseId, c.institution?.name, c.institution?.aicteId].some((v) => v?.toLowerCase().includes(q))) {
      return false;
    }
    if (f.cell && c.leadBureau?.code !== f.cell) return false;
    if (f.region && c.institution?.region !== f.region) return false;
    if (f.status && c.status !== f.status) return false;
    if (f.priority && c.priority !== f.priority) return false;
    if (from && new Date(c.receivedAt) < from) return false;
    if (to && new Date(c.receivedAt) > to) return false;
    if (f.state && !matchesState(c, f.state, now)) return false;
    return true;
  });
}
