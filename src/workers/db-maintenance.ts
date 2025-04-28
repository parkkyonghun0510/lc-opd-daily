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
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function runMaintenance() {
  //console.log('Starting database maintenance...');
  const startTime = Date.now();

  try {
    // Get database connection info from Prisma
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Extract database name from connection URL
    const matches = url.match(/\/([^?]*)/);
    const dbName = matches ? matches[1] : null;

    if (!dbName) {
      throw new Error('Could not parse database name from connection URL');
    }

    // 1. Run VACUUM ANALYZE on all tables
    //console.log('Running VACUUM ANALYZE on all tables...');
    await prisma.$executeRawUnsafe('VACUUM ANALYZE;');

    // 2. Update statistics for the query planner
    //console.log('Running ANALYZE to update query planner statistics...');
    await prisma.$executeRawUnsafe('ANALYZE;');

    // 3. Identify and rebuild bloated indexes
    //console.log('Checking for bloated indexes...');
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

    const bloatedIndexes = await prisma.$queryRawUnsafe(bloatedIndexesQuery);

    if (Array.isArray(bloatedIndexes) && bloatedIndexes.length > 0) {
      //console.log(`Found ${bloatedIndexes.length} potentially bloated indexes`);

      // Rebuild each bloated index
      for (const index of bloatedIndexes) {
        //console.log(`Rebuilding index ${index.index_name} on ${index.table_name} (${index.index_size})...`);
        try {
          await prisma.$executeRawUnsafe(`REINDEX INDEX "${index.index_name}";`);
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

    const unusedIndexes = await prisma.$queryRawUnsafe(unusedIndexesQuery);

    if (Array.isArray(unusedIndexes) && unusedIndexes.length > 0) {
      //console.log('\nUnused indexes detected:');
      //console.log('====================================');
      //console.log('The following indexes have low usage and could be candidates for removal:');

      for (const index of unusedIndexes) {
        //console.log(`- ${index.index_name} on ${index.table_name} (${index.index_size}, ${index.index_scans} scans)`);
      }
      //console.log('\nReview these indexes before removing them.');
    } else {
      //console.log('No unused indexes found');
    }

    // 5. Log table sizes for monitoring
    //console.log('\nTable sizes:');
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

    const tableSizes = await prisma.$queryRawUnsafe(tableSizesQuery);

    if (Array.isArray(tableSizes)) {
      for (const table of tableSizes) {
        //console.log(`- ${table.table_name}: ${table.total_size} (${table.row_count} rows)`);
      }
    }

    const elapsedTime = (Date.now() - startTime) / 1000;
    //console.log(`\nDatabase maintenance completed in ${elapsedTime.toFixed(2)} seconds`);

  } catch (error) {
    console.error('Error during database maintenance:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the maintenance if this is the main script
if (require.main === module) {
  runMaintenance()
    .then(() => {
      //console.log('Maintenance completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Maintenance failed:', error);
      process.exit(1);
    });
}

export { runMaintenance }; 