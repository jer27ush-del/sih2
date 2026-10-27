import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { signToken, requireAuth } from '../lib/auth.js';

const router = Router();
const userInclude = { institution: true, bureau: true };

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Institution ID or email is required'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  aicteId: z.string().trim().min(1, 'Institution ID is required').max(40),
  name: z.string().trim().min(2, 'Contact name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    institution: user.institution
      ? { id: user.institution.id, aicteId: user.institution.aicteId, name: user.institution.name }
      : null,
    bureau: user.bureau ? { id: user.bureau.id, code: user.bureau.code, name: user.bureau.name } : null,
  };
}

// Accepts an email (any role) or an AICTE Permanent ID (institution login).
async function findLoginUser(identifier) {
  if (identifier.includes('@')) {
    return prisma.user.findUnique({
      where: { email: identifier.toLowerCase() },
      include: userInclude,
    });
  }
  const institution = await prisma.institution.findUnique({ where: { aicteId: identifier } });
  if (!institution) return null;
  return prisma.user.findFirst({
    where: { institutionId: institution.id, role: 'INSTITUTION' },
    include: userInclude,
  });
}

router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password } = loginSchema.parse(req.body);
    const user = await findLoginUser(identifier);
    const valid = user && (await bcrypt.compare(password, user.passwordHash));
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// Institutions self-register only if AICTE has already recorded them.
router.post('/register', async (req, res, next) => {
  try {
    const { aicteId, name, email, password } = registerSchema.parse(req.body);

    const institution = await prisma.institution.findUnique({ where: { aicteId } });
    if (!institution) {
      return res.status(404).json({ error: 'This Institution ID is not in AICTE records' });
    }

    const alreadyRegistered = await prisma.user.findFirst({
      where: { institutionId: institution.id, role: 'INSTITUTION' },
    });
    if (alreadyRegistered) {
      return res.status(409).json({ error: 'This institution already has an account. Please log in.' });
    }

    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) return res.status(409).json({ error: 'This email is already registered' });

    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: 'INSTITUTION',
        passwordHash: await bcrypt.hash(password, 10),
        institutionId: institution.id,
      },
      include: userInclude,
    });

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub }, include: userInclude });
    if (!user) return res.status(401).json({ error: 'Account no longer exists' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
