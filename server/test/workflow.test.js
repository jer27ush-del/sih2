import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedActionsFor, pendingHandoff } from '../src/lib/workflow.js';

const RB = { code: 'RB' };
const ASC = { code: 'ASC' };
const PGRC = { code: 'PGRC' };
const transferToAsc = { type: 'TRANSFERRED', bureau: 'ASC', createdAt: '2026-10-27T10:00:00Z' };
const acknowledged = { type: 'ACKNOWLEDGED', bureau: 'ASC', createdAt: '2026-10-27T11:00:00Z' };
const submitted = { type: 'SUBMITTED', bureau: null, createdAt: '2026-10-27T09:00:00Z' };

test('a transfer is pending until the receiving cell acknowledges it', () => {
  assert.deepEqual(pendingHandoff([submitted, transferToAsc]).toCode, 'ASC');
  assert.equal(pendingHandoff([submitted, transferToAsc, acknowledged]), null);
  assert.equal(pendingHandoff([submitted]), null);
});

test('the lead cell can request information, transfer or resolve an open case', () => {
  const complaint = { status: 'IN_PROGRESS', leadBureau: ASC, actions: [submitted] };
  assert.deepEqual(allowedActionsFor({ role: 'OFFICER', bureau: ASC }, complaint), ['REQUEST_INFO', 'TRANSFER', 'RESOLVE']);
});

test('no request-information action while the institution has not replied', () => {
  const complaint = { status: 'PENDING', leadBureau: ASC, actions: [submitted] };
  assert.deepEqual(allowedActionsFor({ role: 'OFFICER', bureau: ASC }, complaint), ['TRANSFER', 'RESOLVE']);
});

test('during a handoff only the receiving cell can acknowledge', () => {
  const complaint = { status: 'TRANSFERRED', leadBureau: ASC, actions: [submitted, transferToAsc] };
  assert.deepEqual(allowedActionsFor({ role: 'OFFICER', bureau: ASC }, complaint), ['ACKNOWLEDGE']);
  assert.deepEqual(allowedActionsFor({ role: 'OFFICER', bureau: RB }, complaint), []);
});

test('non-lead cells and resolved cases have no actions', () => {
  const open = { status: 'IN_PROGRESS', leadBureau: ASC, actions: [submitted] };
  assert.deepEqual(allowedActionsFor({ role: 'OFFICER', bureau: PGRC }, open), []);
  const resolved = { status: 'RESOLVED', leadBureau: ASC, actions: [submitted] };
  assert.deepEqual(allowedActionsFor({ role: 'ADMIN', bureau: null }, resolved), []);
});
