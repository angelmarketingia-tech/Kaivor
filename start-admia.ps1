# ADMIA Auto-Start Script
Write-Host "🚀 Iniciando ADMIA..." -ForegroundColor Green

# 1. Verificar Docker
Write-Host "`n1️⃣ Verificando Docker..." -ForegroundColor Yellow
if (-not (docker ps >$null 2>&1)) {
    Write-Host "❌ Docker no está corriendo. Inicia Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker está corriendo" -ForegroundColor Green

# 2. Iniciar Docker Compose
Write-Host "`n2️⃣ Iniciando servicios Docker..." -ForegroundColor Yellow
cd "C:\Users\PC GAMER\Desktop\ADMIA"
docker-compose up -d
Start-Sleep -Seconds 3
Write-Host "✅ Servicios Docker iniciados" -ForegroundColor Green

# 3. Verificar Backend
Write-Host "`n3️⃣ Iniciando Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd 'C:\Users\PC GAMER\Desktop\ADMIA\backend'; npm run start:dev"
)
Start-Sleep -Seconds 5
Write-Host "✅ Backend iniciado (abre en otra ventana)" -ForegroundColor Green

# 4. Verificar Frontend dependencies
Write-Host "`n4️⃣ Verificando dependencias del Frontend..." -ForegroundColor Yellow
cd "C:\Users\PC GAMER\Desktop\ADMIA\frontend"
if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependencias..." -ForegroundColor Yellow
    npm install
}
Write-Host "✅ Dependencias OK" -ForegroundColor Green

# 5. Iniciar Frontend
Write-Host "`n5️⃣ Iniciando Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd 'C:\Users\PC GAMER\Desktop\ADMIA\frontend'; npm run dev"
)
Start-Sleep -Seconds 8

# 6. Abrir navegador
Write-Host "`n6️⃣ Abriendo navegador..." -ForegroundColor Yellow
Start-Process "http://localhost:3000"

Write-Host "`n✅ ADMIA está corriendo!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Credenciales: test@example.com / password123" -ForegroundColor Cyan
Write-Host "`nCierra esta ventana cuando termines." -ForegroundColor Yellow
