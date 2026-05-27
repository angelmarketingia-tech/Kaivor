describe('Facturas', () => {
  beforeEach(() => {
    cy.login('test@example.com', 'password123');
    cy.visit('/invoices');
  });

  it('muestra la página de facturas', () => {
    cy.contains('Facturas').should('be.visible');
    cy.contains('Nueva factura').should('be.visible');
  });

  it('navega a /invoices/create al hacer clic en Nueva factura', () => {
    cy.contains('+ Nueva factura').click();
    cy.location('pathname').should('include', '/invoices/create');
  });

  it('muestra filtros de estado', () => {
    cy.contains('Todas').should('be.visible');
    cy.contains('Borrador').should('be.visible');
    cy.contains('Enviada').should('be.visible');
    cy.contains('Aceptada').should('be.visible');
  });

  it('muestra estado vacío cuando no hay facturas', () => {
    cy.contains(/Aún no tienes facturas|No hay facturas/).should('be.visible');
  });

  it('navega al dashboard desde el sidebar', () => {
    cy.get('nav').contains('Dashboard').click({ force: true });
    cy.location('pathname').should('include', '/dashboard');
  });
});

describe('Crear factura', () => {
  beforeEach(() => {
    cy.login('test@example.com', 'password123');
    cy.visit('/invoices/create');
  });

  it('muestra el wizard de creación', () => {
    cy.contains('Cliente').should('be.visible');
    cy.contains('Productos').should('be.visible');
    cy.contains('Revisión').should('be.visible');
  });

  it('muestra mensaje de límite alcanzado si aplica', () => {
    cy.get('body').then(($body) => {
      if ($body.text().includes('límite de facturas')) {
        cy.contains('límite de facturas').should('be.visible');
        cy.contains('Ver planes').should('be.visible');
      }
    });
  });
});
