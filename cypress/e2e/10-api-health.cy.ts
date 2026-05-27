describe('API Health & Smoke', () => {
  const API = Cypress.env('apiUrl') || 'https://kaivor-api.vercel.app';

  it('GET /health responds OK', () => {
    cy.request(`${API}/health`).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.status).to.eq('ok');
    });
  });

  it('Backend service version exposed', () => {
    cy.request(`${API}/health`).its('body.service').should('include', 'admia');
  });
});
