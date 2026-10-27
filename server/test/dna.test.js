import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dnaLabelFor, findSimilar, hasOverlap, labelFor } from '../src/lib/dna.js';

const existing = [
  {
    id: '1',
    caseId: 'CMP-2026-00124',
    category: 'Academic',
    description: 'Shortfall in approved faculty against the AICTE norms.',
    status: 'IN_PROGRESS',
    leadBureau: { code: 'PGRC', name: 'Public Grievance Redressal Cell' },
  },
  {
    id: '2',
    caseId: 'CMP-2026-00123',
    category: 'Infrastructure',
    description: 'Laboratory facilities below the approved intake capacity.',
    status: 'IN_PROGRESS',
    leadBureau: { code: 'RB', name: 'Regulation Bureau' },
  },
];

test('a near-identical complaint in the same category is a duplicate', () => {
  const matches = findSimilar(existing, {
    category: 'Academic',
    description: 'Shortfall in approved faculty against the AICTE norms; faculty count is below requirement.',
  });
  assert.equal(matches[0].caseId, 'CMP-2026-00124');
  assert.equal(matches[0].label, 'DUPLICATE');
  assert.equal(dnaLabelFor(matches), 'DUPLICATE');
});

test('unrelated complaints produce no matches', () => {
  const matches = findSimilar(existing, {
    category: 'Examination',
    description: 'Delay in publishing the semester result.',
  });
  assert.deepEqual(matches, []);
  assert.equal(dnaLabelFor(matches), 'NEW_ISSUE');
});

test('same topic in a different category is related, not duplicate', () => {
  assert.equal(labelFor(0.6, false), 'RELATED');
  assert.equal(labelFor(0.6, true), 'DUPLICATE');
  assert.equal(labelFor(0.1, true), 'NEW_ISSUE');
});

test('overlap is flagged only when a match sits with a different cell', () => {
  const matches = findSimilar(existing, {
    category: 'Academic',
    description: 'Shortfall in approved faculty against the AICTE norms; faculty count is below requirement.',
  });
  assert.equal(hasOverlap('ASC', matches), true);
  assert.equal(hasOverlap('PGRC', matches), false);
  assert.equal(hasOverlap(null, matches), false);
});
