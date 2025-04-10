# Performance Optimizations

This document outlines the key performance optimizations implemented in the LC-OPD-Daily project to improve database query efficiency, reduce server load, and enhance scalability. It covers optimizations in notification targeting, API endpoints, caching, and background processing.

These optimizations complement the [Notification Queue](./notification-queue.md), [Notification Worker](./notification-worker.md), and [Error Handling Guide](./error-handling-guide.md).

## Notification Targeting System Optimizations

### Enhanced Branch Hierarchy Processing

**Before:**
- Multiple sequential database queries for branch relationships
- Repeated traversal of branch hierarchies for each notification
- Inefficient recursive queries for sub-branches
- Separate queries for branch access checks

**After:**
- Consolidated branch relationship queries into a single database call
- Pre-computed branch hierarchies stored in memory
- Efficient O(1) lookups for branch hierarchies and sub-branches
- Improved caching mechanism with hierarchyMap and subBranchMap
- Batch operations for checking multiple branches at once

```typescript
// Enhanced branch maps with pre-computed hierarchies
interface EnhancedBranchMaps {
  parentMap: Map<string, string | null>;
  childrenMap: Map<string, string[]>;
  hierarchyMap: Map<string, Set<string>>;  // Branch ID -> Set of all branches in hierarchy
  subBranchMap: Map<string, Set<string>>;  // Branch ID -> Set of all sub-branches
  allBranches: Map<string, Branch>;        // All branches by ID for quick lookup
  timestamp: number;
}

// User branch access cache
interface BranchAccessCache {
  userAccessMap: Map<string, Set<string>>;  // User ID -> Set of accessible branch IDs
  branchMaps: EnhancedBranchMaps;
  timestamp: number;
}
```

### Batch User Queries

**Before:**
- Separate database queries for each role/branch combination
- Multiple roundtrips to the database for related user data
- Redundant queries for the same user groups

**After:**
- Consolidated user queries with complex conditions
- User caching by branch, role, and combined criteria
- In-memory filtering for user targeting

```typescript
// User cache to avoid repeated database queries
interface UserCache {
  byBranchAndRole: Map<string, string[]>;
  byBranch: Map<string, string[]>;
  byGlobalRole: Map<string, string[]>;
  allActive: string[] | null;
  timestamp: number;
}
```

### Report Data Caching

**Before:**
- Repeated queries for the same report details
- Separate queries for report submitter and report details

**After:**
- Cached report details for frequently accessed reports
- Combined queries to fetch all needed report data at once

```typescript
// Report details cache
interface ReportDetailsCache {
  details: Map<string, { submittedBy: string; branchId: string } | null>;
  timestamp: number;
}
```

## API Endpoint Optimizations

### Reports API

**Before:**
- Separate queries for count and data fetching
- Inefficient pagination implementation
- Blocking notification sending

**After:**
- Combined count and data fetch in a single transaction
- Optimized pagination with proper skip/take parameters
- Non-blocking notification sending with proper error handling

```typescript
// Combined count and data fetch in a single transaction
const [total, reports] = await prisma.$transaction([
  prisma.report.count({ where }),
  prisma.report.findMany({
    where,
    include: { /* ... */ },
    orderBy: { /* ... */ },
    ...(page && limit ? { skip: (page - 1) * limit, take: limit } : {})
  })
]);
```

### Report Actions

**Before:**
- Sequential operations for related data
- Inefficient include patterns fetching unnecessary data
- Blocking notification queue operations
- Multiple database queries for branch access checks
- Redundant report fetching for multiple reports

**After:**
- Parallel operations using Promise.all for independent tasks
- Selective field fetching with optimized select statements
- Non-blocking notification sending with proper fallbacks
- In-memory branch access checks with O(1) lookups
- Batch operations for checking multiple reports at once

```typescript
// Parallel operations for independent tasks
const [approver, auditLogResult] = await Promise.all([
  // Get approver's name for notifications
  prisma.user.findUnique({ /* ... */ }),
  
  // Create an audit log entry
  (async () => { /* ... */ })()
]);

// Batch branch access checking for multiple reports
export async function fetchMultipleReportsAction(reportIds: string[]) {
  // Get all reports in a single query
  const reports = await prisma.report.findMany({
    where: { id: { in: reportIds } },
    // ...
  });
  
  // Extract all branch IDs from the reports
  const branchIds = [...new Set(reports.map(report => report.branchId))];
  
  // Check access to all branches in a single operation
  const branchAccessMap = await checkBranchesAccess(session.user.id, branchIds);
  
  // Filter reports based on branch access
  const accessibleReports = reports.filter(report => 
    branchAccessMap.get(report.branchId) === true
  );
}
```

## Benefits

1. **Reduced Database Load**
   - Fewer queries means less database server load
   - More efficient use of database connections
   - Reduced query complexity
   - Elimination of redundant branch hierarchy queries

2. **Improved Response Times**
   - Faster API responses due to consolidated queries
   - Reduced latency from fewer database roundtrips
   - Non-blocking operations for better concurrency
   - O(1) lookups for branch access checks instead of recursive queries

3. **Better Scalability**
   - More efficient processing for larger branch hierarchies
   - Improved handling of high-volume notification scenarios
   - Better memory usage patterns
   - Consistent performance regardless of hierarchy depth

4. **Enhanced Reliability**
   - Proper error handling for notification sending
   - Fallback mechanisms for queue failures
   - More robust caching with TTL controls
   - Graceful degradation with fallback to original implementation
## Related Documentation

- [Code Organization](./code-organization.md)
- [Notification Queue](./notification-queue.md)
- [Notification Worker](./notification-worker.md)
- [Error Handling Guide](./error-handling-guide.md)
- [Production Deployment](./production-deployment.md)


## Future Optimization Opportunities

1. **Query Optimization**
   - Further optimize complex queries with proper indexes
   - Consider using raw SQL for performance-critical operations
   - Implement database-level materialized views for complex hierarchies

2. **Caching Improvements**
   - Implement distributed caching for multi-server deployments
   - Add cache invalidation triggers for data changes
   - Implement Redis-based shared caching for branch hierarchies
   - Add proactive cache warming for frequently accessed branches

3. **Background Processing**
   - Move more operations to background workers
   - Implement batch processing for notifications
   - Pre-compute access maps during off-peak hours

4. **Branch Access Optimizations**
   - Implement role-based access control at the branch level
   - Add branch hierarchy visualization tools for administrators
   - Optimize memory usage for very large branch hierarchies
