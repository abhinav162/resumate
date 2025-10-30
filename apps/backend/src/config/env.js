import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables based on NODE_ENV
function loadEnvironment() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const backendDir = join(__dirname, '..', '..');
  
  let envPath;
  
  // Try different .env files in order of preference
  const envFiles = [
    `.env.${nodeEnv}.local`,
    `.env.${nodeEnv}`,
    '.env.local',
    '.env'
  ];
  
  for (const envFile of envFiles) {
    const fullPath = join(backendDir, envFile);
    if (existsSync(fullPath)) {
      envPath = fullPath;
      break;
    }
  }
  
  if (envPath) {
    console.log(`Loading environment from: ${envPath}`);
    dotenv.config({ path: envPath });
  } else {
    console.log('No .env file found, using system environment variables');
  }
  
  // Validate required environment variables
  const required = ['JWT_SECRET', 'SESSION_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`Warning: Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Log OAuth configuration status (without secrets)
  const hasOAuth = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
  console.log(`OAuth Configuration: ${hasOAuth ? 'Available' : 'Missing'}`);
  
  if (hasOAuth) {
    console.log(`Google Client ID: ${process.env.GOOGLE_CLIENT_ID ? '***configured***' : 'missing'}`);
    console.log(`Google Callback URL: ${process.env.GOOGLE_CALLBACK_URL || 'using default'}`);
  }
}

export { loadEnvironment };