Write-Host "🔍 ADMIA Setup Verification" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host ""

$checksPass = 0
$checksTotal = 0

# Function to check
function Check-Item {
    param(
        [string]$Name,
        [scriptblock]$Check
    )
    $checksTotal++
    try {
        if (& $Check) {
            Write-Host "✅ $Name" -ForegroundColor Green
            $checksPass++
        } else {
            Write-Host "❌ $Name" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ $Name - $_" -ForegroundColor Red
    }
}

# Checks
Check-Item "Node.js installed (v20+)" {
    $version = (node -v 2>$null)
    $version -match 'v2[0-9]'
}

Check-Item "npm installed" {
    npm -v >$null 2>&1
}

Check-Item "Docker installed" {
    docker --version >$null 2>&1
}

Check-Item "Docker daemon running" {
    docker ps >$null 2>&1
}

Check-Item "Backend directory exists" {
    Test-Path "C:\Users\PC GAMER\Desktop\ADMIA\backend"
}

Check-Item "Frontend directory exists" {
    Test-Path "C:\Users\PC GAMER\Desktop\ADMIA\frontend"
}

Check-Item "Backend package.json exists" {
    Test-Path "C:\Users\PC GAMER\Desktop\ADMIA\backend\package.json"
}

Check-Item "Frontend package.json exists" {
    Test-Path "C:\Users\PC GAMER\Desktop\ADMIA\frontend\package.json"
}

Check-Item "Prisma schema exists" {
    Test-Path "C:\Users\PC GAMER\Desktop\ADMIA\backend\prisma\schema.prisma"
}

Check-Item "Docker compose file exists" {
    Test-Path "C:\Users\PC GAMER\Desktop\ADMIA\docker-compose.yml"
}

Check-Item "README.md exists" {
    Test-Path "C:\Users\PC GAMER\Desktop\ADMIA\README.md"
}

Check-Item "E2E tests configured" {
    Test-Path "C:\Users\PC GAMER\Desktop\ADMIA\cypress.config.ts"
}

Write-Host ""
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host "Results: $checksPass / $checksTotal checks passed" -ForegroundColor Cyan

if ($checksPass -eq $checksTotal) {
    Write-Host ""
    Write-Host "✅ All checks passed! Ready to run setup.ps1" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Run: .\setup.ps1" -ForegroundColor White
    Write-Host "2. Wait for completion (~5 minutes)" -ForegroundColor White
    Write-Host "3. Open 3 terminal windows for:" -ForegroundColor White
    Write-Host "   - Backend: cd backend && npm run start:dev" -ForegroundColor White
    Write-Host "   - Frontend: cd frontend && npm run dev" -ForegroundColor White
    Write-Host "   - Tests: npx cypress open" -ForegroundColor White
    Write-Host "4. Access: http://localhost:3000" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Some checks failed. Please install missing prerequisites." -ForegroundColor Red
    Write-Host ""
    Write-Host "Required:" -ForegroundColor Yellow
    Write-Host "- Node.js 20+: https://nodejs.org" -ForegroundColor White
    Write-Host "- Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor White
}

Write-Host ""
