const API = Cypress.env('apiUrl') || Cypress.env('API_URL') || 'https://kaivor-api.vercel.app';
const ADMIN_EMAIL = Cypress.env('ADMIN_EMAIL') || 'angelmarketingia@gmail.com';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || 'kaivor2026admin';

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.request('POST', `${API}/auth/login`, { email, password }).then((res) => {
    window.localStorage.setItem('token', res.body.access_token);
    if (res.body.user) {
      window.localStorage.setItem('user', JSON.stringify(res.body.user));
    }
  });
});

Cypress.Commands.add('apiLogin', (email = ADMIN_EMAIL, password = ADMIN_PASSWORD) => {
  return cy
    .request({
      method: 'POST',
      url: `${API}/auth/login`,
      body: { email, password },
      failOnStatusCode: false,
    })
    .then((res: any) => {
      if (res.status === 429) {
        cy.wait(35000);
        return cy.apiLogin(email, password);
      }
      expect(res.status).to.eq(201);
      return cy.wrap(res.body.access_token);
    });
});

Cypress.Commands.add('apiRequest', (method: string, path: string, body?: any, token?: string) => {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  return cy.request({
    method: method as any,
    url: `${API}${path}`,
    body,
    headers,
    failOnStatusCode: false,
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      apiLogin(email?: string, password?: string): Chainable<string>;
      apiRequest(method: string, path: string, body?: any, token?: string): Chainable<Cypress.Response<any>>;
    }
  }
}

export {};
