import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Password@123';
const daysFromNow = (n) => new Date(Date.now() + n * 86_400_000);

async function clear() {
  await prisma.action.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.complaintLink.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.user.deleteMany();
  await prisma.institution.deleteMany();
  await prisma.bureau.deleteMany();
}

// Adds demo accounts that are missing. Existing accounts are left unchanged.
async function ensureDemoAccounts() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const officers = [
    ['rb.officer@aicte.test', 'RB Officer', 'RB'],
    ['pgrc.officer@aicte.test', 'PGRC Officer', 'PGRC'],
    ['asc.officer@aicte.test', 'ASC Officer', 'ASC'],
    ['adm.officer@aicte.test', 'ADM Officer', 'ADM'],
  ];
  for (const [email, name, code] of officers) {
    const bureau = await prisma.bureau.findUnique({ where: { code } });
    if (!bureau) continue;
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, passwordHash, role: 'OFFICER', bureauId: bureau.id },
    });
  }
  await prisma.user.upsert({
    where: { email: 'admin@aicte.test' },
    update: {},
    create: { email: 'admin@aicte.test', name: 'AICTE Admin', passwordHash, role: 'ADMIN' },
  });
}

async function main() {
  const hasData = (await prisma.institution.count()) > 0;
  if (hasData) {
    await ensureDemoAccounts();
    console.log('Database already contains data, so sample complaints were not reloaded.');
    console.log('Demo officer and admin accounts were checked and added if missing.');
    console.log('To start over with sample complaints, run "npm run db:reset".');
    return;
  }
  await clear();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const bureauList = [
    { code: 'RB', name: 'Regulation Bureau' },
    { code: 'PGRC', name: 'Public Grievance Redressal Cell' },
    { code: 'ASC', name: 'Academic Standards Cell' },
    { code: 'ADM', name: 'Administration' },
  ];
  const bureaus = {};
  for (const b of bureauList) bureaus[b.code] = await prisma.bureau.create({ data: b });

  const instList = [
    { aicteId: '1-1000000001', name: 'ABC Engineering College', region: 'South', address: 'Chennai, Tamil Nadu' },
    { aicteId: '1-1000000002', name: 'XYZ Institute of Technology', region: 'North', address: 'Lucknow, Uttar Pradesh' },
    { aicteId: '1-1000000003', name: 'DEF College of Management', region: 'West', address: 'Pune, Maharashtra' },
  ];
  const inst = {};
  for (const i of instList) inst[i.aicteId] = await prisma.institution.create({ data: i });

  // Institution login users (email is the login identifier)
  await prisma.user.create({
    data: {
      email: 'abc@college.test', passwordHash, name: 'ABC Admin Office', role: 'INSTITUTION',
      institutionId: inst['1-1000000001'].id,
    },
  });
  await prisma.user.create({
    data: {
      email: 'xyz@college.test', passwordHash, name: 'XYZ Admin Office', role: 'INSTITUTION',
      institutionId: inst['1-1000000002'].id,
    },
  });

  // AICTE officials
  await prisma.user.createMany({
    data: [
      { email: 'rb.officer@aicte.test', passwordHash, name: 'RB Officer', role: 'OFFICER', bureauId: bureaus.RB.id },
      { email: 'pgrc.officer@aicte.test', passwordHash, name: 'PGRC Officer', role: 'OFFICER', bureauId: bureaus.PGRC.id },
      { email: 'asc.officer@aicte.test', passwordHash, name: 'ASC Officer', role: 'OFFICER', bureauId: bureaus.ASC.id },
      { email: 'adm.officer@aicte.test', passwordHash, name: 'ADM Officer', role: 'OFFICER', bureauId: bureaus.ADM.id },
      { email: 'admin@aicte.test', passwordHash, name: 'AICTE Admin', role: 'ADMIN' },
    ],
  });

  // Complaints. ABC has two cases from different bureaus, which the overlap engine will flag.
  const complaints = [
    {
      caseId: 'CMP-2026-00124', inst: '1-1000000001', category: 'Academic',
      description: 'Shortfall in approved faculty against the AICTE norms.',
      priority: 'HIGH', status: 'IN_PROGRESS', dnaLabel: 'NEW_ISSUE', lead: 'PGRC', dueIn: 10,
      actions: [['SUBMITTED', 'ABC Admin Office', null], ['ASSIGNED', 'PGRC Officer', 'PGRC']],
    },
    {
      caseId: 'CMP-2026-00123', inst: '1-1000000001', category: 'Infrastructure',
      description: 'Laboratory facilities below the approved intake capacity.',
      priority: 'MEDIUM', status: 'IN_PROGRESS', dnaLabel: 'RELATED', lead: 'RB', dueIn: 14,
      actions: [['SUBMITTED', 'ABC Admin Office', null], ['ASSIGNED', 'RB Officer', 'RB']],
    },
    {
      caseId: 'CMP-2026-00122', inst: '1-1000000001', category: 'Examination',
      description: 'Delay in publishing the semester result.',
      priority: 'LOW', status: 'RESOLVED', dnaLabel: 'NEW_ISSUE', lead: 'ASC', dueIn: -2,
      actions: [['SUBMITTED', 'ABC Admin Office', null], ['ASSIGNED', 'ASC Officer', 'ASC'], ['RESOLVED', 'ASC Officer', 'ASC']],
    },
    {
      caseId: 'CMP-2026-00131', inst: '1-1000000002', category: 'Academic',
      description: 'Unapproved change in the course curriculum.',
      priority: 'HIGH', status: 'SUBMITTED', dnaLabel: 'NEW_ISSUE', lead: null, dueIn: 12,
      actions: [['SUBMITTED', 'XYZ Admin Office', null]],
    },
    {
      caseId: 'CMP-2026-00140', inst: '1-1000000003', category: 'Infrastructure',
      description: 'Hostel safety issues reported by students.',
      priority: 'HIGH', status: 'PENDING', dnaLabel: 'NEW_ISSUE', lead: 'RB', dueIn: -3,
      actions: [['SUBMITTED', 'DEF Admin Office', null], ['ASSIGNED', 'RB Officer', 'RB']],
    },
  ];

  for (const c of complaints) {
    const created = await prisma.complaint.create({
      data: {
        caseId: c.caseId,
        institutionId: inst[c.inst].id,
        category: c.category,
        description: c.description,
        priority: c.priority,
        status: c.status,
        dnaLabel: c.dnaLabel,
        leadBureauId: c.lead ? bureaus[c.lead].id : null,
        dueDate: daysFromNow(c.dueIn),
      },
    });
    for (const [type, actorName, bureauCode] of c.actions) {
      await prisma.action.create({
        data: {
          complaintId: created.id,
          type,
          actorName,
          bureauId: bureauCode ? bureaus[bureauCode].id : null,
        },
      });
    }
  }

  const counts = {
    bureaus: await prisma.bureau.count(),
    institutions: await prisma.institution.count(),
    users: await prisma.user.count(),
    complaints: await prisma.complaint.count(),
    actions: await prisma.action.count(),
  };
  console.log('Seed complete:', counts);
  console.log(`Demo login password for all seeded users: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
