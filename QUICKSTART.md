# ADMIA Quick Start (5 Minutes)

## For Windows Users

### 1. Open PowerShell as Administrator

```powershell
cd "C:\Users\PC GAMER\Desktop\ADMIA"
.\setup.ps1
```

This script will:
- ✅ Check Docker and Node.js are installed
- ✅ Create environment files
- ✅ Install all dependencies
- ✅ Start Docker containers (PostgreSQL, Redis)
- ✅ Run database migrations
- ✅ Seed test data

### 2. Start Development Servers (3 separate PowerShell windows)

**Window 1 - Backend:**
```powershell
cd C:\Users\PC GAMER\Desktop\ADMIA\backend
npm run start:dev
```
Wait for: `[Nest] ... Nest application successfully started`

**Window 2 - Frontend:**
```powershell
cd C:\Users\PC GAMER\Desktop\ADMIA\frontend
npm run dev
```
Wait for: `▲ Next.js 15.0.0`

**Window 3 - Tests (optional):**
```powershell
cd C:\Users\PC GAMER\Desktop\ADMIA
npx cypress open
```

### 3. Access the Application

Open your browser:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Docs**: http://localhost:3001/api

### 4. Login with Test Account

Email: `test@example.com`
Password: `password123`

## For Linux/Mac Users

```bash
cd ~/Desktop/ADMIA
chmod +x setup.sh
./setup.sh
```

Then follow the same steps as Windows (start 3 development servers).

## What's Running?

| Service | Port | Status |
|---------|------|--------|
| PostgreSQL | 5432 | Docker |
| Redis | 6379 | Docker |
| Backend API | 3001 | `npm run start:dev` |
| Frontend | 3000 | `npm run dev` |

## Verify Everything Works

```bash
# Test API health
curl http://localhost:3001/health

# Should return:
# {"status":"ok","timestamp":"...","service":"ADMIA API","version":"1.0.0"}
```

## Run E2E Tests

```bash
# Start tests in interactive mode
npx cypress open

# Or run all tests headless
npx cypress run
```

Expected test results:
- ✅ Auth tests (login, register)
- ✅ Invoice tests (list, create)
- ✅ Dashboard navigation

## Troubleshooting

### "Port 3000 already in use"
```powershell
# Find process on port 3000
netstat -ano | findstr :3000

# Kill it
taskkill /PID <PID> /F
```

### "Docker containers failed"
```bash
docker-compose down
docker-compose up -d
```

### "Database migration failed"
```bash
cd backend
npx prisma migrate reset
npx prisma db seed
```

## Next Steps

1. ✅ Application is running locally
2. ✅ Tests are passing
3. 📖 Read [README.md](./README.md) for feature overview
4. 📚 Read [INSTALLATION.md](./INSTALLATION.md) for detailed setup
5. 🏗️ Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design

## File Structure Overview

```
ADMIA/
├── backend/              # NestJS API
│   ├── src/
│   │   ├── modules/     # Feature modules (auth, invoices, inventory, etc)
│   │   └── main.ts      # Entry point
│   └── package.json
├── frontend/            # Next.js App
│   ├── src/app/         # Pages (dashboard, invoices, etc)
│   └── package.json
├── cypress/             # E2E tests
├── docker-compose.yml   # Docker services
├── setup.ps1            # Setup script (Windows)
├── setup.sh             # Setup script (Linux/Mac)
└── README.md            # Full documentation
```

## Key Features Ready

✅ Multi-tenant architecture
✅ JWT authentication
✅ Electronic invoicing (DIAN-ready)
✅ Inventory management
✅ Transaction tracking
✅ Role-based access control
✅ Audit logging
✅ E2E tests

---

**Time to localhost**: ~5 minutes (depending on download speeds)

For detailed information, see [INSTALLATION.md](./INSTALLATION.md)
