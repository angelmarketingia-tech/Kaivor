const API = Cypress.env('apiUrl') || 'http://localhost:3001';

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.request('POST', `${API}/auth/login`, { email, password }).then((res) => {
    window.localStorage.setItem('token', res.body.access_token);
    if (res.body.user) {
      window.localStorage.setItem('user', JSON.stringify(res.body.user));
    }
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
    }
  }
}

export {};
