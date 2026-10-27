import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { complaintInclude, serializeComplaint } from '../lib/complaints.js';
import { applyFilters, buildAlerts, slaStateOf, summarize, workloadByCell } from '../lib/monitor.js';
import { pendingHandoff } from '../lib/workflow.js';
import { CASE_HEADERS, caseRow, toCsv } from '../lib/csv.js';

const router = Router();
router.use(requireAuth, requireRole('OFFICER', 'ADMIN'));

async function loadAllCases() {
  const rows = await prisma.complaint.findMany({ include: complaintInclude, orderBy: { receivedAt: 'desc' } });
  return rows.map(serializeComplaint);
}

function listItem(c, now) {
  return {
    caseId: c.caseId,
    category: c.category,
    priority: c.priority,
    status: c.status,
    dnaLabel: c.dnaLabel,
    overlap: c.overlap,
    dueDate: c.dueDate,
    receivedAt: c.receivedAt,
    institution: c.institution,
    leadBureau: c.leadBureau,
    slaState: slaStateOf(c, now),
    handoffTo: pendingHandoff(c.actions)?.toCode ?? null,
  };
}

router.get('/summary', async (req, res, next) => {
  try {
    const now = new Date();
    const [cases, cells] = await Promise.all([
      loadAllCases(),
      prisma.bureau.findMany({ select: { code: true, name: true }, orderBy: { code: 'asc' } }),
    ]);
    res.json({
      summary: summarize(cases, now),
      alerts: buildAlerts(cases, now),
      workload: workloadByCell(cells, cases, now),
      cells,
    });
  } catch (err) {
    next(err);
  }
});

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const filterSchema = z.object({
  q: z.string().trim().optional(),
  cell: z.string().optional(),
  region: z.string().optional(),
  status: z.enum(['SUBMITTED', 'PENDING', 'IN_PROGRESS', 'TRANSFERRED', 'RESOLVED']).optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  state: z.enum(['OVERDUE', 'DUE_SOON', 'HANDOFF_WAITING', 'COORDINATION']).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});

router.get('/cases', async (req, res, next) => {
  try {
    const filters = filterSchema.parse(req.query);
    const now = new Date();
    const matched = applyFilters(await loadAllCases(), filters, now);
    res.json({ total: matched.length, cases: matched.slice(0, 100).map((c) => listItem(c, now)) });
  } catch (err) {
    next(err);
  }
});

// Same filters as the list, with every matching case, as a spreadsheet file.
router.get('/cases.csv', async (req, res, next) => {
  try {
    const filters = filterSchema.parse(req.query);
    const now = new Date();
    const matched = applyFilters(await loadAllCases(), filters, now);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="aicte-cases.csv"');
    res.send(toCsv(CASE_HEADERS, matched.map((c) => caseRow(c, now))));
  } catch (err) {
    next(err);
  }
});

export default router;
