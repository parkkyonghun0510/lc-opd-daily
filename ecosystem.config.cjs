module.exports = {
  apps: [
    {
      name: "lc-opd-daily",
      script: ".next/standalone/server.js",
      instances: "max",
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0"
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0"
      }
    },
    {
      name: "notification-worker",
      script: "./dist/workers/notificationWorker.js",
      watch: false,
      max_memory_restart: "250M",
      env: {
        NODE_ENV: "production"
      },
      env_production: {
        NODE_ENV: "production"
      }
    }
  ]
}