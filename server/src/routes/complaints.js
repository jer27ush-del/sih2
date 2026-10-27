import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { HttpError } from '../lib/errors.js';
import { CATEGORIES, complaintInclude, nextCaseId, serializeComplaint, slaDays, suggestBureau } from '../lib/complaints.js';
import { DNA_WINDOW_DAYS, dnaLabelFor, findSimilar, hasOverlap } from '../lib/dna.js';
import { classifyPriority } from '../lib/priority.js';

const router = Router();
router.use(requireAuth, requireRole('INSTITUTION'));

const UPLOAD_DIR = fileURLToPath(new URL('../../uploads/', import.meta.url));
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_TYPES = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + ALLOWED_TYPES[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES[file.mimetype]) {
      return cb(new HttpError(400, 'Only PDF, JPG and PNG files are allowed'));
    }
    cb(null, true);
  },
});

function handleUpload(req, res, next) {
  upload.array('documents', 5)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Each file must be 5 MB or less' : 'Too many files attached';
      return next(new HttpError(400, message));
    }
    next(err);
  });
}

function removeUploadedFiles(req) {
  for (const file of req.files ?? []) fs.promises.unlink(file.path).catch(() => {});
}


async function currentInstitutionUser(req) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { id: true, name: true, institutionId: true },
  });
  if (!user?.institutionId) throw new HttpError(403, 'Institution account required');
  return user;
}

async function bureauFor(category) {
  if (!category) return null;
  return prisma.bureau.findUnique({
    where: { code: suggestBureau(category) },
    select: { id: true, code: true, name: true },
  });
}

// Existing complaints of this institution inside the DNA time window.
async function loadCandidates(institutionId) {
  const since = new Date(Date.now() - DNA_WINDOW_DAYS * 86_400_000);
  return prisma.complaint.findMany({
    where: { institutionId, receivedAt: { gte: since } },
    select: {
      id: true,
      caseId: true,
      category: true,
      description: true,
      status: true,
      leadBureau: { select: { code: true, name: true } },
    },
  });
}

function publicMatch(m) {
  return {
    caseId: m.caseId,
    label: m.label,
    score: m.score,
    status: m.status,
    leadBureau: m.leadBureau ? { code: m.leadBureau.code, name: m.leadBureau.name } : null,
  };
}

const suggestSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  description: z.string().optional().default(''),
});

// Priority, routed cell, and similar cases for the form preview.
router.post('/suggest', async (req, res, next) => {
  try {
    const { category, description } = suggestSchema.parse(req.body);
    const user = await currentInstitutionUser(req);
    const [verdict, bureau, candidates] = await Promise.all([
      classifyPriority({ category, description }),
      bureauFor(category),
      loadCandidates(user.institutionId),
    ]);

    const similar =
      category && description.trim() ? findSimilar(candidates, { category, description }) : [];

    res.json({
      priority: verdict.priority,
      reason: verdict.reason,
      source: verdict.source,
      slaDays: slaDays(verdict.priority),
      bureau: bureau ? { code: bureau.code, name: bureau.name } : null,
      similar: similar.map(publicMatch),
      overlap: hasOverlap(bureau?.code, similar),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const { institutionId } = await currentInstitutionUser(req);
    const rows = await prisma.complaint.groupBy({
      by: ['status'],
      where: { institutionId },
      _count: { _all: true },
    });
    const countFor = (statuses) =>
      rows.filter((r) => statuses.includes(r.status)).reduce((n, r) => n + r._count._all, 0);

    const overdue = await prisma.complaint.count({
      where: { institutionId, status: { not: 'RESOLVED' }, dueDate: { lt: new Date() } },
    });

    res.json({
      total: rows.reduce((n, r) => n + r._count._all, 0),
      pending: countFor(['SUBMITTED', 'PENDING']),
      inProgress: countFor(['IN_PROGRESS', 'TRANSFERRED']),
      resolved: countFor(['RESOLVED']),
      overdue,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { institutionId } = await currentInstitutionUser(req);
    const complaints = await prisma.complaint.findMany({
      where: { institutionId },
      include: complaintInclude,
      orderBy: { receivedAt: 'desc' },
    });
    res.json({ complaints: complaints.map(serializeComplaint) });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Select a category' }) }),
  description: z.string().trim().min(20, 'Describe the complaint in at least 20 characters').max(4000),
});

router.post('/', handleUpload, async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const user = await currentInstitutionUser(req);
    const verdict = await classifyPriority({ category: data.category, description: data.description });
    const bureau = await bureauFor(data.category);

    // DNA check against this institution's recent complaints.
    const candidates = await loadCandidates(user.institutionId);
    const matches = findSimilar(candidates, data);
    const dnaLabel = dnaLabelFor(matches);
    const overlap = hasOverlap(bureau?.code, matches);

    const actions = [
      {
        type: 'SUBMITTED',
        actorName: user.name,
        remarks: `Priority ${verdict.priority} (${verdict.source === 'ai' ? 'AI assessment' : 'rule-based'}): ${verdict.reason}`,
      },
    ];
    if (bureau) actions.push({ type: 'ASSIGNED', actorName: 'System', bureauId: bureau.id });
    actions.push({
      type: 'NOTE',
      actorName: 'DNA engine',
      remarks:
        matches.length === 0
          ? `DNA check: new issue. No similar complaints in the last ${DNA_WINDOW_DAYS} days.`
          : `DNA check: ${dnaLabel}. Similar to ${matches.map((m) => m.caseId).join(', ')}.` +
            (overlap ? ' Potential overlap with another cell.' : ''),
    });

    const complaint = await prisma.$transaction(async (tx) => {
      const caseId = await nextCaseId(tx);
      return tx.complaint.create({
        data: {
          caseId,
          institutionId: user.institutionId,
          category: data.category,
          description: data.description,
          priority: verdict.priority,
          status: 'SUBMITTED',
          dnaLabel,
          leadBureauId: bureau?.id ?? null,
          dueDate: new Date(Date.now() + slaDays(verdict.priority) * 86_400_000),
          actions: { create: actions },
          linksFrom: {
            create: matches.map((m) => ({ toId: m.id, relation: m.label })),
          },
          attachments: {
            create: (req.files ?? []).map((f) => ({
              fileName: f.originalname,
              mimeType: f.mimetype,
              sizeBytes: f.size,
              storagePath: f.filename,
            })),
          },
        },
        include: complaintInclude,
      });
    });

    res.status(201).json({ complaint: serializeComplaint(complaint) });
  } catch (err) {
    removeUploadedFiles(req);
    next(err);
  }
});

router.get('/:caseId', async (req, res, next) => {
  try {
    const { institutionId } = await currentInstitutionUser(req);
    const complaint = await prisma.complaint.findFirst({
      where: { caseId: req.params.caseId, institutionId },
      include: complaintInclude,
    });
    if (!complaint) throw new HttpError(404, 'Complaint not found');
    res.json({ complaint: serializeComplaint(complaint) });
  } catch (err) {
    next(err);
  }
});


const responseSchema = z.object({
  message: z.string().trim().min(10, 'Add at least 10 characters').max(2000, 'Keep the response under 2000 characters'),
});

// Institution answers a request for more information. The case returns to in progress.
router.post('/:caseId/response', async (req, res, next) => {
  try {
    const { message } = responseSchema.parse(req.body);
    const user = await currentInstitutionUser(req);
    const row = await prisma.complaint.findFirst({
      where: { caseId: req.params.caseId, institutionId: user.institutionId },
      select: { id: true, status: true },
    });
    if (!row) throw new HttpError(404, 'Complaint not found');
    if (row.status !== 'PENDING') throw new HttpError(400, 'No information has been requested for this complaint');

    await prisma.$transaction([
      prisma.complaint.update({
        where: { id: row.id },
        data: { status: 'IN_PROGRESS', lastActionAt: new Date() },
      }),
      prisma.action.create({
        data: { complaintId: row.id, type: 'NOTE', actorName: user.name, remarks: `Information provided: ${message}` },
      }),
    ]);

    const updated = await prisma.complaint.findUnique({ where: { id: row.id }, include: complaintInclude });
    res.json({ complaint: serializeComplaint(updated) });
  } catch (err) {
    next(err);
  }
});

export default router;
