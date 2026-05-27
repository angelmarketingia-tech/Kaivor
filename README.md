# ADMIA - Electronic Invoicing Platform for Colombian SMEs

ADMIA is a DIAN-compliant electronic invoicing (facturación electrónica) platform designed for small and medium-sized enterprises (SMEs) in Colombia. It provides integrated invoicing, inventory management, POS system, and advanced features with AI support.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker Desktop
- Git

### Setup (Windows)
```powershell
# Navigate to project directory
cd ADMIA

# Run setup script
.\setup.ps1
```

### Setup (Linux/Mac)
```bash
# Install dependencies
npm install --workspace=backend --workspace=frontend

# Start Docker containers
docker-compose up -d

# Run migrations
cd backend && npx prisma migrate deploy

# Seed database
npx prisma db seed
```

### Development

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 - E2E Tests:**
```bash
npx cypress open
```

Access the application at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Docs: http://localhost:3001/api

## 📚 Architecture

### Backend (NestJS)
- **Framework**: NestJS 10
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with Passport.js
- **Modules**:
  - Auth (authentication & authorization)
  - Tenants (multi-tenant management)
  - Users (user management with RBAC)
  - Customers (customer data)
  - Products (inventory items)
  - Inventory (stock management with audit trail)
  - Transactions (POS transactions)
  - Invoices (DIAN-compliant electronic invoicing)

### Frontend (Next.js 15)
- **Framework**: Next.js 15 with React 19
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Animations**: Framer Motion
- **Components**: ShadCN UI

### Database Schema
- **Multi-tenant isolation** with row-level security
- **Audit logging** for compliance
- **DIAN-specific fields** for electronic invoicing
- **Inventory movement tracking** for stock audits
- **Payment processing** for invoice settlements

## 🔐 Security Features

- Row-level security for tenant isolation
- Password hashing with bcrypt
- JWT token-based authentication
- Role-based access control (RBAC)
- Immutable audit logs
- Input validation with class-validator

## 📊 Features

### Core Invoicing (Phase 1)
- ✅ DIAN-compliant electronic invoicing
- ✅ Multi-tenant architecture
- ✅ User and role management
- ✅ Customer database
- ✅ Product catalog
- ✅ Inventory tracking
- ✅ Transaction management
- ✅ Payment tracking

### MVP Features (Phase 2)
- Invoice creation and management
- Inventory tracking with movements
- POS transaction support
- Customer management
- Basic reporting

### Future Features (Phase 3+)
- Mobile POS app (React Native)
- AI-powered insights (Claude API)
- Advanced reporting and analytics
- Payment gateway integration (Wompi)
- Offline-first sync
- Email notifications

## 🧪 Testing

### Unit Tests
```bash
cd backend
npm run test
npm run test:watch
```

### E2E Tests
```bash
npx cypress open        # Interactive mode
npx cypress run         # Headless mode
```

## 🐳 Docker

Start all services:
```bash
docker-compose up -d
```

Stop all services:
```bash
docker-compose down
```

View logs:
```bash
docker-compose logs -f
```

## 📁 Project Structure

```
ADMIA/
├── backend/              # NestJS backend
│   ├── src/
│   │   ├── modules/     # Feature modules
│   │   ├── prisma/      # Database config
│   │   └── main.ts      # Entry point
│   ├── prisma/          # Prisma schema & migrations
│   └── package.json
├── frontend/            # Next.js frontend
│   ├── src/
│   │   ├── app/         # Pages and layouts
│   │   ├── components/  # React components
│   │   └── lib/         # Utilities
│   └── package.json
├── cypress/             # E2E tests
├── docker-compose.yml   # Docker configuration
└── README.md
```

## 🚀 Deployment

### Docker Build
```bash
docker-compose build
docker-compose up -d
```

### Environment Variables
Copy `.env.example` to `.env` and update:
- `DATABASE_URL`: PostgreSQL connection
- `JWT_SECRET`: JWT signing key
- `REDIS_URL`: Redis connection
- `DIAN_API_URL`: DIAN API endpoint
- `DIAN_CERTIFICATE_PATH`: Path to DIAN certificate

## 📖 API Documentation

API endpoints are automatically documented with Swagger/OpenAPI.

Visit: `http://localhost:3001/api`

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/name`
2. Commit changes: `git commit -am 'Add feature'`
3. Push branch: `git push origin feature/name`
4. Open pull request

## 📝 License

This project is proprietary and confidential.

## 📧 Support

For support, email: support@admia.com

---

**Made with ❤️ for Colombian SMEs**
