describe('Authentication', () => {
  beforeEach(() => {
    cy.visit('/auth/login');
  });

  it('muestra la página de login con branding Kaivor', () => {
    cy.contains('Kaivor').should('be.visible');
    cy.get('input[type="email"]').should('be.visible');
    cy.get('input[type="password"]').should('be.visible');
    cy.get('button[type="submit"]').should('be.visible');
  });

  it('permite registrar un nuevo usuario', () => {
    cy.visit('/auth/register');
    cy.get('input[type="text"]').first().type('Test User');
    cy.get('input[type="email"]').type(`test-${Date.now()}@example.com`);
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').click();

    cy.location('pathname').should('include', '/dashboard');
  });

  it('permite iniciar sesión con credenciales válidas', () => {
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').click();

    cy.location('pathname').should('include', '/dashboard');
  });

  it('muestra error con credenciales inválidas', () => {
    cy.get('input[type="email"]').type('invalido@example.com');
    cy.get('input[type="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();

    cy.get('[class*="red"]').should('be.visible');
  });

  it('permite cerrar sesión', () => {
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').click();

    cy.contains('Cerrar sesión').click({ force: true });
    cy.location('pathname').should('include', '/auth/login');
  });
});
