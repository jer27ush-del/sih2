import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { HttpError } from '../lib/errors.js';
import { complaintInclude, serializeComplaint } from '../lib/complaints.js';
import { accessFor, canViewComplaint, groupByPriority, routingOf, sortForQueue } from '../lib/routing.js';
import { allowedActionsFor, pendingHandoff } from '../lib/workflow.js';
import { needsAttention } from '../lib/attention.js';

const router = Router();
router.use(requireAuth, requireRole('OFFICER', 'ADMIN'));

const ACTIVE_ACCESS = ['LEAD', 'SUPPORT', 'ADMIN'];

async function currentOfficer(req) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { id: true, name: true, role: true, bureau: { select: { id: true, code: true, name: true } } },
  });
  if (!user) throw new HttpError(401, 'Account no longer exists');
  return user;
}

async function loadVisibleComplaint(officer, caseId) {
  const row = await prisma.complaint.findUnique({ where: { caseId }, include: complaintInclude });
  const complaint = row ? serializeComplaint(row) : null;
  if (!complaint || !canViewComplaint(officer, routingOf(complaint))) {
    throw new HttpError(404, 'Complaint not found');
  }
  return complaint;
}

async function bureauCells() {
  return prisma.bureau.findMany({ select: { code: true, name: true }, orderBy: { code: 'asc' } });
}

function viewModel(officer, complaint, cells) {
  const routing = routingOf(complaint);
  return {
    ...complaint,
    routing,
    access: accessFor(officer, routing),
    handoff: pendingHandoff(complaint.actions),
    allowed: allowedActionsFor(officer, complaint),
    cells,
  };
}

async function detailFor(officer, caseId) {
  const complaint = await loadVisibleComplaint(officer, caseId);
  return viewModel(officer, complaint, await bureauCells());
}

// Used right after an action, so the actor sees the updated case even if it has left their cell.
async function detailAfterAction(officer, caseId) {
  const row = await prisma.complaint.findUnique({ where: { caseId }, include: complaintInclude });
  return viewModel(officer, serializeComplaint(row), await bureauCells());
}

router.get('/queue', async (req, res, next) => {
  try {
    const officer = await currentOfficer(req);
    const rows = await prisma.complaint.findMany({
      where: { status: { not: 'RESOLVED' } },
      include: complaintInclude,
      orderBy: { receivedAt: 'desc' },
    });

    const now = new Date();
    const all = rows
      .map(serializeComplaint)
      .map((c) => {
        const routing = routingOf(c);
        return {
          caseId: c.caseId,
          category: c.category,
          priority: c.priority,
          status: c.status,
          dnaLabel: c.dnaLabel,
          dueDate: c.dueDate,
          receivedAt: c.receivedAt,
          institution: c.institution,
          routing,
          access: accessFor(officer, routing),
          attention: needsAttention(officer, c, now),
        };
      })
      .filter((item) => item.access !== null);

    const active = all.filter((i) => ACTIVE_ACCESS.includes(i.access));
    const handedOff = all.filter((i) => i.access === 'HANDED_OFF');

    res.json({
      bureau: officer.bureau ?? null,
      total: active.length,
      queues: groupByPriority(sortForQueue(active)),
      handedOff: sortForQueue(handedOff),
      attention: sortForQueue(active.filter((i) => i.attention.length > 0)),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/complaints/:caseId', async (req, res, next) => {
  try {
    const officer = await currentOfficer(req);
    res.json({ complaint: await detailFor(officer, req.params.caseId) });
  } catch (err) {
    next(err);
  }
});

const actionSchema = z.object({
  action: z.enum(['REQUEST_INFO', 'TRANSFER', 'ACKNOWLEDGE', 'RESOLVE']),
  remarks: z.string().trim().max(1000).optional().default(''),
  targetBureau: z.string().optional(),
});

router.post('/complaints/:caseId/actions', async (req, res, next) => {
  try {
    const { action, remarks, targetBureau } = actionSchema.parse(req.body);
    const officer = await currentOfficer(req);
    const complaint = await loadVisibleComplaint(officer, req.params.caseId);

    if (!allowedActionsFor(officer, complaint).includes(action)) {
      throw new HttpError(403, 'This action is not available for this case right now');
    }
    if (action !== 'ACKNOWLEDGE' && remarks.length < 10) {
      throw new HttpError(400, 'Add remarks of at least 10 characters');
    }

    const actorBureauId = officer.bureau?.id ?? null;
    const fromCode = complaint.leadBureau?.code ?? 'unassigned';
    let step;

    if (action === 'TRANSFER') {
      const target = targetBureau ? await prisma.bureau.findUnique({ where: { code: targetBureau } }) : null;
      if (!target || target.code === complaint.leadBureau?.code) {
        throw new HttpError(400, 'Choose a different cell to transfer to');
      }
      step = {
        status: 'TRANSFERRED',
        type: 'TRANSFERRED',
        leadBureauId: target.id,
        bureauId: target.id,
        remarks: `Transferred from ${fromCode} to ${target.code}. ${remarks}`,
      };
    } else if (action === 'REQUEST_INFO') {
      step = { status: 'PENDING', type: 'INFO_REQUESTED', bureauId: actorBureauId, remarks };
    } else if (action === 'ACKNOWLEDGE') {
      step = {
        status: 'IN_PROGRESS',
        type: 'ACKNOWLEDGED',
        bureauId: actorBureauId,
        remarks: remarks || `Handoff acknowledged by ${officer.bureau?.code ?? 'AICTE admin'}`,
      };
    } else {
      step = { status: 'RESOLVED', type: 'RESOLVED', bureauId: actorBureauId, remarks };
    }

    const row = await prisma.complaint.findUnique({ where: { caseId: req.params.caseId }, select: { id: true } });
    await prisma.$transaction([
      prisma.complaint.update({
        where: { id: row.id },
        data: {
          status: step.status,
          lastActionAt: new Date(),
          ...(step.leadBureauId ? { leadBureauId: step.leadBureauId } : {}),
        },
      }),
      prisma.action.create({
        data: {
          complaintId: row.id,
          type: step.type,
          actorName: officer.name,
          bureauId: step.bureauId,
          remarks: step.remarks || null,
        },
      }),
    ]);

    res.json({ complaint: await detailAfterAction(officer, req.params.caseId) });
  } catch (err) {
    next(err);
  }
});

export default router;
