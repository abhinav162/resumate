# Production Environment Setup

## Environment File Priority

The backend now supports multiple environment files loaded in the following priority order:

1. `.env.{NODE_ENV}.local` (e.g., `.env.production.local`)
2. `.env.{NODE_ENV}` (e.g., `.env.production`)
3. `.env.local`
4. `.env`

## Production Deployment

### 1. Create Production Environment File

Copy the example file and configure it:

```bash
cp .env.production.example .env.production
```

### 2. Update Production Variables

Edit `.env.production` with your production values:

```bash
# Required Production Values
NODE_ENV=production
PORT=4300
FRONTEND_URL=https://your-domain.com
CORS_ORIGIN=https://your-domain.com

# Security (CRITICAL: Use unique, secure values)
JWT_SECRET=your_super_secure_jwt_secret_minimum_32_characters_long
SESSION_SECRET=your_super_secure_session_secret_minimum_32_characters_long

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_production_google_client_id
GOOGLE_CLIENT_SECRET=your_production_google_client_secret
GOOGLE_CALLBACK_URL=https://your-domain.com/api/auth/google/callback
```

### 3. Google OAuth Setup for Production

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select your production project
3. Create OAuth 2.0 credentials
4. Add authorized redirect URI: `https://your-domain.com/api/auth/google/callback`
5. Copy the Client ID and Secret to your `.env.production`

### 4. Deploy with Environment

Set NODE_ENV=production when starting the server:

```bash
NODE_ENV=production npm start
```

Or use PM2:

```bash
NODE_ENV=production pm2 start src/server.js --name resumate-backend
```

## Environment Loading Verification

The backend will log the environment loading status:

```
Loading environment from: /path/to/.env.production
OAuth Configuration: Available
Google Client ID: ***configured***
Google Callback URL: https://your-domain.com/api/auth/google/callback
```

## Troubleshooting

### Environment Not Loading
- Ensure `.env.production` exists in the backend root directory
- Check file permissions are readable
- Verify NODE_ENV is set to 'production'

### OAuth Not Working
- Verify Google Client ID and Secret are correct
- Check callback URL matches Google Console configuration
- Ensure FRONTEND_URL points to your production domain

### Missing Required Variables
The system will warn about missing critical variables:
- JWT_SECRET
- SESSION_SECRET

Never deploy without these properly configured!