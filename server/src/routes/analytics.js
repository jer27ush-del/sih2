import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { complaintInclude, serializeComplaint } from '../lib/complaints.js';
import {
  ageingBuckets,
  bureauReport,
  forecast,
  monthlyTrend,
  overallReport,
  regionReport,
} from '../lib/analytics.js';

const router = Router();
router.use(requireAuth, requireRole('OFFICER', 'ADMIN'));

async function loadCases() {
  const rows = await prisma.complaint.findMany({ include: complaintInclude });
  return rows.map(serializeComplaint);
}

async function loadCells() {
  return prisma.bureau.findMany({ select: { code: true, name: true }, orderBy: { code: 'asc' } });
}

router.get('/report', async (req, res, next) => {
  try {
    const now = new Date();
    const [cases, cells] = await Promise.all([loadCases(), loadCells()]);
    res.json({
      overall: overallReport(cases, now),
      bureaus: bureauReport(cases, cells, now),
      regions: regionReport(cases, now),
      ageing: ageingBuckets(cases, now),
      trend: monthlyTrend(cases, now),
    });
  } catch (err) {
    next(err);
  }
});

const forecastSchema = z.object({
  volumeChange: z.coerce.number().min(-50).max(200).default(0),
  capacity: z.coerce.number().int().min(1).max(500).default(15),
});

router.get('/forecast', async (req, res, next) => {
  try {
    const { volumeChange, capacity } = forecastSchema.parse(req.query);
    const now = new Date();
    const [cases, cells] = await Promise.all([loadCases(), loadCells()]);
    res.json(forecast(cases, cells, now, { volumeChange, capacityPerCell: capacity }));
  } catch (err) {
    next(err);
  }
});

export default router;
