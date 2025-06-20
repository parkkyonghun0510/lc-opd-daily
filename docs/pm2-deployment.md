# PM2 Deployment Guide

This guide explains how to deploy the LC-OPD-Daily application using PM2, a production process manager for Node.js applications.

## Prerequisites

- Node.js installed (v18 or higher)
- PM2 installed globally: `npm install -g pm2`

## Configuration

The application uses a PM2 ecosystem configuration file (`ecosystem.config.cjs`) that defines how the application should be run.

Key settings:

- **Name**: `lc-opd-daily`
- **Script**: Uses Next.js start command
- **Instances**: Set to "max" for optimal performance (uses all available CPU cores)
- **Mode**: Cluster mode for load balancing
- **Environment**: Production settings

## Starting the Application

There are several ways to start the application with PM2:

### Using npm scripts

```bash
# Build the application first (required before starting with PM2)
npm run build

# Start with PM2
npm run start:pm2
```

### Using PM2 directly

```bash
# Navigate to the project directory first
cd /path/to/lc-opd-daily

# Build the application
npm run build

# Start with PM2
pm2 start ecosystem.config.cjs
```

## Managing the Application

### Check Status

```bash
pm2 status
```

### Restart Application

```bash
npm run restart:pm2
# or
pm2 restart lc-opd-daily
```

### Stop Application

```bash
npm run stop:pm2
# or
pm2 stop lc-opd-daily
```

### View Logs

```bash
pm2 logs lc-opd-daily
```

### Monitor Usage

```bash
pm2 monit
```

## Auto-restart on System Boot

To configure PM2 to automatically start your application when the server reboots:

```bash
# Save the current PM2 process list
pm2 save

# Generate startup script
pm2 startup
# Then run the command it outputs
```

If you're using WSL, the startup script might not work correctly. In this case, you can use the provided scripts:

```bash
# After system reboot, navigate to your project folder and run:
./scripts/pm2-start.sh
```

## Troubleshooting

If you encounter issues:

1. Check logs: `pm2 logs lc-opd-daily`
2. Verify Next.js build: `npm run build`
3. Try restarting PM2: `pm2 restart lc-opd-daily`
4. For more serious issues: `pm2 delete lc-opd-daily` and then start fresh

## Scaling

You can adjust the number of instances in the `ecosystem.config.cjs` file:

- `max` - utilizes all available CPU cores

## Related Documentation

- [Production Deployment](./production-deployment.md)
- [Notification Worker](./notification-worker.md)
- [Notification Queue](./notification-queue.md)
- [Code Organization](./code-organization.md)
- [Error Handling Guide](./error-handling-guide.md)
- [Performance Optimizations](./performance-optimizations.md)

- Specific number (e.g., `4`) - runs exactly that many instances
