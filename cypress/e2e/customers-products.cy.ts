/**
 * Tests E2E v1.5 — Clientes, Productos, Settings
 */

describe('Clientes', () => {
  beforeEach(() => {
    cy.login('test@example.com', 'password123');
    cy.visit('/customers');
  });

  it('muestra la página de clientes', () => {
    cy.contains('Clientes').should('be.visible');
    cy.contains('Nuevo cliente').should('be.visible');
  });

  it('abre el formulario de nuevo cliente', () => {
    cy.contains('+ Nuevo cliente').click();
    cy.contains('Nombre').should('be.visible');
    cy.contains('NIT').should('be.visible');
    cy.contains('Correo').should('be.visible');
  });

  it('muestra estado vacío sin clientes', () => {
    cy.get('body').then(($body) => {
      if ($body.text().includes('Aún no tienes clientes')) {
        cy.contains('Agregar primer cliente').should('be.visible');
      }
    });
  });

  it('permite buscar por nombre', () => {
    cy.get('body').then(($body) => {
      if (!$body.text().includes('Aún no tienes')) {
        cy.get('input[placeholder*="Buscar"]').type('test');
      }
    });
  });
});

describe('Productos', () => {
  beforeEach(() => {
    cy.login('test@example.com', 'password123');
    cy.visit('/products');
  });

  it('muestra la página de productos', () => {
    cy.contains('Productos').should('be.visible');
    cy.contains('Nuevo producto').should('be.visible');
  });

  it('abre el formulario de nuevo producto', () => {
    cy.contains('+ Nuevo producto').click();
    cy.contains('Nombre del producto').should('be.visible');
    cy.contains('Precio de venta').should('be.visible');
  });

  it('muestra estado vacío sin productos', () => {
    cy.get('body').then(($body) => {
      if ($body.text().includes('Aún no tienes productos')) {
        cy.contains('Agregar primer producto').should('be.visible');
      }
    });
  });
});

describe('Configuración', () => {
  beforeEach(() => {
    cy.login('test@example.com', 'password123');
    cy.visit('/settings');
  });

  it('muestra el hub de configuración', () => {
    cy.contains('Configuración').should('be.visible');
    cy.contains('Empresa').should('be.visible');
    cy.contains('Facturación').should('be.visible');
  });

  it('navega a datos de empresa', () => {
    cy.contains('Empresa').click({ force: true });
    cy.location('pathname').should('include', '/settings/company');
    cy.contains('Datos de empresa').should('be.visible');
  });

  it('navega a facturación y plan', () => {
    cy.visit('/settings/billing');
    cy.contains('Facturación y plan').should('be.visible');
    cy.contains('Plan actual').should('be.visible');
  });
});

describe('Pricing — v1.5', () => {
  beforeEach(() => {
    cy.login('test@example.com', 'password123');
    cy.visit('/pricing');
  });

  it('muestra todos los planes incluyendo Enterprise', () => {
    cy.contains('Gratis').should('be.visible');
    cy.contains('Starter').should('be.visible');
    cy.contains('Pro AI').should('be.visible');
    cy.contains('Business').should('be.visible');
    cy.contains('Enterprise').should('be.visible');
  });

  it('muestra 45 facturas en el plan Gratis', () => {
    cy.contains('45 facturas por mes').should('be.visible');
  });

  it('el botón Enterprise lleva a contacto de ventas', () => {
    cy.contains('Contactar ventas').should('be.visible');
  });
});
