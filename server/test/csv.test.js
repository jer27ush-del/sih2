import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cell, toCsv } from '../src/lib/csv.js';
import { needsAttention } from '../src/lib/attention.js';

test('CSV quotes commas and quotes, and neutralises formula-like values', () => {
  assert.equal(cell('x,y'), '"x,y"');
  assert.equal(cell('he said "hi"'), '"he said ""hi"""');
  assert.equal(cell('=SUM(A1)'), "'=SUM(A1)");
  const csv = toCsv(['Name', 'Note'], [['A', 'line one\nline two']]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"line one\nline two"'));
});

const ASC = { code: 'ASC' };
const RB = { code: 'RB' };
const now = new Date('2026-10-27T12:00:00Z');

test('a cell is alerted to handoffs waiting for it and to its own overdue cases', () => {
  const handoff = {
    status: 'TRANSFERRED',
    leadBureau: ASC,
    dueDate: '2026-11-20T00:00:00Z',
    actions: [{ type: 'TRANSFERRED', bureau: 'ASC', createdAt: '2026-10-27T10:00:00Z' }],
  };
  assert.deepEqual(needsAttention({ role: 'OFFICER', bureau: ASC }, handoff, now), ['HANDOFF_AWAITING_ACK']);
  assert.deepEqual(needsAttention({ role: 'OFFICER', bureau: RB }, handoff, now), []);

  const late = { status: 'IN_PROGRESS', leadBureau: RB, dueDate: '2026-10-20T00:00:00Z', actions: [] };
  assert.deepEqual(needsAttention({ role: 'OFFICER', bureau: RB }, late, now), ['OVERDUE']);
  assert.deepEqual(needsAttention({ role: 'OFFICER', bureau: ASC }, late, now), []);
});
