// Run with the API started (npm run dev). Checks logins, access rules, and that
// the officer and admin views return data. Usage: npm run smoke
const BASE = process.env.SMOKE_BASE || 'http://localhost:4000';
const PASSWORD = 'Password@123';
let failures = 0;

function report(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
}

async function call(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function login(identifier) {
  const r = await call('/auth/login', { method: 'POST', body: { identifier, password: PASSWORD } });
  return { token: r.data.token ?? null, user: r.data.user ?? null };
}

async function main() {
  const health = await call('/health');
  report('API is up and the database answers', health.status === 200 && health.data.database === 'ok', `HTTP ${health.status}`);
  if (health.status !== 200) {
    console.log('\nStop here: start the app with npm run dev, then run this again.');
    process.exitCode = 1;
    return;
  }

  const accounts = {
    admin: 'admin@aicte.test',
    rb: 'rb.officer@aicte.test',
    pgrc: 'pgrc.officer@aicte.test',
    asc: 'asc.officer@aicte.test',
    adm: 'adm.officer@aicte.test',
    institution: 'abc@college.test',
  };
  const session = {};
  for (const [key, id] of Object.entries(accounts)) {
    session[key] = await login(id);
    report(`login as ${id}`, Boolean(session[key].token));
  }

  const badLogin = await call('/auth/login', { method: 'POST', body: { identifier: 'admin@aicte.test', password: 'wrong-password' } });
  report('wrong password is refused', badLogin.status === 401, `HTTP ${badLogin.status}`);

  const anonymous = await call('/officer/queue');
  report('officer queue needs a login', anonymous.status === 401, `HTTP ${anonymous.status}`);

  report('ADM officer is linked to the Administration cell', session.adm.user?.bureau?.code === 'ADM');

  const adminMonitor = await call('/monitor/cases', { token: session.admin.token });
  const rbMonitor = await call('/monitor/cases', { token: session.rb.token });
  report('admin Monitor loads', adminMonitor.status === 200, `${adminMonitor.data.total} cases`);
  report('RB Monitor shows the same cases as admin (all cells)', rbMonitor.data.total === adminMonitor.data.total, `RB ${rbMonitor.data.total}, admin ${adminMonitor.data.total}`);

  const instMonitor = await call('/monitor/cases', { token: session.institution.token });
  report('institution is blocked from Monitor', instMonitor.status === 403, `HTTP ${instMonitor.status}`);

  const instList = await call('/complaints', { token: session.institution.token });
  report('institution can list its own complaints', instList.status === 200 && Array.isArray(instList.data.complaints));

  const rbQueue = await call('/officer/queue', { token: session.rb.token });
  report('RB queue has High, Medium, Low columns', rbQueue.status === 200 && 'HIGH' in rbQueue.data.queues && 'LOW' in rbQueue.data.queues);

  const report2 = await call('/analytics/report', { token: session.admin.token });
  report('analytics report loads', report2.status === 200 && Array.isArray(report2.data.bureaus));

  const forecast = await call('/analytics/forecast?volumeChange=20&capacity=15', { token: session.admin.token });
  report('what-if forecast returns cells', forecast.status === 200 && Array.isArray(forecast.data.cells));

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed. Send this output to the developer.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('Smoke test could not run:', err.message);
  process.exitCode = 1;
});
