# ADMIA Installation Guide

Complete guide to set up ADMIA for local development and testing.

## System Requirements

- **Node.js**: 20+ 
- **Docker Desktop**: Latest version
- **RAM**: 4GB minimum (8GB recommended)
- **Disk Space**: 5GB for dependencies and Docker images

## Step 1: Clone and Navigate

```bash
git clone https://github.com/your-org/admia.git
cd ADMIA
```

## Step 2: Automated Setup

### Windows
```powershell
.\setup.ps1
```

### Linux / Mac
```bash
chmod +x setup.sh
./setup.sh
```

## Step 3: Manual Setup (If Automated Script Fails)

### 3.1 Create Environment Files

**backend/.env**
```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://admia:admia_secure_password@localhost:5432/admia_db
JWT_SECRET=super_secret_jwt_key_change_in_production
REDIS_URL=redis://localhost:6379
DIAN_API_URL=https://vpfe.dian.gov.co/document/searchqr
DIAN_TEST_URL=https://vpfe-humano.dian.gov.co/document/searchqr
```

**frontend/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3.2 Install Dependencies

```bash
# Backend
cd backend
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..
```

### 3.3 Start Docker Services

```bash
docker-compose up -d
```

Wait 10 seconds for services to fully start.

### 3.4 Run Database Migrations

```bash
cd backend
npx prisma migrate deploy
npx prisma db seed
cd ..
```

## Step 4: Start Development Servers

Open **3 terminal windows**:

**Terminal 1 - Backend API**
```bash
cd backend
npm run start:dev
```
API runs on: http://localhost:3001

**Terminal 2 - Frontend App**
```bash
cd frontend
npm run dev
```
App runs on: http://localhost:3000

**Terminal 3 - Optional: E2E Testing**
```bash
npx cypress open
```

## Step 5: Verify Installation

### Backend Health Check
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "service": "ADMIA API",
  "version": "1.0.0"
}
```

### Frontend Access
Open http://localhost:3000 in your browser

### Test Login
- Email: `test@example.com`
- Password: `password123`

## Troubleshooting

### Docker Containers Won't Start
```bash
# Check Docker status
docker ps

# View logs
docker-compose logs

# Restart services
docker-compose down
docker-compose up -d
```

### Database Connection Error
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check database exists
docker-compose exec postgres psql -U admia -d admia_db -c "\dt"
```

### Port Already in Use
If port 3000, 3001, 5432, or 6379 are already in use:

```bash
# Windows - Kill process on port
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac - Kill process on port
lsof -ti:3001 | xargs kill -9
```

### Node Modules Issues
```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Prisma Migration Failed
```bash
cd backend

# Reset database (WARNING: Deletes all data)
npx prisma migrate reset

# Then seed again
npx prisma db seed
```

## Running E2E Tests

### Interactive Mode
```bash
npx cypress open
```

### Headless Mode
```bash
npx cypress run
```

### Run Specific Test File
```bash
npx cypress run --spec "cypress/e2e/auth.cy.ts"
```

## Database Access

Connect to PostgreSQL directly:
```bash
docker-compose exec postgres psql -U admia -d admia_db
```

View tables:
```sql
\dt
```

View migrations:
```sql
SELECT * FROM _prisma_migrations;
```

## Redis Access

Connect to Redis:
```bash
docker-compose exec redis redis-cli
```

## Stopping Services

```bash
# Stop all containers
docker-compose down

# Stop and remove volumes (WARNING: Deletes database)
docker-compose down -v
```

## Development Tips

### Hot Reload
Both backend and frontend support hot reload during development.

### Database Inspection
```bash
cd backend
npx prisma studio
```
Opens interactive database GUI at http://localhost:5555

### API Documentation
Visit http://localhost:3001/api for Swagger documentation

### TypeScript Checking
```bash
cd backend
npm run lint

cd ../frontend
npm run lint
```

## Production Build

### Build Backend
```bash
cd backend
npm run build
npm run start:prod
```

### Build Frontend
```bash
cd frontend
npm run build
npm start
```

### Docker Production Build
```bash
docker-compose -f docker-compose.yml up -d
```

## Performance Optimization

### Clear Docker Cache
```bash
docker system prune -a
```

### Optimize Database
```bash
docker-compose exec postgres psql -U admia -d admia_db -c "VACUUM ANALYZE;"
```

## Support

For issues, check:
1. Backend logs: `docker-compose logs backend`
2. Frontend console: Browser DevTools (F12)
3. Database logs: `docker-compose logs postgres`

---

**Next Steps**: Read README.md for feature overview and API documentation.
