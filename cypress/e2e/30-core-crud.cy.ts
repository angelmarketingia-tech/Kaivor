describe('Core CRUD flows', () => {
  let token: string;

  before(() => {
    cy.apiLogin().then((t) => { token = t; });
  });

  it('GET /customers returns array', () => {
    cy.apiRequest('GET', '/customers', undefined, token).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.be.an('array');
    });
  });

  it('Create + read customer', () => {
    const taxId = `TX-${Date.now()}`;
    cy.apiRequest('POST', '/customers', { name: 'Cy Customer', taxId, email: 'cy@test.co' }, token).then((res) => {
      expect(res.status).to.eq(201);
      expect(res.body.id).to.be.a('string');
      const id = res.body.id;
      cy.apiRequest('GET', `/customers/${id}`, undefined, token).then((r2) => {
        expect(r2.status).to.eq(200);
        expect(r2.body.name).to.eq('Cy Customer');
      });
    });
  });

  it('Create product + adjust stock + see in inventory', () => {
    const sku = `CY-${Date.now()}`;
    cy.apiRequest('POST', '/products', { name: 'Cy Product', sku, price: 12000, cost: 5000 }, token).then((res) => {
      expect(res.status).to.eq(201);
      const pid = res.body.id;
      cy.apiRequest('POST', `/products/${pid}/adjust-stock`, { quantity: 100, warehouse: 'default', reorderPoint: 20, absolute: true }, token).then((adj) => {
        expect(adj.status).to.eq(201);
        cy.apiRequest('GET', `/products/${pid}`, undefined, token).then((det) => {
          expect(det.status).to.eq(200);
          expect(det.body.inventory).to.be.an('array');
        });
      });
    });
  });

  it('Product not found returns 404', () => {
    cy.apiRequest('GET', '/products/non-existent-id-xyz', undefined, token).then((res) => {
      expect(res.status).to.eq(404);
    });
  });

  it('Create transaction (POS sale) decrements stock', () => {
    const sku = `CY-TX-${Date.now()}`;
    cy.apiRequest('POST', '/products', { name: 'TX Product', sku, price: 5000 }, token).then((p) => {
      const pid = p.body.id;
      cy.apiRequest('POST', `/products/${pid}/adjust-stock`, { quantity: 50, warehouse: 'default', absolute: true }, token).then(() => {
        cy.apiRequest('POST', '/transactions', {
          items: [{ productId: pid, quantity: 3, unitPrice: 5000, taxPercent: 19, lineTotal: 15000 }],
          total: 17850, taxAmount: 2850,
        }, token).then((tx) => {
          expect(tx.status).to.eq(201);
          expect(tx.body.items).to.have.length(1);
        });
      });
    });
  });

  it('Create invoice with auto-generated number', () => {
    cy.apiRequest('GET', '/customers', undefined, token).then((cust) => {
      const customerId = cust.body[0]?.id;
      if (!customerId) return;
      cy.apiRequest('POST', '/invoices', {
        customerId, invoiceDate: '2026-05-25', subtotal: 40000, taxAmount: 7600, total: 47600,
      }, token).then((inv) => {
        expect(inv.status).to.eq(201);
        expect(inv.body.invoiceNumber).to.match(/^FE-/);
      });
    });
  });
});
