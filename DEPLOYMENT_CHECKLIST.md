# Dragonfly Deployment Checklist

## Pre-Deployment Verification

### ✅ Environment Configuration
- [x] DRAGONFLY_URL configured in production environment
- [x] DRAGONFLY_QUEUE_NAME set to "notifications"
- [x] DRAGONFLY_QUEUE_URL configured for queue service
- [x] VAPID keys configured for push notifications
- [x] DATABASE_URL configured for database connection

### ✅ Code Updates
- [x] Updated `ecosystem.production.config.cjs` to use Dragonfly worker
- [x] Updated `.env.production.template` with Dragonfly configuration
- [x] Verified Dragonfly worker compiled successfully (`dist/workers/dragonfly-worker.js`)
- [x] Verified Dragonfly queue service compiled successfully (`dist/lib/dragonfly-queue.js`)

### ✅ Testing Results
- [x] Dragonfly URL connectivity verified ✓
- [x] Queue operations (send/receive/delete) working ✓
- [x] Worker startup and connection successful ✓
- [x] Environment variables correctly parsed ✓
- [x] Redis server information retrieved successfully ✓

## Deployment Steps

### 1. Environment Setup
```bash
# Verify environment variables are set
railway vars
# or for local Docker
docker run -e DRAGONFLY_URL=redis://... your-image
```

### 2. Build and Deploy
```bash
# Build production image
docker build -t lc-opd-daily:latest .

# Deploy to Railway
railway up

# Or deploy to your preferred platform
```

### 3. Post-Deployment Verification

#### Check Worker Status
```bash
# Check PM2 logs
pm2 logs notification-worker

# Check worker health
pm2 status
```

#### Verify Queue Functionality
```bash
# Test queue operations
redis-cli -u $DRAGONFLY_URL ping
redis-cli -u $DRAGONFLY_URL llen notifications
```

#### Monitor Application
- Check application logs: `pm2 logs lc-opd-daily`
- Check worker logs: `pm2 logs notification-worker`
- Verify health endpoint: `GET /api/health`

### 4. Notification Testing

#### Test Notification Flow
1. Create a test report submission
2. Verify notification is queued: `redis-cli -u $DRAGONFLY_URL llen notifications`
3. Check worker processes notification
4. Verify push notification delivery

#### Test Different Notification Types
- [ ] REPORT_SUBMITTED
- [ ] REPORT_APPROVED  
- [ ] REPORT_REJECTED
- [ ] Custom notifications

## Monitoring and Alerts

### Key Metrics to Monitor
- Queue length: `redis-cli -u $DRAGONFLY_URL llen notifications`
- Worker CPU/memory usage: `pm2 monit`
- Application response time
- Push notification delivery rates
- Database connection health

### Alerting Thresholds
- Queue length > 100 messages
- Worker restart count > 5 in 1 hour
- Application response time > 5 seconds
- Database connection failures

## Rollback Plan

### Quick Rollback
1. Revert `ecosystem.production.config.cjs` change
2. Redeploy with previous configuration
3. Monitor application stability

### Emergency Rollback
```bash
# If immediate rollback needed
pm2 stop notification-worker
pm2 start scripts/redis-standalone-worker-docker.js --name notification-worker
```

## Troubleshooting

### Common Issues
1. **Worker not starting**: Check PM2 logs and environment variables
2. **Queue not processing**: Verify Redis connection and queue URL
3. **Push notifications failing**: Check VAPID keys and subscription validity
4. **Database connection issues**: Verify DATABASE_URL and connection pooling

### Debug Commands
```bash
# Check Redis connection
redis-cli -u $DRAGONFLY_URL ping

# Check queue status
redis-cli -u $DRAGONFLY_URL info keyspace

# Check worker logs
pm2 logs notification-worker --lines 50

# Check application logs
pm2 logs lc-opd-daily --lines 50
```

## Success Criteria

### Deployment Success
- [ ] Application starts without errors
- [ ] Worker starts and connects to Dragonfly
- [ ] Queue operations working correctly
- [ ] Notifications processing as expected
- [ ] No increase in error rates
- [ ] Performance metrics maintained or improved

### Performance Benchmarks
- Queue processing time < 1 second per message
- Worker memory usage < 500MB
- Application response time < 2 seconds
- 99.9% uptime for both app and worker

## Next Steps

1. Monitor for 24-48 hours post-deployment
2. Set up comprehensive monitoring dashboards
3. Document any issues and resolutions
4. Plan for scaling based on usage patterns
5. Consider SSL/TLS configuration for Dragonfly connection (if not already configured)