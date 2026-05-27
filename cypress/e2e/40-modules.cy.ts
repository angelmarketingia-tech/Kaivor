describe('Module endpoints', () => {
  let token: string;
  before(() => { cy.apiLogin().then((t) => { token = t; }); });

  const endpoints: Array<{ method: string; path: string; body?: any; expected?: number[] }> = [
    { method: 'GET', path: '/hr/summary' },
    { method: 'GET', path: '/hr/employees' },
    { method: 'GET', path: '/hr/payroll' },
    { method: 'GET', path: '/hr/vacancies' },
    { method: 'GET', path: '/hr/balances' },
    { method: 'GET', path: '/settings/tenant' },
    { method: 'GET', path: '/settings/branding' },
    { method: 'GET', path: '/settings/payment-integrations' },
    { method: 'GET', path: '/messages' },
    { method: 'GET', path: '/messages/templates' },
    { method: 'GET', path: '/automations' },
    { method: 'GET', path: '/imports' },
    { method: 'GET', path: '/accounts' },
    { method: 'GET', path: '/events' },
    { method: 'GET', path: '/onboarding' },
    { method: 'GET', path: '/agents' },
    { method: 'GET', path: '/suppliers' },
    { method: 'GET', path: '/support/tickets' },
    { method: 'GET', path: '/dian/status' },
    { method: 'GET', path: '/inventory/alerts' },
    { method: 'GET', path: '/invoices/stats' },
    { method: 'GET', path: '/subscriptions/current' },
    { method: 'GET', path: '/subscriptions/usage' },
    { method: 'GET', path: '/ai-insights/recommendations' },
    { method: 'GET', path: '/integrations' },
    { method: 'GET', path: '/companies/my' },
    { method: 'POST', path: '/inventory/ask', body: { question: 'stock bajo' } },
    { method: 'POST', path: '/assistant/ask', body: { question: 'cuantas ventas' } },
    { method: 'POST', path: '/agents/sales/ask', body: { question: 'top customers' } },
  ];

  endpoints.forEach(({ method, path, body, expected = [200, 201] }) => {
    it(`${method} ${path} responds OK`, () => {
      cy.apiRequest(method, path, body, token).then((res) => {
        expect(expected).to.include(res.status);
      });
    });
  });
});
