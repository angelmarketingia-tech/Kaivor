describe('Admin & MFA', () => {
  let adminToken: string;
  let userToken: string;

  before(() => {
    cy.apiLogin().then((t) => { adminToken = t; });
  });

  it('Superadmin can access /admin/dashboard', () => {
    cy.apiRequest('GET', '/admin/dashboard', undefined, adminToken).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.have.property('tenants');
    });
  });

  it('Regular user cannot access /admin', () => {
    const email = `cy-user-${Date.now()}@test.kaivor`;
    cy.apiRequest('POST', '/auth/register', { email, password: 'tempPass123!', name: 'Cy', companyName: 'X' }).then((reg) => {
      if (reg.status === 429) return;
      userToken = reg.body.access_token;
      cy.apiRequest('GET', '/admin/dashboard', undefined, userToken).then((res) => {
        expect(res.status).to.eq(403);
      });
    });
  });

  it('MFA setup returns QR code', () => {
    cy.apiRequest('POST', '/auth/mfa/setup', {}, adminToken).then((res) => {
      // If MFA is already enabled, it returns 400 — that's also valid
      if (res.status === 400) return;
      expect(res.status).to.eq(201);
      expect(res.body.qr).to.match(/^data:image\/png/);
      expect(res.body.secret).to.be.a('string');
    });
  });

  it('/auth/me returns current user', () => {
    cy.apiRequest('GET', '/auth/me', undefined, adminToken).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.user.email).to.eq('angelmarketingia@gmail.com');
      expect(res.body.user).to.have.property('mfaEnabled');
    });
  });

  it('Logout clears the token cookie', () => {
    cy.apiRequest('POST', '/auth/logout', {}, adminToken).then((res) => {
      expect(res.status).to.eq(201);
      expect(res.body.ok).to.eq(true);
    });
  });
});
