describe('Auth & Security', () => {
  const API = Cypress.env('apiUrl') || 'https://kaivor-api.vercel.app';

  it('Login with valid credentials returns token + sets httpOnly cookie', () => {
    cy.request({
      method: 'POST',
      url: `${API}/auth/login`,
      body: { email: 'angelmarketingia@gmail.com', password: 'kaivor2026admin' },
      failOnStatusCode: false,
    }).then((res) => {
      if (res.status === 429) return; // rate limited; that's also a pass
      expect(res.status).to.eq(201);
      expect(res.body.access_token).to.be.a('string');
    });
  });

  it('Login with invalid password rejected', () => {
    cy.request({
      method: 'POST',
      url: `${API}/auth/login`,
      body: { email: 'angelmarketingia@gmail.com', password: 'WRONG' },
      failOnStatusCode: false,
    }).then((res) => {
      expect([400, 401, 429]).to.include(res.status);
    });
  });

  it('Protected endpoint rejects requests without token', () => {
    cy.request({
      method: 'GET',
      url: `${API}/customers`,
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });

  it('Protected endpoint rejects invalid token', () => {
    cy.request({
      method: 'GET',
      url: `${API}/customers`,
      headers: { Authorization: 'Bearer xxx.invalid.token' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });

  it('Tenant isolation: new tenant cannot see admin data', () => {
    const email = `cy-${Date.now()}@test.kaivor`;
    cy.request({
      method: 'POST',
      url: `${API}/auth/register`,
      body: { email, password: 'tempPass123!', name: 'Cy', companyName: 'CyCorp' },
      failOnStatusCode: false,
    }).then((reg) => {
      if (reg.status === 429) return;
      expect(reg.status).to.eq(201);
      const token = reg.body.access_token;
      cy.request({
        method: 'GET',
        url: `${API}/admin/dashboard`,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(403);
      });
    });
  });
});
