# LC-OPD-Daily

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Authentication System

This project uses a comprehensive authentication system built with Zustand for state management and NextAuth.js for authentication. The system provides a robust, type-safe, and feature-rich authentication experience.

### Key Features

- **NextAuth.js Integration**: Handles the authentication flow with the server
- **Zustand State Management**: Provides client-side state management with persistence
- **Permission-Based Access Control**: Granular control over UI elements and routes
- **Session Management**: Advanced session timeout handling and refresh functionality
- **Real-Time Synchronization**: Keeps authentication state in sync with the server

### Documentation

For more information about the authentication system, see the following documentation:

- [Authentication System Overview](src/auth/README.md)
- [Authentication Components](src/auth/COMPONENTS.md)
- [Authentication Hooks](src/auth/HOOKS.md)
- [Migration Guide](src/auth/MIGRATION.md)

### Usage Example

```tsx
import { useAuth } from "@/auth/hooks/useAuth";
import { PermissionGate } from "@/auth/components/PermissionGate";

function AdminPanel() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <p>Please log in</p>;
  }

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>

      <PermissionGate
        permissions={["MANAGE_USERS"]}
        fallback={<p>You don't have permission to manage users</p>}
      >
        <UserManagement />
      </PermissionGate>
    </div>
  );
}
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Project Structure

The project has been organized into the following structure:

```
/
├── docs/            # Documentation files
├── scripts/         # Scripts for building, deployment, and utilities
│   ├── build/       # Build scripts
│   ├── db/          # Database scripts
│   ├── deploy/      # Deployment scripts
│   ├── test/        # Test scripts
│   └── utils/       # Utility scripts
├── src/             # Source code
│   ├── app/         # Next.js app directory
│   ├── auth/        # Authentication system
│   ├── components/  # Reusable components
│   └── ...
└── tests/           # Test files
    ├── api/         # API tests
    ├── sse/         # Server-Sent Events tests
    └── workflow/    # Workflow tests
```

## Deployment

This project can be deployed using various methods:

### Railway Deployment

The project is configured for deployment on Railway using NIXPACKS:

```bash
npm run build:railway
```

### PM2 Deployment

For production deployment with PM2:

```bash
npm run deploy:production
```

## PostgreSQL Performance Optimization

The application has been optimized to work efficiently with PostgreSQL. Here are the key improvements:

### Database Schema

- Proper data types: `DATE` for date columns, `DECIMAL` for financial values
- Optimized indexes for common query patterns
- Efficient relationship handling

### Maintenance

Regular database maintenance is critical for optimal performance. We've included a maintenance script that:

1. Runs VACUUM to reclaim storage space
2. Updates statistics with ANALYZE for optimal query planning
3. Identifies and rebuilds bloated indexes
4. Reports on unused indexes that could be removed
5. Provides information on table sizes

#### Setting up Scheduled Maintenance

Set up a cron job to run the maintenance script regularly:

```bash
# Edit crontab
crontab -e

# Add a line to run the maintenance script weekly on Sunday at 1:00 AM
0 1 * * 0 cd /path/to/lc-opd-daily && npm run db:maintenance >> /var/log/lc-db-maintenance.log 2>&1
```

### Connection Pooling

The application uses connection pooling to efficiently manage database connections. This can be configured in the `.env` file:

```
# Maximum number of connections in the pool
DATABASE_CONNECTION_POOL_MAX=10
```

### Query Optimization

- Efficient pagination using keyset pagination for large datasets
- Selective field retrieval to minimize data transfer
- Transaction support for operations requiring atomicity
