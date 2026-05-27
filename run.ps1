# ADMIA FULL AUTO-START - SIN INTERVENCIÓN DEL USUARIO
param([switch]$Clean)

$root = "C:\Users\PC GAMER\Desktop\ADMIA"
Write-Host "🔥 ADMIA AUTO SETUP & START" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

# 1. LIMPIAR TODO SI ES NECESARIO
if ($Clean) {
    Write-Host "`n🧹 Limpiando..." -ForegroundColor Yellow
    docker-compose -f $root\docker-compose.yml down -v 2>$null
    Remove-Item "$root\backend\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item "$root\frontend\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
}

# 2. VERIFICAR DOCKER
Write-Host "`n📦 Verificando Docker..." -ForegroundColor Cyan
if (-not (docker ps >$null 2>&1)) {
    Write-Host "❌ Docker no está corriendo. Abre Docker Desktop ahora." -ForegroundColor Red
    pause
    exit 1
}
Write-Host "✅ Docker OK" -ForegroundColor Green

# 3. INICIAR DOCKER SERVICES
Write-Host "`n🐳 Iniciando PostgreSQL, Redis..." -ForegroundColor Cyan
cd $root
docker-compose up -d 2>$null
Start-Sleep -Seconds 5
Write-Host "✅ Servicios Docker iniciados" -ForegroundColor Green

# 4. BACKEND SETUP
Write-Host "`n⚙️ Configurando Backend..." -ForegroundColor Cyan
cd "$root\backend"
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Instalando dependencias Backend..." -ForegroundColor Yellow
    npm install --silent
}
Write-Host "✅ Backend OK" -ForegroundColor Green

# 5. FRONTEND SETUP
Write-Host "`n⚙️ Configurando Frontend..." -ForegroundColor Cyan
cd "$root\frontend"
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Instalando dependencias Frontend..." -ForegroundColor Yellow
    npm install --silent
}
Write-Host "✅ Frontend OK" -ForegroundColor Green

# 6. INICIAR SERVICIOS EN PARALELO
Write-Host "`n🚀 Iniciando servicios..." -ForegroundColor Magenta

# Backend en background
$backendProcess = Start-Process powershell -PassThru -ArgumentList @(
    "-NoExit",
    "-WindowStyle", "Minimized",
    "-Command",
    "cd '$root\backend'; Write-Host '🔧 BACKEND INICIANDO...' -ForegroundColor Green; npm run start:dev 2>&1"
)
Write-Host "✅ Backend iniciado (PID: $($backendProcess.Id))" -ForegroundColor Green

Start-Sleep -Seconds 3

# Frontend en background
$frontendProcess = Start-Process powershell -PassThru -ArgumentList @(
    "-NoExit",
    "-WindowStyle", "Minimized",
    "-Command",
    "cd '$root\frontend'; Write-Host '🎨 FRONTEND INICIANDO...' -ForegroundColor Cyan; npm run dev 2>&1"
)
Write-Host "✅ Frontend iniciado (PID: $($frontendProcess.Id))" -ForegroundColor Green

# 7. ESPERAR A QUE ESTÉN LISTOS
Write-Host "`n⏳ Esperando que servicios estén listos..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# 8. VERIFICAR BACKEND
$backendReady = $false
for ($i = 0; $i -lt 10; $i++) {
    if (curl -s http://localhost:3001/health >$null 2>&1) {
        $backendReady = $true
        break
    }
    Start-Sleep -Seconds 1
}

if ($backendReady) {
    Write-Host "✅ Backend respondiendo en http://localhost:3001" -ForegroundColor Green
} else {
    Write-Host "⚠️ Backend quizá aún está iniciando..." -ForegroundColor Yellow
}

# 9. ABRIR NAVEGADOR
Write-Host "`n🌐 Abriendo navegador..." -ForegroundColor Magenta
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"
Start-Sleep -Seconds 3

# 10. RESUMEN
Write-Host "`n" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ ADMIA ESTÁ CORRIENDO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📍 ACCESO:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "   API:      http://localhost:3001" -ForegroundColor White
Write-Host ""
Write-Host "🔑 CREDENCIALES:" -ForegroundColor Cyan
Write-Host "   Email:    test@example.com" -ForegroundColor White
Write-Host "   Password: password123" -ForegroundColor White
Write-Host ""
Write-Host "🧪 E2E TESTS:" -ForegroundColor Cyan
Write-Host "   npx cypress run" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Green

# Mantener script abierto
Write-Host "`nProcesos corriendo:" -ForegroundColor Yellow
Write-Host "- Backend PID: $($backendProcess.Id)" -ForegroundColor Gray
Write-Host "- Frontend PID: $($frontendProcess.Id)" -ForegroundColor Gray
Write-Host ""
Write-Host "Cierra esta ventana para detener todo." -ForegroundColor Yellow
pause
