// Reports and what-if forecasting. Pure functions; pass `now` so results are repeatable.
import { isOpen, slaStateOf } from './monitor.js';
import { CONFIG } from './config.js';

const DAY_MS = 86_400_000;
const toMs = (v) => new Date(v).getTime();
const toMonth = (v) => new Date(v).toISOString().slice(0, 7);
const round = (n, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

export const AGEING_BUCKETS = [
  { key: '0-7', label: '0–7 days', from: 0, to: 7 },
  { key: '8-30', label: '8–30 days', from: 7, to: 30 },
  { key: '31-90', label: '31–90 days', from: 30, to: 90 },
  { key: '90+', label: 'Over 90 days', from: 90, to: Infinity },
];

export function disposalRate(cases) {
  if (cases.length === 0) return null;
  return round((cases.filter((c) => !isOpen(c)).length / cases.length) * 100);
}

// Uses lastActionAt as the resolution time for resolved cases.
export function avgResolutionDays(cases) {
  const resolved = cases.filter((c) => !isOpen(c));
  if (resolved.length === 0) return null;
  const total = resolved.reduce((n, c) => n + (toMs(c.lastActionAt) - toMs(c.receivedAt)) / DAY_MS, 0);
  return round(total / resolved.length, 1);
}

function summarizeGroup(group, now) {
  const open = group.filter(isOpen);
  return {
    total: group.length,
    open: open.length,
    resolved: group.length - open.length,
    overdue: open.filter((c) => slaStateOf(c, now) === 'OVERDUE').length,
    disposalRate: disposalRate(group),
    avgResolutionDays: avgResolutionDays(group),
  };
}

export function overallReport(cases, now = new Date()) {
  return summarizeGroup(cases, now);
}

export function bureauReport(cases, cells, now = new Date()) {
  return cells.map((cell) => ({
    code: cell.code,
    name: cell.name,
    ...summarizeGroup(cases.filter((c) => c.leadBureau?.code === cell.code), now),
  }));
}

export function regionReport(cases, now = new Date()) {
  const regions = [...new Set(cases.map((c) => c.institution?.region).filter(Boolean))].sort();
  return regions.map((region) => ({
    region,
    ...summarizeGroup(cases.filter((c) => c.institution?.region === region), now),
  }));
}

// Open cases by age since receipt. Each bucket covers [from, to) days.
export function ageingBuckets(cases, now = new Date()) {
  const open = cases.filter(isOpen);
  return AGEING_BUCKETS.map((b) => {
    const count = open.filter((c) => {
      const days = (now.getTime() - toMs(c.receivedAt)) / DAY_MS;
      return days >= b.from && days < b.to;
    }).length;
    return { key: b.key, label: b.label, count };
  });
}

// Received and resolved counts per calendar month, oldest first.
export function monthlyTrend(cases, now = new Date(), months = 6) {
  const rows = [];
  for (let i = months - 1; i >= 0; i--) {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7);
    rows.push({
      month,
      received: cases.filter((c) => toMonth(c.receivedAt) === month).length,
      resolved: cases.filter((c) => !isOpen(c) && toMonth(c.lastActionAt) === month).length,
    });
  }
  return rows;
}

export function riskFor(load) {
  if (load > CONFIG.analytics.highRiskLoad) return 'HIGH';
  if (load > CONFIG.analytics.mediumRiskLoad) return 'MEDIUM';
  return 'LOW';
}

// What-if forecast. volumeChange is a percentage (e.g. 20 means 20% more complaints).
// Each cell's share of new work follows its share of recent lead assignments.
export function forecast(cases, cells, now = new Date(), opts = {}) {
  const {
    volumeChange = 0,
    capacityPerCell = CONFIG.analytics.defaultCapacity,
    windowWeeks = CONFIG.analytics.windowWeeks,
    lookbackDays = CONFIG.analytics.lookbackDays,
  } = opts;
  const since = now.getTime() - lookbackDays * DAY_MS;
  const weeks = lookbackDays / 7;

  const recent = cases.filter((c) => toMs(c.receivedAt) >= since);
  const baselinePerWeek = recent.length / weeks;
  const projectedPerWeek = baselinePerWeek * (1 + volumeChange / 100);
  const projectedNew = projectedPerWeek * windowWeeks;

  const assigned = recent.filter((c) => c.leadBureau);

  const rows = cells.map((cell) => {
    const share = assigned.length
      ? assigned.filter((c) => c.leadBureau.code === cell.code).length / assigned.length
      : 0;
    const currentOpen = cases.filter((c) => isOpen(c) && c.leadBureau?.code === cell.code).length;
    const resolvedRecent = cases.filter(
      (c) => !isOpen(c) && c.leadBureau?.code === cell.code && toMs(c.lastActionAt) >= since
    ).length;
    const resolvedPerWeek = resolvedRecent / weeks;
    const expectedNew = projectedNew * share;
    const projectedOpen = Math.max(0, currentOpen + expectedNew - resolvedPerWeek * windowWeeks);
    const load = capacityPerCell > 0 ? projectedOpen / capacityPerCell : 0;

    return {
      code: cell.code,
      name: cell.name,
      currentOpen,
      expectedNew: round(expectedNew, 1),
      resolvedPerWeek: round(resolvedPerWeek, 1),
      projectedOpen: round(projectedOpen, 1),
      capacity: capacityPerCell,
      loadPercent: round(load * 100),
      delayRisk: riskFor(load),
      weeksToClear: resolvedPerWeek > 0 ? round(projectedOpen / resolvedPerWeek, 1) : null,
    };
  });

  return {
    baselinePerWeek: round(baselinePerWeek, 1),
    projectedPerWeek: round(projectedPerWeek, 1),
    windowWeeks,
    volumeChange,
    cells: rows,
  };
}
