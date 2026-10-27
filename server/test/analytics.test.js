import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageingBuckets, avgResolutionDays, disposalRate, forecast, monthlyTrend } from '../src/lib/analytics.js';

const now = new Date('2026-10-27T12:00:00Z');
const RB = { code: 'RB', name: 'Regulation Bureau' };
const ABC = { aicteId: '1-1000000001', name: 'ABC Engineering College', region: 'South' };

function make(overrides) {
  return {
    caseId: 'CMP-X',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    dueDate: '2026-11-20T00:00:00Z',
    receivedAt: '2026-10-20T00:00:00Z',
    lastActionAt: '2026-10-20T00:00:00Z',
    institution: ABC,
    leadBureau: RB,
    actions: [],
    ...overrides,
  };
}

test('disposal rate is the share of cases that are resolved', () => {
  const cases = [
    make({ status: 'RESOLVED' }),
    make({ status: 'RESOLVED' }),
    make({ status: 'PENDING' }),
    make({ status: 'IN_PROGRESS' }),
  ];
  assert.equal(disposalRate(cases), 50);
  assert.equal(disposalRate([]), null);
});

test('average resolution time uses resolved cases only', () => {
  const cases = [
    make({ status: 'RESOLVED', receivedAt: '2026-10-10T00:00:00Z', lastActionAt: '2026-10-20T00:00:00Z' }),
    make({ status: 'IN_PROGRESS', receivedAt: '2026-01-01T00:00:00Z' }),
  ];
  assert.equal(avgResolutionDays(cases), 10);
});

test('ageing places open cases in the right bucket', () => {
  const cases = [
    make({ receivedAt: '2026-10-24T12:00:00Z' }),
    make({ receivedAt: '2026-09-12T12:00:00Z' }),
    make({ status: 'RESOLVED', receivedAt: '2026-09-12T12:00:00Z' }),
  ];
  const buckets = Object.fromEntries(ageingBuckets(cases, now).map((b) => [b.key, b.count]));
  assert.equal(buckets['0-7'], 1);
  assert.equal(buckets['31-90'], 1);
  assert.equal(buckets['90+'], 0);
});

test('monthly trend returns six months, oldest first', () => {
  const rows = monthlyTrend([make({ receivedAt: '2026-10-05T00:00:00Z' })], now, 6);
  assert.equal(rows.length, 6);
  assert.equal(rows[5].month, '2026-10');
  assert.equal(rows[5].received, 1);
});

test('doubling volume doubles the projected weekly intake', () => {
  const cases = Array.from({ length: 13 }, () => make({ status: 'SUBMITTED' }));
  const base = forecast(cases, [RB], now, { volumeChange: 0 });
  const doubled = forecast(cases, [RB], now, { volumeChange: 100 });
  assert.equal(base.baselinePerWeek, 1);
  assert.equal(doubled.projectedPerWeek, base.projectedPerWeek * 2);
});

test('a cell with more work than its capacity is flagged as high delay risk', () => {
  const cases = Array.from({ length: 13 }, () => make({ status: 'SUBMITTED' }));
  const result = forecast(cases, [RB], now, { volumeChange: 0, capacityPerCell: 15 });
  assert.equal(result.cells[0].delayRisk, 'HIGH');
  const roomy = forecast(cases, [RB], now, { volumeChange: 0, capacityPerCell: 100 });
  assert.equal(roomy.cells[0].delayRisk, 'LOW');
});
