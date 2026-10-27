import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accessFor,
  canViewComplaint,
  groupByPriority,
  involvedCodes,
  routingOf,
  sortForQueue,
  supportingCellsFor,
} from '../src/lib/routing.js';

const PGRC = { code: 'PGRC', name: 'Public Grievance Redressal Cell' };
const RB = { code: 'RB', name: 'Regulation Bureau' };
const ASC = { code: 'ASC', name: 'Academic Standards Cell' };

test('supporting cells exclude the lead cell and remove duplicates', () => {
  const related = [{ leadBureau: RB }, { leadBureau: RB }, { leadBureau: ASC }, { leadBureau: null }];
  assert.deepEqual(supportingCellsFor('ASC', related), [{ code: 'RB', name: 'Regulation Bureau' }]);
});

test('routing reports lead, supporting cells, involved cells and overlap', () => {
  const routing = routingOf({
    leadBureau: ASC,
    related: [{ leadBureau: RB }],
    actions: [{ bureau: PGRC.code }, { bureau: ASC.code }],
    overlap: true,
  });
  assert.equal(routing.lead.code, 'ASC');
  assert.deepEqual(routing.supporting.map((s) => s.code), ['RB']);
  assert.deepEqual(routing.involved, ['PGRC', 'ASC']);
  assert.equal(routing.overlap, true);
});

test('officers see only cases led by or supported by their cell, plus cells that handed off', () => {
  const routing = { lead: ASC, supporting: [RB], involved: ['PGRC'], overlap: true };
  assert.equal(canViewComplaint({ role: 'OFFICER', bureau: RB }, routing), true);
  assert.equal(canViewComplaint({ role: 'OFFICER', bureau: ASC }, routing), true);
  assert.equal(canViewComplaint({ role: 'OFFICER', bureau: { code: 'ADM' } }, routing), false);
  assert.equal(canViewComplaint({ role: 'ADMIN', bureau: null }, routing), true);
});

test('a cell that handed a case off gets read-only access', () => {
  const routing = { lead: ASC, supporting: [], involved: ['PGRC', 'ASC'], overlap: false };
  assert.equal(accessFor({ role: 'OFFICER', bureau: PGRC }, routing), 'HANDED_OFF');
  assert.equal(accessFor({ role: 'OFFICER', bureau: ASC }, routing), 'LEAD');
  assert.equal(accessFor({ role: 'OFFICER', bureau: RB }, routing), null);
});

test('involvedCodes ignores actions without a cell', () => {
  assert.deepEqual(involvedCodes([{ bureau: null }, { bureau: 'RB' }, { bureau: 'RB' }]), ['RB']);
});

test('queue sorts by priority then due date, and groups by priority', () => {
  const items = [
    { caseId: 'a', priority: 'LOW', dueDate: '2026-11-01' },
    { caseId: 'b', priority: 'HIGH', dueDate: '2026-12-01' },
    { caseId: 'c', priority: 'HIGH', dueDate: '2026-11-05' },
  ];
  const sorted = sortForQueue(items);
  assert.deepEqual(sorted.map((i) => i.caseId), ['c', 'b', 'a']);
  const groups = groupByPriority(sorted);
  assert.deepEqual(groups.HIGH.map((i) => i.caseId), ['c', 'b']);
  assert.equal(groups.MEDIUM.length, 0);
});
