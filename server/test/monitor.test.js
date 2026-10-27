import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, buildAlerts, slaStateOf, summarize, workloadByCell } from '../src/lib/monitor.js';

const now = new Date('2026-10-27T12:00:00Z');
const RB = { code: 'RB', name: 'Regulation Bureau' };
const ASC = { code: 'ASC', name: 'Academic Standards Cell' };
const ABC = { aicteId: '1-1000000001', name: 'ABC Engineering College', region: 'South' };
const XYZ = { aicteId: '1-1000000002', name: 'XYZ Institute of Technology', region: 'North' };

function make(overrides) {
  return {
    caseId: 'CMP-2026-00001',
    category: 'Academic',
    priority: 'MEDIUM',
    status: 'IN_PROGRESS',
    overlap: false,
    dueDate: '2026-11-20T00:00:00Z',
    receivedAt: '2026-10-20T00:00:00Z',
    institution: ABC,
    leadBureau: RB,
    actions: [],
    ...overrides,
  };
}

test('deadlines classify cases as overdue, due soon, on track, or closed', () => {
  assert.equal(slaStateOf(make({ dueDate: '2026-10-25T00:00:00Z' }), now), 'OVERDUE');
  assert.equal(slaStateOf(make({ dueDate: '2026-10-29T00:00:00Z' }), now), 'DUE_SOON');
  assert.equal(slaStateOf(make({ dueDate: '2026-11-20T00:00:00Z' }), now), 'ON_TRACK');
  assert.equal(slaStateOf(make({ status: 'RESOLVED', dueDate: '2026-10-01T00:00:00Z' }), now), 'CLOSED');
});

test('summary counts open, overdue, and waiting cases', () => {
  const cases = [
    make({ caseId: 'A', status: 'SUBMITTED', dueDate: '2026-10-25T00:00:00Z' }),
    make({ caseId: 'B', status: 'IN_PROGRESS', dueDate: '2026-11-20T00:00:00Z' }),
    make({ caseId: 'C', status: 'RESOLVED', dueDate: '2026-10-01T00:00:00Z' }),
    make({
      caseId: 'D',
      status: 'TRANSFERRED',
      overlap: true,
      actions: [{ type: 'TRANSFERRED', bureau: 'ASC', createdAt: '2026-10-27T10:00:00Z' }],
    }),
  ];
  const s = summarize(cases, now);
  assert.equal(s.total, 4);
  assert.equal(s.pending, 1);
  assert.equal(s.inProgress, 2);
  assert.equal(s.resolved, 1);
  assert.equal(s.overdue, 1);
  assert.equal(s.handoffsWaiting, 1);
  assert.equal(s.coordination, 1);
});

test('alerts flag overdue cases, stale handoffs, and coordination needs, most severe first', () => {
  const cases = [
    make({ caseId: 'LATE', dueDate: '2026-10-25T00:00:00Z' }),
    make({
      caseId: 'STALE',
      status: 'TRANSFERRED',
      actions: [{ type: 'TRANSFERRED', bureau: 'ASC', createdAt: '2026-10-24T12:00:00Z' }],
    }),
    make({ caseId: 'LINKED', overlap: true }),
  ];
  const alerts = buildAlerts(cases, now);
  const types = alerts.map((a) => `${a.caseId}:${a.type}`);
  assert.ok(types.includes('LATE:OVERDUE'));
  assert.ok(types.includes('STALE:HANDOFF_STALE'));
  assert.ok(types.includes('LINKED:COORDINATION'));
  assert.equal(alerts[0].severity, 'high');
  assert.equal(alerts[alerts.length - 1].severity, 'medium');
});

test('workload counts open cases and handoffs waiting per cell', () => {
  const cases = [
    make({ caseId: 'X', leadBureau: RB }),
    make({
      caseId: 'Y',
      leadBureau: ASC,
      status: 'TRANSFERRED',
      actions: [{ type: 'TRANSFERRED', bureau: 'ASC', createdAt: '2026-10-27T10:00:00Z' }],
    }),
  ];
  const rows = workloadByCell([RB, ASC], cases, now);
  const rb = rows.find((r) => r.code === 'RB');
  const asc = rows.find((r) => r.code === 'ASC');
  assert.equal(rb.open, 1);
  assert.equal(asc.open, 1);
  assert.equal(asc.waitingAck, 1);
  assert.equal(rb.waitingAck, 0);
});

test('filters match institution, cell, region, state, and date range', () => {
  const cases = [
    make({ caseId: 'ONE', institution: ABC, leadBureau: RB, dueDate: '2026-10-25T00:00:00Z' }),
    make({ caseId: 'TWO', institution: XYZ, leadBureau: ASC, receivedAt: '2026-10-01T00:00:00Z' }),
  ];
  assert.deepEqual(applyFilters(cases, { q: 'abc' }, now).map((c) => c.caseId), ['ONE']);
  assert.deepEqual(applyFilters(cases, { q: '1-1000000002' }, now).map((c) => c.caseId), ['TWO']);
  assert.deepEqual(applyFilters(cases, { cell: 'RB' }, now).map((c) => c.caseId), ['ONE']);
  assert.deepEqual(applyFilters(cases, { region: 'North' }, now).map((c) => c.caseId), ['TWO']);
  assert.deepEqual(applyFilters(cases, { state: 'OVERDUE' }, now).map((c) => c.caseId), ['ONE']);
  assert.deepEqual(applyFilters(cases, { from: '2026-10-15' }, now).map((c) => c.caseId), ['ONE']);
  assert.deepEqual(applyFilters(cases, { to: '2026-10-15' }, now).map((c) => c.caseId), ['TWO']);
});
