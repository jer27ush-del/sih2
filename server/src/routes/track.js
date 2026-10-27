import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { complaintInclude, serializeComplaint } from '../lib/complaints.js';
import { trackView } from '../lib/plain.js';

const router = Router();

const trackSchema = z.object({
  caseId: z.string().trim().min(5, 'Enter the complaint ID').max(30),
  email: z.string().trim().toLowerCase().email('Enter the email address your institution registered with').max(254),
});

// Public lookup. The email must belong to a user of the institution that filed the complaint.
router.post('/', async (req, res, next) => {
  try {
    const { caseId, email } = trackSchema.parse(req.body);
    const row = await prisma.complaint.findUnique({
      where: { caseId: caseId.toUpperCase() },
      include: complaintInclude,
    });
    const owner = row
      ? await prisma.user.findFirst({
          where: { email, institutionId: row.institutionId, role: 'INSTITUTION' },
          select: { id: true },
        })
      : null;

    if (!row || !owner) {
      throw new HttpError(
        404,
        'We could not find a complaint with these details. Check the complaint ID and the email address, then try again.'
      );
    }
    res.json({ complaint: trackView(serializeComplaint(row)) });
  } catch (err) {
    next(err);
  }
});

export default router;
