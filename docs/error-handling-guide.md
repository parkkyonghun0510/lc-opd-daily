# Error Handling Guide

This guide describes the standardized error handling architecture and best practices used in the LC-OPD-Daily project. It aims to ensure consistent error management, facilitate debugging, improve user experience, and maintain clean separation of concerns across server actions, API routes, and background workers.

It complements the [Code Organization](./code-organization.md) and [Notification Queue](./notification-queue.md) documentation.

## Table of Contents

1. [Error Classes](#error-classes)
2. [Error Handling Utilities](#error-handling-utilities)
3. [Error Guards and Type Predicates](#error-guards-and-type-predicates)
4. [Validation Utilities](#validation-utilities)
5. [Usage Patterns](#usage-patterns)
   - [Server Actions](#server-actions)
   - [API Routes](#api-routes)
   - [Non-critical Operations](#non-critical-operations)
6. [Best Practices](#best-practices)

## Error Classes

All custom errors extend the base `AppError` class, which provides consistent properties:

```typescript
class AppError extends Error {
  public readonly code: string; // Error code for programmatic handling
  public readonly httpStatus: number; // HTTP status code
  public readonly isOperational: boolean; // Whether this is an expected (operational) error
  public readonly context?: Record<string, any>; // Additional context for debugging
}
```

Available error classes:

| Class                  | Default Status | Purpose                               |
| ---------------------- | -------------- | ------------------------------------- |
| `AuthError`            | 401            | Authentication failures               |
| `ForbiddenError`       | 403            | Authorization/permission failures     |
| `ValidationError`      | 400            | Input validation failures             |
| `NotFoundError`        | 404            | Resource not found                    |
| `DatabaseError`        | 500            | Database operation failures           |
| `ExternalServiceError` | 502            | External API/service failures         |
| `ConflictError`        | 409            | Resource conflicts (e.g., duplicates) |
| `RateLimitError`       | 429            | Rate limit exceeded                   |

Example:

```typescript
// Instead of returning a generic error
if (!session?.user?.id) {
  return { success: false, error: "Unauthorized" };
}

// Throw a specific error class
if (!session?.user?.id) {
  throw new AuthError("Authentication required");
}
```

## Error Handling Utilities

### Structured Logging

```typescript
logError(
  error: Error,
  level: LogLevel = LogLevel.ERROR,
  context?: Record<string, any>
): void
```

Logs errors with consistent structure and severity levels (DEBUG, INFO, WARN, ERROR, FATAL). Contextual information can be included to aid troubleshooting.

### API Route Error Handler

```typescript
handleApiError(error: unknown): NextResponse
```

Converts any error to an appropriate NextResponse with the correct status code and error message.

### Server Action Error Handler

```typescript
handleActionError(error: unknown): {
  success: false;
  error: string;
  code?: string;
}
```

Converts any error to a standardized server action response, ensuring consistent error formats for client-side handling.

### Async Error Wrapper

```typescript
async function tryCatch<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: unknown) => any,
): Promise<T>;
```

Wraps async functions in a try-catch block with optional custom error handling.

### Non-critical Operation Wrapper

```typescript
async function tryNonCritical<T>(
  fn: () => Promise<T>,
  fallbackValue: T,
  context?: Record<string, any>,
): Promise<T>;
```

Executes operations that shouldn't fail the main flow, with logging and fallback values. This is especially useful for background tasks like sending notifications.

## Error Guards and Type Predicates

Type guards help with error type checking:

```typescript
if (isValidationError(error)) {
  // Handle validation errors specifically
}

if (isAuthError(error)) {
  // Handle auth errors specifically
}
```

Helper functions:

- `toAppError(error: unknown)`: Converts any error to an AppError
- `getErrorCode(error: unknown)`: Extracts error code from any error
- `getErrorStatus(error: unknown)`: Extracts HTTP status from any error

## Validation Utilities

### Single Value Validation

```typescript
validate<T>(
  value: T,
  rules: ValidationRule<T>[],
  fieldName: string
): void
```

### Object Validation

```typescript
validateObject<T extends Record<string, any>>(
  obj: T,
  schema: Record<keyof T, ValidationRule<any>[]>
): void
```

### Predefined Validation Rules

```typescript
// Examples
ValidationRules.required();
ValidationRules.minLength(5);
ValidationRules.maxLength(100);
ValidationRules.pattern(/^\d{5}$/, "Must be a 5-digit number");
ValidationRules.email();
ValidationRules.min(0);
ValidationRules.max(100);
ValidationRules.oneOf(["option1", "option2"]);
ValidationRules.custom((value) => value % 2 === 0, "Must be an even number");
```

## Usage Patterns

### Server Actions

```typescript
export async function myServerAction(params) {
  return tryCatch(async () => {
    // Authentication check
    if (!session?.user?.id) {
      throw new AuthError("Authentication required");
    }

    // Permission check
    if (!checkPermission(userRole, Permission.REQUIRED_PERMISSION)) {
      throw new ForbiddenError("You don't have permission for this action");
    }

    // Validation
    if (!params.requiredField) {
      throw new ValidationError("Required field is missing");
    }

    // Resource existence check
    const resource = await prisma.resource.findUnique({
      where: { id: params.id },
    });

    if (!resource) {
      throw new NotFoundError("Resource not found");
    }

    // Main operation
    const result = await performOperation();

    // Non-critical operation (won't fail the main flow)
    await tryNonCritical(
      async () => {
        await sendNotification();
        return { sent: true };
      },
      { sent: false },
      { operation: "send-notification", resourceId: params.id },
    );

    return {
      success: true,
      data: result,
    };
  }, handleActionError);
}
```

### API Routes

```typescript
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const token = await getToken({ req: request });
    if (!token) {
      throw new AuthError("Authentication required");
    }

    // Main operation
    const data = await fetchData();

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Non-critical Operations

```typescript
// For operations that shouldn't fail the main flow
await tryNonCritical(
  async () => {
    await sendNotification();
    return { sent: true };
  },
  { sent: false }, // Fallback value if the operation fails
  { operation: "send-notification", userId: user.id }, // Context for logging
);
```

## Best Practices

1. **Use Specific Error Classes**: Choose the most appropriate error class for each situation to enable precise error handling.

2. **Include Context**: Add relevant context to errors to aid debugging:

   ```typescript
   throw new ValidationError("Invalid input", "VALIDATION_ERROR", 400, {
     field: "email",
     value: input.email,
   });
   ```

3. **Handle Non-critical Operations**: Use `tryNonCritical` for operations that shouldn't fail the main flow, such as sending notifications or logging.

4. **Consistent Response Format**:

   - Server actions: `{ success: boolean, data?: any, error?: string }`
   - API routes: Use appropriate HTTP status codes and consistent JSON structure

5. **Validate Early**: Validate inputs at the beginning of functions to fail fast and avoid unnecessary processing.

6. **Log Appropriately**: Use the correct log level based on error severity, and include contextual information.

7. **Don't Expose Sensitive Information**: Sanitize error messages and contexts before sending to clients to avoid leaking sensitive data.

8. **Use Type Guards**: Leverage TypeScript's type system with error guards for type-safe error handling.

## Related Documentation

- [Code Organization](./code-organization.md)
- [Notification Queue](./notification-queue.md)
- [Notification Worker](./notification-worker.md)
- [Performance Optimizations](./performance-optimizations.md)
- [Production Deployment](./production-deployment.md)
