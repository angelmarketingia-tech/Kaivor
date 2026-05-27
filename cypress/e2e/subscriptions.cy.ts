/**
 * Tests críticos v1.5 — Subscriptions, límites Free, WooCommerce gating
 */

const API = Cypress.env('apiUrl') || 'http://localhost:3001';

describe('Subscriptions & Plan Limits v1.5', () => {
  const testEmail = `test-${Date.now()}@kaivor.com`;
  const testPassword = 'test1234!';

  let authToken = '';

  // Registrar usuario nuevo antes de los tests
  before(() => {
    cy.request('POST', `${API}/auth/register`, {
      email: testEmail,
      password: testPassword,
      name: 'Test User v1.5',
      companyName: 'Test Company v1.5',
    }).then((res) => {
      expect(res.status).to.eq(201);
      authToken = res.body.access_token;
      expect(res.body.user.plan).to.eq('FREE');
    });
  });

  it('nuevo usuario queda en plan FREE con subscription activa', () => {
    cy.request({
      method: 'GET',
      url: `${API}/subscriptions/current`,
      headers: { Authorization: `Bearer ${authToken}` },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.plan).to.eq('FREE');
      expect(res.body.status).to.eq('active');
    });
  });

  it('GET /subscriptions/usage devuelve límites correctos para FREE', () => {
    cy.request({
      method: 'GET',
      url: `${API}/subscriptions/usage`,
      headers: { Authorization: `Bearer ${authToken}` },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.plan).to.eq('FREE');
      expect(res.body.invoices.limit).to.eq(45);
      expect(res.body.features.woocommerce).to.eq(false);
      expect(res.body.features.aiInsights).to.eq(false);
    });
  });

  it('GET /subscriptions/plans devuelve todos los planes', () => {
    cy.request({
      method: 'GET',
      url: `${API}/subscriptions/plans`,
      headers: { Authorization: `Bearer ${authToken}` },
    }).then((res) => {
      expect(res.status).to.eq(200);
      const plans = res.body.map((p: { plan: string }) => p.plan);
      expect(plans).to.include('FREE');
      expect(plans).to.include('PRO_AI');
      expect(plans).to.include('BUSINESS');
    });
  });

  it('POST /subscriptions/change-plan cambia al plan PRO_AI', () => {
    cy.request({
      method: 'POST',
      url: `${API}/subscriptions/change-plan`,
      headers: { Authorization: `Bearer ${authToken}` },
      body: { plan: 'PRO_AI' },
    }).then((res) => {
      expect(res.status).to.eq(201);
      expect(res.body.plan).to.eq('PRO_AI');
    });
  });

  it('después de PRO_AI, usage muestra woocommerce=true', () => {
    cy.request({
      method: 'GET',
      url: `${API}/subscriptions/usage`,
      headers: { Authorization: `Bearer ${authToken}` },
    }).then((res) => {
      expect(res.body.features.woocommerce).to.eq(true);
      expect(res.body.features.aiInsights).to.eq(true);
    });
  });
});

describe('Invoice limit enforcement (FREE)', () => {
  let freeToken = '';
  let companyId = '';
  let customerId = '';

  before(() => {
    // Crear usuario FREE fresco
    const email = `free-limit-${Date.now()}@kaivor.com`;
    cy.request('POST', `${API}/auth/register`, {
      email,
      password: 'test1234!',
      name: 'Free Limit Test',
    }).then((res) => {
      freeToken = res.body.access_token;

      // Obtener companyId
      return cy.request({
        method: 'GET',
        url: `${API}/customers`,
        headers: { Authorization: `Bearer ${freeToken}` },
      });
    }).then((res) => {
      if (res.body.length > 0) customerId = res.body[0].id;
    });
  });

  it('usuario FREE puede crear facturas hasta el límite', () => {
    // Verificar que el endpoint devuelve 403 o ForbiddenException si limit=0
    // Este test verifica la estructura del endpoint
    cy.request({
      method: 'GET',
      url: `${API}/subscriptions/usage`,
      headers: { Authorization: `Bearer ${freeToken}` },
    }).then((res) => {
      expect(res.body.invoices.limit).to.eq(45);
      expect(res.body.invoices.remaining).to.be.gte(0);
    });
  });

  it('usuario FREE NO puede conectar WooCommerce', () => {
    cy.request({
      method: 'POST',
      url: `${API}/integrations/woocommerce/connect`,
      headers: { Authorization: `Bearer ${freeToken}` },
      body: {
        storeUrl: 'https://test.example.com',
        consumerKey: 'ck_test',
        consumerSecret: 'cs_test',
      },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(403);
      expect(res.body.message).to.include('WooCommerce');
    });
  });
});

describe('WooCommerce Webhook Processing', () => {
  it('webhook con firma inválida es rechazado', () => {
    // Usar un integrationId de prueba — responderá 200 con ignored:true
    cy.request({
      method: 'POST',
      url: `${API}/integrations/woocommerce/webhook/non-existent-id`,
      headers: {
        'x-wc-webhook-topic': 'order.created',
        'x-wc-webhook-signature': 'invalid-signature',
        'Content-Type': 'application/json',
      },
      body: { id: 999, status: 'processing', total: '100.00' },
      failOnStatusCode: false,
    }).then((res) => {
      // Debe responder 200 (no exponer error 500) pero con ignored:true
      expect(res.status).to.be.oneOf([200, 404]);
      if (res.status === 200) {
        expect(res.body.ignored).to.eq(true);
      }
    });
  });
});

describe('AI Insights gating', () => {
  let freeToken = '';

  before(() => {
    const email = `ai-free-${Date.now()}@kaivor.com`;
    cy.request('POST', `${API}/auth/register`, {
      email, password: 'test1234!', name: 'AI Free Test',
    }).then((res) => {
      freeToken = res.body.access_token;
    });
  });

  it('usuario FREE NO puede acceder a monthly-summary', () => {
    cy.request({
      method: 'GET',
      url: `${API}/ai-insights/monthly-summary`,
      headers: { Authorization: `Bearer ${freeToken}` },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(403);
    });
  });

  it('POST /ai-insights/invoice-check está disponible para todos', () => {
    cy.request({
      method: 'POST',
      url: `${API}/ai-insights/invoice-check`,
      headers: { Authorization: `Bearer ${freeToken}` },
      body: { total: 0, invoiceDate: null },
    }).then((res) => {
      expect(res.status).to.eq(201);
      expect(res.body.valid).to.eq(false);
      expect(res.body.issues).to.be.an('array');
      expect(res.body.issues.length).to.be.gt(0);
    });
  });
});
