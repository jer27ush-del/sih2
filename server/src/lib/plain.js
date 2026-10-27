// Plain-language wording for people who are not staff. Never includes the complaint text or internal remarks.
export const STATUS_PLAIN = {
  SUBMITTED: {
    label: 'Received',
    explain: 'Your complaint has been received and is waiting to be reviewed.',
  },
  PENDING: {
    label: 'More information needed',
    explain: 'AICTE has asked the institution for more information. The institution has been asked to reply.',
  },
  IN_PROGRESS: {
    label: 'Being looked into',
    explain: 'An AICTE office is reviewing your complaint.',
  },
  TRANSFERRED: {
    label: 'Passed to another office',
    explain: 'Your complaint has been passed to another AICTE office, which is confirming that it will take it on.',
  },
  RESOLVED: {
    label: 'Finished',
    explain: 'The review of this complaint is complete.',
  },
};

export const UPDATE_PLAIN = {
  SUBMITTED: 'Complaint received',
  ASSIGNED: 'Passed to the office that will review it',
  TRANSFERRED: 'Passed to another office',
  INFO_REQUESTED: 'More information requested',
  ACKNOWLEDGED: 'New office confirmed it will take it on',
  NOTE: 'Update added',
  RESOLVED: 'Review completed',
};

// Takes a serialized complaint and returns only what a member of the public may see.
export function trackView(c) {
  const plain = STATUS_PLAIN[c.status] ?? { label: c.status, explain: '' };
  return {
    caseId: c.caseId,
    status: plain.label,
    explanation: plain.explain,
    office: c.leadBureau?.name ?? 'Not yet assigned',
    expectedBy: c.dueDate,
    lastUpdated: c.lastActionAt,
    updates: (c.actions ?? []).map((a) => ({
      when: a.createdAt,
      what: UPDATE_PLAIN[a.type] ?? 'Update',
    })),
  };
}
