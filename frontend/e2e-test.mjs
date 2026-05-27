// End-to-end test against the live Kaivor production deployment.
// Exercises every critical flow and reports PASS/FAIL.
const BASE = 'https://kaivor.vercel.app/api';
let pass = 0, fail = 0;
const fails = [];

function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; fails.push(`${name} ${detail}`); console.log(`  ✗ ${name} ${detail}`); }
}

async function req(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-json */ }
  return { status: res.status, data };
}

const run = async () => {
  const stamp = Date.now();
  const email = `e2e${stamp}@test.com`;
  console.log(`\n=== E2E Kaivor — ${new Date().toISOString()} ===`);
  console.log(`Tenant de prueba: ${email}\n`);

  // 1. Register
  console.log('[1] Auth');
  let r = await req('POST', '/auth/register', null, { email, password: 'Test1234!', name: 'E2E Tester', companyName: 'E2E SAS' });
  check('register', r.status === 200 && !!r.data?.access_token, `(status ${r.status})`);
  let token = r.data?.access_token;

  // 2. Login
  r = await req('POST', '/auth/login', null, { email, password: 'Test1234!' });
  check('login', r.status === 200 && !!r.data?.access_token, `(status ${r.status})`);
  token = r.data?.access_token || token;

  // 3. Subscription / usage
  console.log('[2] Suscripción');
  r = await req('GET', '/subscriptions/current', token);
  check('subscriptions/current', r.status === 200 && !!r.data?.plan);
  r = await req('GET', '/subscriptions/usage', token);
  check('subscriptions/usage shape', r.status === 200 && !!r.data?.invoices && typeof r.data.invoices.used === 'number');

  // 4. Company
  console.log('[3] Empresa');
  r = await req('GET', '/companies/my', token);
  check('companies/my', r.status === 200 && !!r.data?.id);

  // 5. Customer
  console.log('[4] Clientes');
  r = await req('POST', '/customers', token, { name: 'Cliente E2E', email: 'c@e2e.com', phone: '3001234567', taxId: `E2E-${stamp}` });
  check('create customer', r.status === 201 && !!r.data?.id, `(status ${r.status})`);
  const customerId = r.data?.id;
  r = await req('GET', '/customers', token);
  check('list customers', r.status === 200 && Array.isArray(r.data) && r.data.length > 0);

  // 6. Product
  console.log('[5] Productos');
  r = await req('POST', '/products', token, { name: 'Producto E2E', price: 50000, cost: 30000, category: 'Test' });
  check('create product', r.status === 201 && !!r.data?.id, `(status ${r.status})`);
  const productId = r.data?.id;

  // 7. Invoice
  console.log('[6] Facturación');
  r = await req('POST', '/invoices', token, {
    customerId,
    items: [{ productId, description: 'Producto E2E', quantity: 2, unitPrice: 50000, taxRate: 19, discountType: 'percent', discountValue: 10 }],
    paymentMethod: 'cash', cashReceived: 150000, notes: 'Factura E2E',
  });
  check('create invoice', r.status === 201 && !!r.data?.id, `(status ${r.status}) ${r.data?.message || ''}`);
  const invoiceId = r.data?.id;
  // Expected: subtotal 100000, disc 10000, tax 19% of 90000 = 17100, total 107100, change 42900
  check('invoice totals', r.data?.total === 107100 && r.data?.changeGiven === 42900, `(total ${r.data?.total}, change ${r.data?.changeGiven})`);
  check('invoice items', Array.isArray(r.data?.items) && r.data.items.length === 1);
  check('invoice payment', Array.isArray(r.data?.payments) && r.data.payments.length === 1);

  // 8. Invoice detail
  r = await req('GET', `/invoices/${invoiceId}`, token);
  check('invoice detail', r.status === 200 && r.data?.id === invoiceId && !!r.data?.customer && !!r.data?.company);

  // 9. WhatsApp
  r = await req('POST', `/invoices/${invoiceId}/send-whatsapp`, token, {});
  check('invoice send-whatsapp', r.status === 200 && (r.data?.waUrl || '').includes('wa.me'), `(status ${r.status})`);

  // 10. Print log
  r = await req('POST', `/invoices/${invoiceId}/print-log`, token, { type: 'receipt', paperSize: '80mm' });
  check('invoice print-log', r.status === 201 || r.status === 200);

  // 11. Invoice stats
  r = await req('GET', '/invoices/stats', token);
  check('invoices/stats shape', r.status === 200 && typeof r.data?.totalInvoices === 'number');

  // 12. Branding
  console.log('[7] Branding');
  r = await req('GET', '/settings/branding', token);
  check('branding GET', r.status === 200 && !!r.data?.primaryColor);
  r = await req('PATCH', '/settings/branding', token, { primaryColor: '#ff0000', invoiceTemplate: 'premium' });
  check('branding PATCH', r.status === 200 && r.data?.primaryColor === '#ff0000');
  r = await req('POST', '/settings/branding/ai-optimize', token, { width: 800, height: 200 });
  check('branding ai-optimize', r.status === 200 && !!r.data?.recommendation);

  // 13. Tenant settings
  console.log('[8] Integraciones');
  r = await req('GET', '/settings/tenant', token);
  check('tenant settings GET', r.status === 200 && 'waMode' in (r.data || {}));
  r = await req('PATCH', '/settings/tenant', token, { waBusinessPhone: '3009998888' });
  check('tenant settings PATCH', r.status === 200 && r.data?.waBusinessPhone === '3009998888');

  // 14. Message templates + send
  console.log('[9] Mensajería');
  r = await req('GET', '/messages/templates', token);
  check('message templates seeded', r.status === 200 && Array.isArray(r.data) && r.data.length >= 5);
  r = await req('POST', '/messages', token, { channel: 'whatsapp', customerId, destination: '3001234567', message: 'Hola E2E' });
  check('send whatsapp message', r.status === 200 && (r.data?.waUrl || '').includes('wa.me'));
  r = await req('GET', '/messages', token);
  check('messages list', r.status === 200 && Array.isArray(r.data) && r.data.length > 0);

  // 15. CRM 360
  console.log('[10] CRM 360');
  r = await req('GET', `/customers/${customerId}`, token);
  check('customer 360', r.status === 200 && !!r.data?.stats && !!r.data?.nextAction);
  check('customer 360 invoices', Array.isArray(r.data?.invoices) && r.data.invoices.length === 1);
  r = await req('POST', `/customers/${customerId}/notes`, token, { body: 'Nota E2E' });
  check('add customer note', r.status === 201 && !!r.data?.id);
  r = await req('PATCH', `/customers/${customerId}`, token, { vip: true });
  check('mark customer VIP', r.status === 200 && r.data?.vip === true);

  // 16. Product detail + inventory
  console.log('[11] Inventario');
  r = await req('GET', `/products/${productId}`, token);
  check('product detail', r.status === 200 && !!r.data?.stats);
  r = await req('POST', `/products/${productId}/adjust-stock`, token, { newQuantity: 100, reorderPoint: 20, notes: 'E2E' });
  check('adjust stock', r.status === 200 && r.data?.quantity === 100);
  r = await req('GET', '/inventory/alerts', token);
  check('inventory alerts', r.status === 200 && Array.isArray(r.data?.alerts));
  r = await req('POST', '/inventory/ask', token, { question: 'que debo reponer?' });
  check('inventory ask', r.status === 200 && !!r.data?.answer);

  // 17. Imports
  console.log('[12] Importación Excel');
  r = await req('POST', '/imports/preview', token, { entityType: 'customers', headers: ['Nombre', 'Correo', 'Celular', 'NIT'] });
  check('import preview mapping', r.status === 200 && r.data?.mapping?.name === 'Nombre' && r.data?.mapping?.taxId === 'NIT');
  r = await req('POST', '/imports/confirm', token, {
    entityType: 'products',
    mapping: { name: 'Nombre', price: 'Precio' },
    rows: [{ Nombre: 'Importado 1', Precio: '12000' }, { Nombre: 'Importado 2', Precio: '8000' }],
    fileName: 'e2e.xlsx',
  });
  check('import confirm', r.status === 200 && r.data?.imported === 2, `(imported ${r.data?.imported})`);
  r = await req('GET', '/imports', token);
  check('imports history', r.status === 200 && Array.isArray(r.data) && r.data.length > 0);

  // 18. Automations
  console.log('[13] Automatizaciones');
  r = await req('POST', '/automations', token, { name: 'Auto E2E', trigger: 'invoice_overdue', actions: ['create_crm_activity'] });
  check('create automation', r.status === 201 && !!r.data?.id);
  const autoId = r.data?.id;
  r = await req('POST', `/automations/${autoId}/run`, token, {});
  check('run automation', r.status === 200 && !!r.data?.summary);
  r = await req('PATCH', `/automations/${autoId}`, token, { status: 'paused' });
  check('pause automation', r.status === 200 && r.data?.status === 'paused');
  r = await req('GET', '/automations', token);
  check('automations list', r.status === 200 && Array.isArray(r.data));

  // 19. Agents
  console.log('[14] Agentes IA');
  r = await req('GET', '/agents', token);
  check('agents list', r.status === 200 && Array.isArray(r.data?.agents) && r.data.agents.length === 7);
  r = await req('POST', '/agents/configuracion/ask', token, { question: 'que me falta?' });
  check('agent configuracion (FREE-ok)', r.status === 200 && !!r.data?.answer);
  r = await req('POST', '/agents/inventario/ask', token, { question: 'stock?' });
  check('agent inventario gated (teaser on FREE)', r.status === 200 && r.data?.teaser === true, `(teaser=${r.data?.teaser})`);

  // 20. Onboarding
  console.log('[15] Onboarding');
  r = await req('GET', '/onboarding', token);
  check('onboarding checklist', r.status === 200 && Array.isArray(r.data?.steps) && r.data.steps.length === 9);
  check('onboarding detects progress', r.data?.completed >= 3, `(completed ${r.data?.completed})`);

  // 21. AI insights (FREE → 403 expected)
  console.log('[16] Kaivor AI (plan FREE)');
  r = await req('GET', '/ai-insights/monthly-summary', token);
  check('ai monthly-summary gated', r.status === 403 && !!r.data?.message, `(status ${r.status})`);
  r = await req('GET', '/ai-insights/recommendations', token);
  check('ai recommendations gated', r.status === 403, `(status ${r.status})`);

  // 22. Auth guard
  console.log('[17] Seguridad');
  r = await req('GET', '/invoices', null);
  check('unauthorized blocked', r.status === 401);
  r = await req('GET', `/invoices/${invoiceId}`, null);
  check('invoice detail requires auth', r.status === 401);

  console.log(`\n=== RESULTADO: ${pass} PASS / ${fail} FAIL ===`);
  if (fails.length) { console.log('FALLOS:'); fails.forEach(f => console.log('  - ' + f)); }
  process.exit(fail > 0 ? 1 : 0);
};

run().catch(e => { console.error('E2E crashed:', e); process.exit(1); });
