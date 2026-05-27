# ADMIA Setup Script for Windows

Write-Host "🚀 Starting ADMIA setup..." -ForegroundColor Green

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed. Please install Node.js 20+." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Prerequisites check passed" -ForegroundColor Green

# Create environment files
Write-Host "`n📝 Creating environment files..." -ForegroundColor Yellow

$backendEnv = @"
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://admia:admia_secure_password@localhost:5432/admia_db
JWT_SECRET=super_secret_jwt_key_change_in_production
REDIS_URL=redis://localhost:6379
DIAN_API_URL=https://vpfe.dian.gov.co/document/searchqr
DIAN_TEST_URL=https://vpfe-humano.dian.gov.co/document/searchqr
DIAN_CERTIFICATE_PATH=./certs/dian.p12
DIAN_CERTIFICATE_PASSWORD=password
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here
AWS_S3_BUCKET=admia-files
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
"@

$backendEnv | Out-File -FilePath "backend\.env" -Encoding UTF8

$frontendEnv = @"
NEXT_PUBLIC_API_URL=http://localhost:3001
"@

$frontendEnv | Out-File -FilePath "frontend\.env.local" -Encoding UTF8

Write-Host "✅ Environment files created" -ForegroundColor Green

# Install backend dependencies
Write-Host "`n📦 Installing backend dependencies..." -ForegroundColor Yellow
Set-Location backend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install backend dependencies" -ForegroundColor Red
    exit 1
}
Set-Location ..
Write-Host "✅ Backend dependencies installed" -ForegroundColor Green

# Install frontend dependencies
Write-Host "`n📦 Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location frontend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install frontend dependencies" -ForegroundColor Red
    exit 1
}
Set-Location ..
Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green

# Start Docker containers
Write-Host "`n🐳 Starting Docker containers..." -ForegroundColor Yellow
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start Docker containers" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker containers started" -ForegroundColor Green

# Wait for services to be ready
Write-Host "`n⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Run Prisma migrations
Write-Host "`n🗄️ Running database migrations..." -ForegroundColor Yellow
Set-Location backend
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to run migrations" -ForegroundColor Red
    exit 1
}
Set-Location ..
Write-Host "✅ Database migrations completed" -ForegroundColor Green

# Seed database (optional)
Write-Host "`n🌱 Seeding database with test data..." -ForegroundColor Yellow
Set-Location backend
npx prisma db seed 2>$null
Set-Location ..

# Install Cypress
Write-Host "`n🧪 Installing Cypress for E2E tests..." -ForegroundColor Yellow
npm install --save-dev cypress
Write-Host "✅ Cypress installed" -ForegroundColor Green

Write-Host "`n✅ Setup complete!" -ForegroundColor Green
Write-Host "`n📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Backend: npm run dev (in backend directory)"
Write-Host "2. Frontend: npm run dev (in frontend directory)"
Write-Host "3. E2E Tests: npx cypress open"
Write-Host "`n🌐 Access the application at: http://localhost:3000" -ForegroundColor Cyan
