# Backend API Server Security Best Practices

## 1. Authentication

### NextAuth Implementation (src/lib/auth.ts)

- Uses NextAuth with Credentials provider for secure session management
- Password hashing with bcrypt (12 rounds)
- Account lockout after 5 failed attempts (15-minute lock period)
- Session structure includes:
  ```typescript
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      branchId?: string | null;
    };
  }
  ```

### API Key Management

- Not implemented in current API (uses session-based authentication)
- For future implementation, use environment variables with rotation strategy:
  ```typescript
  // Example placeholder
  const API_KEYS = process.env.ALLOWED_API_KEYS.split(",");
  export const validateApiKey = (req, res, next) => {
    if (!API_KEYS.includes(req.header("X-API-Key"))) {
      res.status(403).json({ error: "Invalid API key" });
    }
    next();
  };
  ```

## 2. Authorization

### Role-Based Access Control (RBAC)

- Defined in '@/lib/auth/roles' with permission hierarchy:

  ```typescript
  enum UserRole {
    USER = "user",
    BRANCH_MANAGER = "branch_manager",
    ADMIN = "admin",
  }

  enum Permission {
    VIEW_REPORTS = "view_reports",
    EDIT_REPORTS = "edit_reports",
    MANAGE_USERS = "manage_users",
    ASSIGN_ROLES = "assign_roles",
  }
  ```

- Enforcement in API routes (src/app/api/roles/route.ts):
  ```typescript
  if (!hasPermission(user.role as UserRole, Permission.MANAGE_USERS)) {
    return new NextResponse(null, { status: 403 });
  }
  ```

### Attribute-Based Access Control (ABAC)

- Implemented through branchId ownership checks in database queries
- Example from roles API:
  ```typescript
  const targetUser = await prisma.user.findUnique({
    where: {
      id: userId,
      branchId: user.branchId, // Ensures branch-level isolation
    },
  });
  ```

## 3. Data Protection

### TLS Configuration

- Mandatory HTTPS enforced in production configuration
- Certificate management handled by infrastructure (Cloudflare)

### Password Security

- Bcrypt hashing (12 rounds) for password storage
- Password complexity enforced during user creation:
  ```typescript
  // Minimum 8 characters, mixed case, numbers, and special characters
  if (password.length < 8) throw new Error("Password too short");
  ```

## 4. Input Validation

### Request Validation

- Built-in TypeScript validation in API routes
- Example from roles API:
  ```typescript
  if (!body.userId || !body.role) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }
  ```

### Sanitization

- Input sanitization using Zod for complex validation
- DOMPurify used for any HTML content handling

## 5. Rate Limiting & DDoS Protection

### Redis-Based Rate Limiting

- Implemented in middleware (not shown in current API routes)
- Recommended implementation:
  ```typescript
  // Example rate limiting pattern
  const rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: "api_rate_limit",
    points: 100, // 100 requests
    duration: 60, // per minute
  });
  ```

## 6. Logging & Monitoring

### Structured Logging

- Implemented with Winston (src/lib/auth/log-user-activity.ts)
- Audit logs include:
  - User ID
  - Action type
  - Target user ID
  - IP address
  - User agent

## 7. API Gateway Security

### Request Validation

- OpenAPI validation recommended for all endpoints
- Example validation pattern:
  ```typescript
  // Using Zod for schema validation
  const userSchema = z.object({
    name: z.string().min(3),
    email: z.string().email(),
  });
  ```

## 8. Security Headers

### Express Security Headers

- Implemented via middleware (not shown in current API)
- Recommended configuration:
  ```typescript
  app.use(
    helmet({
      hsts: { maxAge: 31536000 },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "trusted-cdn.com"],
        },
      },
    }),
  );
  ```

## 9. Regular Security Audits

### OWASP ZAP Scan

```bash
docker run -v $(pwd):/zap/wrk/:rw -t owasp/zap2docker-stable zap-baseline.py -t http://target.com -r report.html
```

### Penetration Testing Checklist

1. Test authentication endpoints for brute-force protection
2. Verify rate limiting on all public endpoints
3. Check for SQL injection vulnerabilities
4. Test XSS in all input fields
5. Validate JWT token expiration and signature
6. Check for insecure direct object references (IDOR)
7. Test CSRF protection on state-changing endpoints
8. Verify proper error handling (no sensitive information leakage)

---

## 10. Prisma ORM Security Considerations

### 10.1 Database Query Best Practices

- Always use parameterized queries via Prisma Client to prevent SQL injection. Example:
  ```typescript
  await prisma.user.findUnique({
    where: { id: userId, branchId: session.user.branchId },
  });
  ```
- Enforce branch-level isolation by always including `branchId` in queries for models like `User`, `Report`, and `UserBranchAssignment`.
- Use `.findFirst` or `.findUnique` with composite unique constraints (see below) to avoid ambiguous results and privilege escalation.

### 10.2 Model-Level Security Constraints

- **Unique Constraints:**
  - `User.email` and `User.username` are unique, preventing account duplication.
  - `Branch.code` and `Role.name` are unique, ensuring integrity.
  - Composite unique constraints on `UserBranchAssignment` (`@@unique([userId, branchId])`), `Report` (`@@unique([date, branchId, reportType])`), and `UserRole` (`@@unique([userId, roleId, branchId])`) enforce business logic at the DB level.
- **Required Fields:**
  - Most models require `id`, `createdAt`, and `updatedAt`.
  - Use Prisma's `@default(now())` and `@updatedAt` for timestamps to ensure auditability.
- **Defaults and Enums:**
  - Use `@default` for fields like `User.role`, `User.isActive`, `Report.status`, etc., to enforce secure defaults.

### 10.3 Relation Enforcement & Data Isolation

- Use explicit relations with `@relation` and `onDelete: Cascade` for dependent data cleanup (e.g., `UserBranchAssignment`, `ActivityLog`, `ReportComment`).
- Always scope queries by `branchId` to prevent cross-branch data access (ABAC enforcement).
- Use nested writes with caution; validate user permissions before creating or updating related records.
- Example: Only allow users to access `Report` records where `branchId` matches their assignment.

### 10.4 Validation Rule Implementation

- Centralize validation logic using the `OrganizationSettings.validationRules` JSON field for dynamic rule enforcement (e.g., required comments, max amounts for `writeOffs`/`ninetyPlus`).
- Always validate input with Zod or similar before passing data to Prisma:
  ```typescript
  const reportSchema = z.object({
    comments: z.string().min(10),
    writeOffs: z.number().max(1000),
    ninetyPlus: z.number().max(5000),
  });
  ```
- Enforce server-side validation for all critical fields, especially those with business rules defined in `OrganizationSettings`.

### 10.5 Audit Logging Implementation

- Use the `ActivityLog` and `UserActivity` models to record all sensitive or critical actions (e.g., login, role changes, report submission).
- Include user ID, action, details, IP address, and timestamp for traceability.
- Example audit log creation:
  ```typescript
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "REPORT_SUBMITTED",
      details: "Report ID: ...",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    },
  });
  ```
- Regularly review audit logs for suspicious activity.

---

**References:**

- See `/prisma/schema.prisma` for full model definitions and constraints.
- See `src/lib/auth/branch-access.ts` for implementation of branch isolation and access control.
- See `src/app/api/reports/route.ts` for secure query patterns using Prisma.
