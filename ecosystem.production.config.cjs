module.exports = {
  apps: [
    {
      name: "lc-opd-daily",
      script: "server.js",
      instances: "max",
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    },
    {
      name: "notification-worker",
      script: "scripts/utils/standalone-worker.js",
      interpreter: "node",
      interpreterArgs: "--experimental-modules",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      out_file: "logs/notification-worker.log",
      error_file: "logs/notification-worker-error.log"
    }
  ]
};