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
      cwd: "/app",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    },
    {
      name: "notification-worker",
      script: "/app/scripts/redis-standalone-worker-docker.js",
      interpreter: "node",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      cwd: "/app",
      env: {
        NODE_ENV: "production"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      out_file: "/app/logs/notification-worker.log",
      error_file: "/app/logs/notification-worker-error.log"
    }
  ]
};