const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
const envLocalPath = path.resolve(__dirname, '.env.local');
const envPath = path.resolve(__dirname, '.env');

let envConfig = {};

if (fs.existsSync(envLocalPath)) {
  //console.log(`Loading environment from ${envLocalPath}`);
  envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
} else if (fs.existsSync(envPath)) {
  //console.log(`Loading environment from ${envPath}`);
  envConfig = dotenv.parse(fs.readFileSync(envPath));
} else {
  console.warn('No .env.local or .env file found!');
}

module.exports = {
  apps: [
    {
      name: 'notification-worker',
      script: 'dist/workers/dragonfly-worker.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        ...envConfig  // Spread all environment variables from .env.local
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      out_file: 'logs/notification-worker.log',
      error_file: 'logs/notification-worker-error.log',
    }
  ]
};