module.exports = {
  apps: [
    {
      name: 'resumate-backend',
      script: './apps/backend/src/server.js',
      cwd: '/Users/apple/Desktop/den/resumate',
      env: {
        NODE_ENV: 'development',
        PORT: 4300
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4300
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      log_file: './logs/resumate-backend.log',
      error_file: './logs/resumate-backend-error.log',
      out_file: './logs/resumate-backend-out.log',
      time: true
    },
    {
      name: 'resumate-frontend',
      script: 'npx',
      args: 'serve -s dist -l 3160',
      cwd: '/Users/apple/Desktop/den/resumate/apps/frontend',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      log_file: './logs/resumate-frontend.log',
      error_file: './logs/resumate-frontend-error.log',
      out_file: './logs/resumate-frontend-out.log',
      time: true
    }
  ]
};