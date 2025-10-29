# Resumate Production Deployment Guide

This guide covers deploying Resumate in production mode.

## Prerequisites

- Node.js 16+ 
- npm 8+
- PM2 (must be already installed globally)
- nginx (for reverse proxy)

**⚠️ IMPORTANT**: This deployment script is designed to work safely with existing PM2 processes. It will only manage `resumate-backend` and `resumate-frontend` processes without affecting your other PM2 services.

## Quick Production Deployment

### 1. Set Up Environment Variables (First Time Only)

```bash
# Copy example files to create production environment
cp apps/backend/.env.example apps/backend/.env.production
cp apps/frontend/.env.example apps/frontend/.env.production

# IMPORTANT: Edit the backend production environment
nano apps/backend/.env.production
# Change JWT_SECRET to a secure random string!
```

### 2. Run the Production Deployment Script

```bash
# Make sure you're in the project root
cd /Users/apple/Desktop/den/resumate

# Run the deployment script
./deploy-production.sh
```

This script will:
- ✅ Safely stop only Resumate PM2 processes (preserves your other services)
- ✅ Install dependencies
- ✅ Build all packages
- ✅ Set up production environment
- ✅ Start Resumate services with PM2
- ✅ Save PM2 configuration (includes all existing processes)

### 2. Access Your Application

- **Frontend**: http://localhost:3160
- **Backend API**: http://localhost:4300/api
- **Health Check**: http://localhost:4300/health

## Manual Deployment Steps

If you prefer manual deployment:

### 1. Install Dependencies & Build

```bash
# Install dependencies
npm install

# Build shared packages
npm run build:shared

# Build frontend
npm run build:frontend
```

### 2. Set Up Environment

```bash
# First time: Copy example files to create production environment
cp apps/backend/.env.example apps/backend/.env.production
cp apps/frontend/.env.example apps/frontend/.env.production

# IMPORTANT: Edit and secure the backend environment
nano apps/backend/.env.production
# Change JWT_SECRET to a secure random string!

# Then copy to active .env files
cp apps/backend/.env.production apps/backend/.env
cp apps/frontend/.env.production apps/frontend/.env
```

### 3. Start Services with PM2

```bash
# Start only Resumate services (safe for existing PM2 processes)
pm2 start ecosystem.config.js --env production

# Save PM2 configuration (preserves all existing processes)
pm2 save
```

**Note**: PM2 startup configuration is not modified since you already have it configured.

## PM2 Management Commands

### View Services
```bash
pm2 status          # View all processes
pm2 logs            # View logs from all processes
pm2 logs resumate-backend   # View backend logs only
pm2 logs resumate-frontend  # View frontend logs only
pm2 monit           # Real-time monitoring dashboard
```

### Control Services (Resumate Only)
```bash
# Restart only Resumate services (safe)
npm run pm2:restart

# Stop only Resumate services (safe)
npm run pm2:stop

# Delete only Resumate services (safe)
npm run pm2:delete

# Individual service control
pm2 restart resumate-backend
pm2 stop resumate-frontend
pm2 delete resumate-backend
```

**⚠️ Avoid using `pm2 [command] all` to prevent affecting your other services.**

### Zero-Downtime Deployment
```bash
# For updates, restart services one by one
pm2 restart resumate-backend
pm2 restart resumate-frontend
```

## Nginx Configuration (Optional)

If you want to serve the frontend through nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend static files
    location / {
        proxy_pass http://localhost:3160;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:4300;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Environment Variables

### Backend (.env.production)
```bash
PORT=4300
NODE_ENV=production
FRONTEND_URL=http://localhost:3160
DB_PATH=../../data/resumate.db
JWT_SECRET=CHANGE_THIS_TO_A_SECURE_RANDOM_STRING_IN_PRODUCTION
CORS_ORIGIN=http://localhost:3160
```

**⚠️ SECURITY**: Always change `JWT_SECRET` to a secure random string in production!

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:4300/api
NODE_ENV=production
```

## Database

The SQLite database is stored in `data/resumate.db` and will be created automatically on first run.

## Logs

PM2 logs are stored in:
- `logs/resumate-backend.log`
- `logs/resumate-frontend.log`

## Security Considerations

### 🔐 Environment Variables Security
1. **Never commit `.env.production` files** to Git
2. **Always use `.env.example` files** for templates in the repository
3. **Change JWT_SECRET** to a secure random string (use `openssl rand -hex 32`)
4. **Review all environment variables** before production deployment

### 🛡️ Production Security
1. **Database Backup**: Regularly backup `data/resumate.db`
2. **Process Monitoring**: Use PM2 monitoring features
3. **Reverse Proxy**: Use nginx for SSL termination and load balancing
4. **File Permissions**: Ensure proper file permissions on server
5. **Network Security**: Configure firewall rules appropriately

### 📝 What's Safe to Commit
✅ **Safe to commit**:
- `.env.example` files
- `.env.local.example` files
- `.env.development.example` files

❌ **NEVER commit**:
- `.env.production` files
- `.env` files with real secrets
- Database files
- Log files with sensitive data

## Troubleshooting

### Service Not Starting
```bash
# Check PM2 logs
pm2 logs

# Check individual service
pm2 describe resumate-backend
```

### Database Issues
```bash
# Reinitialize database
npm run init-db
```

### Build Issues
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

## Health Checks

The application includes health check endpoints:
- Backend: `GET http://localhost:4300/health`
- Database: `GET http://localhost:4300/api/resumes` (should return JSON)

Monitor these endpoints for application health.