module.exports = {
  apps: [
    {
      name: "lc-opd-daily",
      script: "server.js",
      cwd: "/app",
      instances: 2,
      exec_mode: "cluster",
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
      node_args: "-r dotenv/config",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      cwd: "/app",
      env: {
        NODE_ENV: "production",
        FORCE_COLOR: 0,
        dotenv_config_path: ".env.production"
      },
      env_production: {
        NODE_ENV: "production",
        dotenv_config_path: ".env.production"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      out_file: "logs/notification-worker.log",
      error_file: "logs/notification-worker-error.log",
      max_restarts: 10,
      min_uptime: "10s"
    }
  ]
};