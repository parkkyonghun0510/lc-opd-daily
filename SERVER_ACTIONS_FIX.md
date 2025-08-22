# Server Actions Encryption Key Fix

## Problem
The application was experiencing "Failed to find Server Action" errors with the message:
```
[Error: Failed to find Server Action "60d4244ceb1aa6cc5fea91792bd4a403f463a127f5". This request might be from an older or newer deployment.]
```

## Root Cause
Next.js Server Actions use encryption keys that are generated per-deployment. When deployments change (especially in containerized environments like Railway), the encryption key changes, causing Server Actions to become invalid.

## Solution
Added persistent encryption keys across all environment configurations using the `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` environment variable.

## Files Updated

### 1. `.env`
Added:
```bash
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=NYnjBmcu9COlYt0wUSLcUTFCVlt/m+11jYnnqxNfIn4=
```

### 2. `.env.production`
Added:
```bash
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=NYnjBmcu9COlYt0wUSLcUTFCVlt/m+11jYnnqxNfIn4=
```

### 3. `.env.production.template`
Added:
```bash
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=your-generated-32-byte-base64-key-here
```

### 4. `.env.railway.template`
Added:
```bash
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${{NextAuth.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY}}
```

### 5. `.env.example`
Added:
```bash
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=your-generated-32-byte-base64-key-here
```

## Key Generation
Use the provided script to generate new keys:
```bash
node scripts/generate-server-action-key.js
```

## Deployment Instructions

### For Railway Deployment
1. Add `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to your Railway environment variables
2. Use the same key value across all deployments to maintain consistency
3. The key must be 32 bytes base64 encoded for AES-GCM encryption

### For Local Development
1. Copy `.env.example` to `.env.local`
2. Set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to your generated key
3. Restart your development server

### For Production
1. Ensure `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is set in your production environment
2. Use a secure, randomly generated 32-byte base64 key
3. Store the key securely in your deployment platform's secret management

## Verification
After applying the fix:
1. Restart your application
2. Check that Server Actions work correctly
3. Verify no more "Failed to find Server Action" errors appear
4. Test across different deployment environments

## Security Notes
- The encryption key must be kept secret and secure
- Use different keys for different environments (development, staging, production)
- Rotate keys carefully as it will invalidate existing Server Action tokens
- Store keys in secure environment variable systems, never in code

## Troubleshooting
If errors persist:
1. Verify the key is properly set in all environment configurations
2. Check that the key is exactly 32 bytes base64 encoded
3. Ensure the application is restarted after key changes
4. Clear any cached build artifacts: `npm run clean` or `rm -rf .next`