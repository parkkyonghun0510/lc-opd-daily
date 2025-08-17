module.exports = {
  apps: [
    {
      name: "lc-opd-daily",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: "max",
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "1G",
      cwd: ".",
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
      script: "scripts/redis-standalone-worker-docker.js",
      interpreter: "node",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      cwd: ".",
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