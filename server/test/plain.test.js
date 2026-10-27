import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackView } from '../src/lib/plain.js';

test('public tracking shows status and history, but never the complaint text or internal remarks', () => {
  const view = trackView({
    caseId: 'CMP-2026-00124',
    status: 'PENDING',
    description: 'Private details of the complaint',
    leadBureau: { code: 'PGRC', name: 'Public Grievance Redressal Cell' },
    dueDate: '2026-11-06T00:00:00Z',
    lastActionAt: '2026-10-27T10:39:29Z',
    actions: [
      { type: 'INFO_REQUESTED', remarks: 'Internal note for the institution', createdAt: '2026-10-27T10:39:29Z' },
    ],
  });
  assert.equal(view.status, 'More information needed');
  assert.equal(view.office, 'Public Grievance Redressal Cell');
  assert.equal(view.updates[0].what, 'More information requested');
  const text = JSON.stringify(view);
  assert.ok(!text.includes('Private details'));
  assert.ok(!text.includes('Internal note'));
});
