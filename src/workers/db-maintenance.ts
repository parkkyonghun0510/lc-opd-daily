/**
 * Database Maintenance Worker
 *
 * This script handles routine PostgreSQL maintenance tasks:
 * - VACUUM to reclaim storage
 * - ANALYZE to update query planner statistics
 * - Index maintenance
 *
 * Run this script via a scheduled task (e.g., cron job)
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Type definitions for database errors
 */

/**
 * Represents a PostgreSQL-specific error
 * @interface PostgreSQLError
 */
interface PostgreSQLError {
  /** PostgreSQL error code (e.g., '42P01' for undefined_table) */
  code: string;
  /** Error message */
  message: string;
  /** Additional error details (optional) */
  detail?: string;
}

/**
 * Represents a database connection error
 * @interface ConnectionError
 */
interface ConnectionError {
  /** Error name/type */
  name: string;
  /** Error message */
  message: string;
  /** Server address that failed connection (optional) */
  address?: string;
  /** Server port that failed connection (optional) */
  port?: number;
}

/**
 * Represents a Prisma-specific error
 * @interface PrismaError
 */
interface PrismaError {
  /** Error name/type */
  name: string;
  /** Prisma error code */
  code: string;
  /** Prisma client version */
  clientVersion: string;
  /** Additional error metadata (optional) */
  meta?: Record<string, unknown>;
  /** Error message */
  message: string;
}

/**
 * Type guards for error checking
 */

/**
 * Type guard to check if an error is a PostgreSQL error
 * @param {unknown} err - The error to check
 * @returns {boolean} True if the error is a PostgreSQL error
 */
function isPostgreSQLError(err: unknown): err is PostgreSQLError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    "message" in err &&
    !("clientVersion" in err)
  ); // Not a Prisma error
}

/**
 * Type guard to check if an error is a database connection error
 * @param {unknown} err - The error to check
 * @returns {boolean} True if the error is a connection error
 */
function isConnectionError(err: unknown): err is ConnectionError {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string" &&
    (err as { message: string }).message.includes("connect")
  );
}

/**
 * Type guard to check if an error is a Prisma error
 * @param {unknown} err - The error to check
 * @returns {boolean} True if the error is a Prisma error
 */
function isPrismaError(err: unknown): err is PrismaError {
  return (
    typeof err === "object" &&
    err !== null &&
    "clientVersion" in err &&
    "code" in err &&
    "message" in err
  );
}

/**
 * Type definitions for maintenance operations
 */

/**
 * Represents a database maintenance operation
 * @interface MaintenanceOperation
 */
interface MaintenanceOperation {
  /** Unique identifier for the operation */
  name: string;
  /** SQL statement to execute */
  sql: string;
  /** Human-readable description of the operation */
  description: string;
}

/**
 * Represents the result of a maintenance operation
 * @interface MaintenanceResult
 */
interface MaintenanceResult {
  /** The operation that was performed */
  operation: MaintenanceOperation;
  /** Whether the operation was successful */
  success: boolean;
  /** Error information if the operation failed */
  error?: Error | PostgreSQLError | ConnectionError | PrismaError;
  /** Execution time in milliseconds (if available) */
  executionTimeMs?: number;
}

/**
 * Runs database maintenance operations including VACUUM, ANALYZE, and index maintenance
 * @returns {Promise<void>}
 */
async function runMaintenance() {
  //console.log('Starting database maintenance...');
  // Track start time for potential logging
  // const startTime = Date.now();

  // Define maintenance operations with proper typing
  const maintenanceOperations: MaintenanceOperation[] = [
    {
      name: "VACUUM_ANALYZE",
      sql: "VACUUM ANALYZE;",
      description: "Reclaim storage and update statistics",
    },
    {
      name: "ANALYZE",
      sql: "ANALYZE;",
      description: "Update query planner statistics",
    },
  ];

  // Track results of operations
  const results: MaintenanceResult[] = [];

  try {
    // Get database connection info from Prisma
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    // 1. Run VACUUM ANALYZE on all tables
    //console.log('Running VACUUM ANALYZE on all tables...');
    const vacuumStartTime = Date.now();
    await prisma.$executeRawUnsafe(maintenanceOperations[0].sql);
    results.push({
      operation: maintenanceOperations[0],
      success: true,
      executionTimeMs: Date.now() - vacuumStartTime,
    });

    // 2. Update statistics for the query planner
    //console.log('Running ANALYZE to update query planner statistics...');
    const analyzeStartTime = Date.now();
    await prisma.$executeRawUnsafe(maintenanceOperations[1].sql);
    results.push({
      operation: maintenanceOperations[1],
      success: true,
      executionTimeMs: Date.now() - analyzeStartTime,
    });

    // 3. Identify and rebuild bloated indexes
    //console.log('Checking for bloated indexes...');
    /**
     * Database query result types
     */

    /**
     * Information about a potentially bloated database index
     * @interface BloatedIndexInfo
     */
    interface BloatedIndexInfo {
      /** Fully qualified table name (schema.table) */
      table_name: string;
      /** Name of the index */
      index_name: string;
      /** Formatted size of the index (e.g., "150 MB") */
      index_size: string; // Using string as pg_size_pretty returns formatted string
      /** Formatted size of the table (e.g., "1 GB") */
      table_size: string;
    }

    /** Array of bloated index information returned from the query */
    type BloatedIndexQueryResult = BloatedIndexInfo[];

    const bloatedIndexesQuery = `
      SELECT 
        schemaname || '.' || tablename AS table_name,
        indexrelname AS index_name,
        pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
        pg_size_pretty(pg_relation_size(i.indrelid)) AS table_size
      FROM 
        pg_stat_user_indexes i
        JOIN pg_index USING (indexrelid)
      WHERE 
        pg_relation_size(i.indexrelid) > 100000000 -- Indexes larger than 100MB
        AND NOT indisunique -- Non-unique indexes are easier to rebuild
      ORDER BY 
        pg_relation_size(i.indexrelid) DESC;
    `;

    const bloatedIndexes =
      await prisma.$queryRawUnsafe<BloatedIndexQueryResult>(
        bloatedIndexesQuery,
      );

    if (Array.isArray(bloatedIndexes) && bloatedIndexes.length > 0) {
      //console.log(`Found ${bloatedIndexes.length} potentially bloated indexes`);

      // Rebuild each bloated index
      for (const index of bloatedIndexes) {
        //console.log(`Rebuilding index ${index.index_name} on ${index.table_name} (${index.index_size})...`);
        try {
          await prisma.$executeRawUnsafe(
            `REINDEX INDEX "${index.index_name}";`,
          );
          //console.log(`Successfully rebuilt index ${index.index_name}`);
        } catch (error) {
          console.error(`Error rebuilding index ${index.index_name}:`, error);
        }
      }
    } else {
      //console.log('No bloated indexes found');
    }

    // 4. Check for unused indexes
    //console.log('Checking for unused indexes...');
    /**
     * Information about a potentially unused database index
     * @interface UnusedIndexInfo
     */
    interface UnusedIndexInfo {
      /** Fully qualified table name (schema.table) */
      table_name: string;
      /** Name of the index */
      index_name: string;
      /** Formatted size of the index (e.g., "150 MB") */
      index_size: string; // Using string as pg_size_pretty returns formatted string
      /** Number of times the index has been scanned */
      index_scans: number;
    }

    /** Array of unused index information returned from the query */
    type UnusedIndexQueryResult = UnusedIndexInfo[];

    const unusedIndexesQuery = `
      SELECT
        schemaname || '.' || relname AS table_name,
        indexrelname AS index_name,
        pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
        idx_scan AS index_scans
      FROM
        pg_stat_user_indexes i
        JOIN pg_index USING (indexrelid)
      WHERE
        idx_scan < 50
        AND pg_relation_size(i.indexrelid) > 10000000 -- Indexes larger than 10MB
        AND NOT indisunique -- Don't suggest removing unique constraints
        AND NOT indisprimary -- Don't suggest removing primary keys
      ORDER BY
        pg_relation_size(i.indexrelid) DESC;
    `;

    const unusedIndexes =
      await prisma.$queryRawUnsafe<UnusedIndexQueryResult>(unusedIndexesQuery);

    if (Array.isArray(unusedIndexes) && unusedIndexes.length > 0) {
      //console.log('\nUnused indexes detected:');
      //console.log('====================================');
      //console.log('The following indexes have low usage and could be candidates for removal:');
      // Uncomment this loop when index reporting is needed
      // for (const index of unusedIndexes) {
      //   console.log(`- ${index.index_name} on ${index.table_name} (${index.index_size}, ${index.index_scans} scans)`);
      // }
      //console.log('\nReview these indexes before removing them.');
    } else {
      //console.log('No unused indexes found');
    }

    // 5. Log table sizes for monitoring
    //console.log('\nTable sizes:');

    /**
     * Information about table sizes in the database
     * @interface TableSizeInfo
     */
    interface TableSizeInfo {
      /** Name of the table */
      table_name: string;
      /** Formatted total size including indexes (e.g., "1.5 GB") */
      total_size: string; // Using string as pg_size_pretty returns formatted string
      /** Formatted size of the table data only (e.g., "1 GB") */
      table_size: string;
      /** Formatted size of all indexes on the table (e.g., "500 MB") */
      index_size: string;
      /** Estimated number of rows in the table */
      row_count: number;
    }

    /** Array of table size information returned from the query */
    type TableSizeQueryResult = TableSizeInfo[];

    const tableSizesQuery = `
      SELECT
        relname AS table_name,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
        pg_size_pretty(pg_relation_size(relid)) AS table_size,
        pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size,
        reltuples::bigint AS row_count
      FROM
        pg_catalog.pg_statio_user_tables
      ORDER BY
        pg_total_relation_size(relid) DESC
      LIMIT 10;
    `;

    const tableSizes =
      await prisma.$queryRawUnsafe<TableSizeQueryResult>(tableSizesQuery);

    if (Array.isArray(tableSizes)) {
      // Uncomment this loop when table size reporting is needed
      // for (const table of tableSizes) {
      //   console.log(`- ${table.table_name}: ${table.total_size} (${table.row_count} rows)`);
      // }
    }

    //console.log('\nDatabase maintenance completed successfully');
  } catch (error: unknown) {
    // Record the error in the results
    const failedOperation: MaintenanceOperation = {
      name: "UNKNOWN_OPERATION",
      sql: "",
      description: "Operation that failed with an error",
    };

    const errorResult: MaintenanceResult = {
      operation: failedOperation,
      success: false,
      error: error as Error,
    };

    results.push(errorResult);

    // Log the error with appropriate type information
    if (isPrismaError(error)) {
      console.error(
        `Prisma error during maintenance: ${error.code} - ${error.message}`,
      );
      console.error(`Prisma client version: ${error.clientVersion}`);
      if (error.meta) {
        console.error(`Error metadata:`, error.meta);
      }
    } else if (isPostgreSQLError(error)) {
      console.error(
        `PostgreSQL error during maintenance: ${error.code} - ${error.message}`,
      );
      if (error.detail) {
        console.error(`Error detail: ${error.detail}`);
      }
    } else if (isConnectionError(error)) {
      console.error(`Database connection error: ${error.message}`);
      if (error.address) {
        console.error(
          `Failed to connect to ${error.address}${error.port ? `:${error.port}` : ""}`,
        );
      }
    } else {
      console.error("Error during database maintenance:", error);
    }
  } finally {
    // Log a summary of all operations
    // Uncomment for detailed logging
    /*
    console.log('\nMaintenance operations summary:');
    for (const result of results) {
      const status = result.success ? 'SUCCESS' : 'FAILED';
      const time = result.executionTimeMs ? `${result.executionTimeMs}ms` : 'N/A';
      console.log(`- ${result.operation.name}: ${status} (${time})`);
    }
    */

    await prisma.$disconnect();
  }
}

/**
 * Run the maintenance script with proper error handling and exit codes
 * This function is designed to be the entry point when running the script directly.
 * It handles all errors and provides appropriate exit codes for process termination.
 *
 * @returns {Promise<void>} A promise that resolves when maintenance completes
 * @throws {never} This function handles all errors internally and doesn't throw
 */
async function executeMaintenanceScript(): Promise<void> {
  try {
    await runMaintenance();
    //console.log('Maintenance completed successfully');
    process.exit(0);
  } catch (error: unknown) {
    // Error details are logged directly in the specific error handlers below
    // No need to create a separate variable

    // Log with appropriate type information
    if (isPrismaError(error)) {
      console.error(
        `Prisma error during maintenance: ${error.code} - ${error.message}`,
      );
      console.error(`Prisma client version: ${error.clientVersion}`);
      if (error.meta) {
        console.error(`Error metadata:`, error.meta);
      }
    } else if (isPostgreSQLError(error)) {
      console.error(
        `PostgreSQL error during maintenance: ${error.code} - ${error.message}`,
      );
      if (error.detail) {
        console.error(`Error detail: ${error.detail}`);
      }
    } else if (isConnectionError(error)) {
      console.error(`Database connection error: ${error.message}`);
      if (error.address) {
        console.error(
          `Failed to connect to ${error.address}${error.port ? `:${error.port}` : ""}`,
        );
      }
    } else {
      console.error("Maintenance failed:", error);
    }
    process.exit(1);
  }
}

// Run the maintenance if this is the main script
if (require.main === module) {
  executeMaintenanceScript().catch((error) => {
    console.error("Unhandled error in maintenance script:", error);
    process.exit(1);
  });
}

// Export types and functions for reuse in other modules
export {
  runMaintenance,
  // Error types and type guards
  PostgreSQLError,
  ConnectionError,
  PrismaError,
  isPostgreSQLError,
  isConnectionError,
  isPrismaError,
  // Maintenance types
  MaintenanceOperation,
  MaintenanceResult,
  // Query result types
  BloatedIndexInfo,
  BloatedIndexQueryResult,
  UnusedIndexInfo,
  UnusedIndexQueryResult,
  TableSizeInfo,
  TableSizeQueryResult,
};
