# Service Worker Troubleshooting Guide

## Issue: Service Worker Cache Failure

### Error Description
```
sw.js:56 encountered an error while attempting to cache the app shell or routes: TypeError - Failed to execute 'addAll' on 'Cache' due to a request failure
```

### Root Causes
1. **Invalid Routes**: The service worker was attempting to cache non-existent routes
2. **Missing Assets**: Some static assets referenced in APP_SHELL didn't exist
3. **Network Issues**: Cache.addAll() fails if any single request fails

### Solution Applied

#### 1. Updated Invalid Routes
- **Removed**: `/dashboard/reports` and `/dashboard/approvals` (these don't exist as separate pages)
- **Kept**: Valid routes like `/dashboard`, `/profile`, `/settings`

#### 2. Fixed Missing Assets
- **Removed**: `/icons/badge-info.png` (file doesn't exist)
- **Kept**: Valid icons like `/icons/icon-192x192.png` and `/favicon.ico`

#### 3. Enhanced Error Handling
- Added individual resource validation
- Graceful degradation - one failed resource won't break the entire cache
- Detailed logging for debugging

### Verification Steps

1. **Check Browser Console**:
   - Open DevTools → Application → Service Workers
   - Look for detailed logs starting with "✅" and "⚠️"

2. **Test Cache Contents**:
   ```javascript
   // In browser console
   caches.keys().then(keys => console.log('Cache names:', keys));
   caches.open('lc-opd-daily-cache-v1').then(cache => 
     cache.keys().then(requests => console.log('Cached resources:', requests))
   );
   ```

3. **Force Service Worker Update**:
   - Open DevTools → Application → Service Workers
   - Click "Update" or "Unregister" then refresh the page

### Manual Testing

1. **Test Offline Mode**:
   - Open the application in browser
   - Open DevTools → Network → Set to "Offline"
   - Refresh the page - should show offline.html

2. **Test Service Worker Registration**:
   ```javascript
   // Check if service worker is registered
   navigator.serviceWorker.getRegistration().then(reg => {
     console.log('Service Worker registered:', !!reg);
     if (reg) console.log('Scope:', reg.scope);
   });
   ```

### Common Issues and Fixes

| Issue | Fix |
|-------|-----|
| 404 errors for routes | Ensure all routes in PREFETCH_ROUTES exist |
| Missing static assets | Verify all paths in APP_SHELL exist |
| Cache.addAll() fails | Use individual caching with try-catch |
| Service worker not updating | Use "Update on reload" in DevTools |

### Debug Mode

To enable detailed service worker logging:

1. Open DevTools → Application → Service Workers
2. Check "Update on reload"
3. Check "Bypass for network"
4. Refresh the page and check console for detailed logs

### Files Modified
- `public/sw.js` - Updated with robust error handling and valid routes