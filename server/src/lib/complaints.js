import { hasOverlap } from './dna.js';
import { CONFIG } from './config.js';

export const CATEGORIES = ['Academic', 'Examination', 'Faculty', 'Infrastructure', 'Fees', 'Other'];

// Rule-based routing: category decides the lead bureau/cell.
const BUREAU_BY_CATEGORY = CONFIG.bureauByCategory;

// Keyword fallback for priority, used when the AI check is unavailable.
const HIGH_KEYWORDS = CONFIG.priority.highKeywords;
const LOW_KEYWORDS = CONFIG.priority.lowKeywords;

// Days allowed from submission to expected disposal.
const SLA_DAYS = CONFIG.sla;

const relatedSelect = { caseId: true, status: true, leadBureau: { select: { code: true, name: true } } };

// Shared Prisma include for complaint reads, in both directions of the DNA links.
export const complaintInclude = {
  leadBureau: true,
  institution: { select: { aicteId: true, name: true, region: true } },
  actions: { orderBy: { createdAt: 'asc' }, include: { bureau: true } },
  attachments: { orderBy: { createdAt: 'asc' } },
  linksFrom: { include: { to: { select: relatedSelect } } },
  linksTo: { include: { from: { select: relatedSelect } } },
};

export function suggestBureau(category) {
  return BUREAU_BY_CATEGORY[category] ?? 'PGRC';
}

export function suggestPriority(description) {
  const text = description.toLowerCase();
  if (HIGH_KEYWORDS.some((k) => text.includes(k))) return 'HIGH';
  if (LOW_KEYWORDS.some((k) => text.includes(k))) return 'LOW';
  return 'MEDIUM';
}

export function slaDays(priority) {
  return SLA_DAYS[priority] ?? SLA_DAYS.MEDIUM;
}

// Generates CMP-YYYY-NNNNN, continuing from the highest existing number for the year.
export async function nextCaseId(db, year = new Date().getFullYear()) {
  const prefix = `CMP-${year}-`;
  const last = await db.complaint.findFirst({
    where: { caseId: { startsWith: prefix } },
    orderBy: { caseId: 'desc' },
    select: { caseId: true },
  });
  const next = last ? Number(last.caseId.slice(prefix.length)) + 1 : 1;
  return prefix + String(next).padStart(5, '0');
}

const toCell = (b) => (b ? { code: b.code, name: b.name } : null);

function toRelated(other, relation) {
  return {
    caseId: other.caseId,
    relation,
    status: other.status,
    leadBureau: toCell(other.leadBureau),
  };
}

export function serializeComplaint(c) {
  const related = [
    ...(c.linksFrom ?? []).map((l) => toRelated(l.to, l.relation)),
    ...(c.linksTo ?? []).map((l) => toRelated(l.from, l.relation)),
  ];

  return {
    caseId: c.caseId,
    category: c.category,
    description: c.description,
    priority: c.priority,
    status: c.status,
    dnaLabel: c.dnaLabel,
    institution: c.institution
      ? { aicteId: c.institution.aicteId, name: c.institution.name, region: c.institution.region }
      : null,
    related,
    overlap: hasOverlap(c.leadBureau?.code, related),
    leadBureau: toCell(c.leadBureau),
    receivedAt: c.receivedAt,
    dueDate: c.dueDate,
    lastActionAt: c.lastActionAt,
    actions: (c.actions ?? []).map((a) => ({
      id: a.id,
      type: a.type,
      actorName: a.actorName,
      bureau: a.bureau?.code ?? null,
      remarks: a.remarks,
      createdAt: a.createdAt,
    })),
    attachments: (c.attachments ?? []).map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
    })),
  };
}
