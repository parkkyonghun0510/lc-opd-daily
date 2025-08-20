module.exports = {
  apps: [
    {
      name: "lc-opd-daily",
      script: "server.js",
      cwd: "/app",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        FORCE_COLOR: 0
      },
      env_production: {
        NODE_ENV: "production"
      }
    },
    {
      name: "notification-worker",
      script: "dist/workers/dragonfly-worker.js",
      interpreter: "node",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      cwd: "/app",
      env: {
        NODE_ENV: "production",
        FORCE_COLOR: 0
      },
      env_production: {
        NODE_ENV: "production"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      out_file: "logs/notification-worker.log",
      error_file: "logs/notification-worker-error.log"
    }
  ]
};