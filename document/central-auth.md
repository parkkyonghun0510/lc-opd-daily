# Central Authentication and Authorization Service Analysis

Based on your requirements, I'll help analyze and create a plan for reimplementing your project as a central authentication and authorization service.

## Current Analysis

Your current project appears to be a client application for daily reports with a dashboard layout. To transform this into a central authentication service, we'll need to significantly restructure it.

## Proposed Architecture

I recommend building:

1. A central authentication server (Auth Server)
2. Client SDK/libraries for different applications to connect
3. Admin portal for user management
4. Role-based access control tied to company structure

## Technology Stack Recommendations

- Backend : Node.js with Express or NestJS
- Database : PostgreSQL with Prisma (which you're already using)
- Authentication : JWT with refresh token rotation
- Frontend : Next.js (continue with your current stack)
- UI Components : Continue with shadcn/ui

## Implementation Prompts

Here are prompts you can use with development tools to build this system:

### 1. Auth Server Setup

```plaintext
Create a NestJS authentication server with the following features:
- User authentication with username/password
- JWT token issuance with refresh token rotation
- Role-based authorization system
- Company structure hierarchy for permissions
- Admin API for user management
- PostgreSQL database with Prisma
- Secure password hashing with bcrypt
- Rate limiting for security
```

````

### 2. User Management Module
```plaintext
Build an admin user management module with:
- User creation form with role assignment
- Company structure management (departments, teams)
- Role definition interface
- Permission assignment to roles
- User activation/deactivation
- Password reset functionality
- Audit logging for all admin actions
````

````

### 3. Client SDK Development
```plaintext
Create a client SDK for applications to integrate with the auth service:
- Authentication methods (login, logout, token refresh)
- Authorization helpers (permission checking)
- TypeScript types for all interfaces
- React hooks for frontend applications
- Interceptors for API requests
- Error handling and retry logic
````

````

### 4. Single Sign-On Implementation
```plaintext
Implement Single Sign-On (SSO) functionality:
- OAuth 2.0 server implementation
- OpenID Connect support
- Login page with company branding
- Session management
- Cross-domain authentication
- Remember me functionality
- Device tracking
````

````

### 5. Security Enhancements
```plaintext
Add security features to the authentication service:
- Two-factor authentication
- IP-based access restrictions
- Failed login attempt tracking
- Suspicious activity detection
- Password policy enforcement
- Session timeout controls
- API key management for service-to-service auth
````

```

## Next Steps
```
