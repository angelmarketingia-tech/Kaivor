// KAIVOR v1.9 — E2E API suite. Verifies account scoping, payments, cron, HR,
// admin security against the live production deployment.
const BASE = 'https://kaivor.vercel.app/api';
let pass = 0, fail = 0;
const fails = [];

function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; fails.push(`${name} ${detail}`); console.log(`  ✗ ${name} ${detail}`); }
}
async function req(method, path, { token, body, accountId } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (accountId) headers['x-account-id'] = accountId;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

const run = async () => {
  const stamp = Date.now();
  console.log(`\n=== KAIVOR v1.9 E2E — ${new Date().toISOString()} ===\n`);

  // 1. Auth
  console.log('[1] Auth y seguridad');
  let r = await req('POST', '/auth/register', { body: { email: `v19_${stamp}@test.com`, password: 'Test1234!', name: 'V19 Tester', companyName: 'V19 SAS' } });
  check('register', r.status === 200 && !!r.data?.access_token);
  const token = r.data?.access_token;
  r = await req('POST', '/auth/login', { body: { email: `V19_${stamp}@TEST.COM`, password: 'Test1234!' } });
  check('login case-insensitive', r.status === 200 && !!r.data?.access_token);
  r = await req('GET', '/customers', {});
  check('ruta privada sin token → 401', r.status === 401);

  // 2. Account scoping — el riesgo crítico
  console.log('[2] Account scoping (aislamiento de datos)');
  r = await req('GET', '/accounts', { token });
  check('cuenta default auto-creada', r.status === 200 && Array.isArray(r.data?.accounts));
  // create two child accounts
  r = await req('POST', '/accounts', { token, body: { name: 'Sede A', type: 'sede' } });
  const accA = r.data?.id;
  r = await req('POST', '/accounts', { token, body: { name: 'Sede B', type: 'sede' } });
  const accB = r.data?.id;
  check('crear 2 cuentas hijas', !!accA && !!accB);

  // customer in A and B
  r = await req('POST', '/customers', { token, accountId: accA, body: { name: 'Cliente-A', taxId: `A-${stamp}` } });
  check('cliente creado en cuenta A', r.status === 201 && r.data?.accountId === accA);
  r = await req('POST', '/customers', { token, accountId: accB, body: { name: 'Cliente-B', taxId: `B-${stamp}` } });
  const custB = r.data?.id;
  check('cliente creado en cuenta B', r.status === 201 && r.data?.accountId === accB);

  // A must not see B's customer
  r = await req('GET', '/customers', { token, accountId: accA });
  const aNames = (r.data || []).map(c => c.name);
  check('lista cuenta A NO ve Cliente-B', !aNames.includes('Cliente-B') && aNames.includes('Cliente-A'));
  r = await req('GET', '/customers', { token, accountId: accB });
  const bNames = (r.data || []).map(c => c.name);
  check('lista cuenta B NO ve Cliente-A', !bNames.includes('Cliente-A') && bNames.includes('Cliente-B'));
  r = await req('GET', '/customers', { token });
  check('consolidado ve ambas cuentas', (r.data || []).some(c => c.name === 'Cliente-A') && (r.data || []).some(c => c.name === 'Cliente-B'));

  // by-ID strict: B's customer from account A → 404
  r = await req('GET', `/customers/${custB}`, { token, accountId: accA });
  check('detalle por ID cross-account → 404', r.status === 404);
  r = await req('GET', `/customers/${custB}`, { token, accountId: accB });
  check('detalle por ID misma cuenta → 200', r.status === 200);

  // 3. Payments — honest statuses
  console.log('[3] Pagos (sin falsos positivos)');
  r = await req('POST', '/customers', { token, accountId: accA, body: { name: 'PagoCliente', taxId: `P-${stamp}` } });
  const payCust = r.data?.id;
  // cash with change
  r = await req('POST', '/invoices', { token, accountId: accA, body: {
    customerId: payCust, items: [{ description: 'Item', quantity: 1, unitPrice: 100000, taxRate: 0 }],
    paymentMethod: 'cash', cashReceived: 150000 } });
  check('factura efectivo: cambio calculado', r.status === 201 && r.data?.changeGiven === 50000);
  check('factura efectivo: paymentStatus paid', r.data?.paymentStatus === 'paid');
  // nequi manual with reference
  r = await req('POST', '/invoices', { token, accountId: accA, body: {
    customerId: payCust, items: [{ description: 'Item', quantity: 1, unitPrice: 80000, taxRate: 0 }],
    paymentMethod: 'nequi', paymentReference: `NEQ-${stamp}` } });
  check('factura Nequi: registrada como pagada', r.status === 201 && r.data?.paymentStatus === 'paid');
  // addi → credit validation, NOT paid
  r = await req('POST', '/invoices', { token, accountId: accA, body: {
    customerId: payCust, items: [{ description: 'Item', quantity: 1, unitPrice: 900000, taxRate: 0 }],
    paymentMethod: 'addi', installments: 6 } });
  check('factura Addi: NO marcada pagada (crédito)', r.status === 201 && r.data?.paymentStatus === 'unpaid');
  // adapter test honest failure
  await req('PATCH', '/settings/payment-integrations', { token, body: { provider: 'addi', status: 'active' } });
  r = await req('POST', '/settings/payment-integrations', { token, body: { provider: 'addi' } });
  check('adapter Addi sin llaves → falla honesto', r.data?.ok === false);

  // 4. Cron
  console.log('[4] Cron y automatizaciones');
  r = await req('GET', '/cron/automations/run', {});
  check('cron sin secret → 401', r.status === 401);
  r = await req('POST', '/automations', { token, body: { name: 'Auto V19', trigger: 'invoice_overdue', actions: ['create_crm_activity'] } });
  const autoId = r.data?.id;
  check('crear automatización', r.status === 201 && !!autoId);
  r = await req('POST', `/automations/${autoId}/run`, { token, body: {} });
  check('ejecutar automatización manual', r.status === 200 && !!r.data?.summary);

  // 5. HR + scoping
  console.log('[5] HR y nómina');
  r = await req('POST', '/hr/employees', { token, accountId: accA, body: { firstName: 'Emp', lastName: 'CuentaA', salary: 1300000 } });
  const empA = r.data?.id;
  check('empleado creado en cuenta A', r.status === 201);
  r = await req('GET', '/hr/employees', { token, accountId: accB });
  check('empleados cuenta B NO ve empleado de A', !(r.data || []).some(e => e.id === empA));
  r = await req('GET', `/hr/employees/${empA}`, { token, accountId: accB });
  check('empleado por ID cross-account → 404', r.status === 404);

  // 6. Admin security
  console.log('[6] Seguridad /admin');
  r = await req('GET', '/admin/dashboard', { token });
  check('usuario normal en /admin → 403', r.status === 403);
  const adminLogin = await req('POST', '/auth/login', { body: { email: 'Angelmarketingia@gmail.com', password: 'Test1234!' } });
  const adminToken = adminLogin.data?.access_token;
  if (adminToken) {
    r = await req('GET', '/admin/dashboard', { token: adminToken });
    check('superadmin en /admin → 200', r.status === 200 && typeof r.data?.tenants?.total === 'number');
  } else {
    check('superadmin login', false, '(no se pudo loguear admin)');
  }

  console.log(`\n=== RESULTADO: ${pass} PASS / ${fail} FAIL ===`);
  if (fails.length) { console.log('FALLOS:'); fails.forEach(f => console.log('  - ' + f)); }
  process.exit(fail > 0 ? 1 : 0);
};
run().catch(e => { console.error('E2E crashed:', e); process.exit(1); });
