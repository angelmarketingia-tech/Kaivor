#!/bin/bash

echo "🚀 Starting ADMIA setup..."

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Create environment files
echo ""
echo "📝 Creating environment files..."

cat > backend/.env << 'EOF'
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
EOF

cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001
EOF

echo "✅ Environment files created"

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd backend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install backend dependencies"
    exit 1
fi
cd ..
echo "✅ Backend dependencies installed"

# Install frontend dependencies
echo ""
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi
cd ..
echo "✅ Frontend dependencies installed"

# Start Docker containers
echo ""
echo "🐳 Starting Docker containers..."
docker-compose up -d
if [ $? -ne 0 ]; then
    echo "❌ Failed to start Docker containers"
    exit 1
fi
echo "✅ Docker containers started"

# Wait for services to be ready
echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Run Prisma migrations
echo ""
echo "🗄️ Running database migrations..."
cd backend
npx prisma migrate deploy
if [ $? -ne 0 ]; then
    echo "❌ Failed to run migrations"
    exit 1
fi
cd ..
echo "✅ Database migrations completed"

# Seed database
echo ""
echo "🌱 Seeding database with test data..."
cd backend
npx prisma db seed 2>/dev/null
cd ..

# Install Cypress
echo ""
echo "🧪 Installing Cypress for E2E tests..."
npm install --save-dev cypress
echo "✅ Cypress installed"

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Backend: cd backend && npm run dev"
echo "2. Frontend: cd frontend && npm run dev"
echo "3. E2E Tests: npx cypress open"
echo ""
echo "🌐 Access the application at: http://localhost:3000"
