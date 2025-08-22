#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.production') });

class DatabaseCleaner {
  constructor() {
    this.prisma = new PrismaClient();
    this.dryRun = process.argv.includes('--dry-run');
    this.verbose = process.argv.includes('--verbose');
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = this.dryRun ? '[DRY RUN] ' : '';
    const emoji = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    
    console.log(`${emoji[level]} ${timestamp} ${prefix}${message}`);
  }

  async cleanOldNotifications(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      this.log(`Cleaning notifications older than ${daysOld} days (before ${cutoffDate.toISOString()})`);
      
      // Check if notification table exists
      const tables = await this.prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('notification', 'notifications')
      `;
      
      if (tables.length === 0) {
        this.log('No notification table found, skipping notification cleanup', 'warning');
        return { deleted: 0 };
      }
      
      // Count notifications to be deleted
      const countQuery = `
        SELECT COUNT(*) as count 
        FROM notification 
        WHERE created_at < $1
      `;
      
      const countResult = await this.prisma.$queryRawUnsafe(countQuery, cutoffDate);
      const notificationCount = parseInt(countResult[0]?.count || 0);
      
      this.log(`Found ${notificationCount} old notifications to clean`);
      
      if (notificationCount === 0) {
        return { deleted: 0 };
      }
      
      if (!this.dryRun) {
        const deleteQuery = `
          DELETE FROM notification 
          WHERE created_at < $1
        `;
        
        await this.prisma.$queryRawUnsafe(deleteQuery, cutoffDate);
        this.log(`Successfully deleted ${notificationCount} old notifications`, 'success');
      } else {
        this.log(`Would delete ${notificationCount} old notifications`);
      }
      
      return { deleted: notificationCount };
    } catch (error) {
      this.log(`Error cleaning notifications: ${error.message}`, 'error');
      throw error;
    }
  }

  async cleanOldLogs(daysOld = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      this.log(`Cleaning log entries older than ${daysOld} days (before ${cutoffDate.toISOString()})`);
      
      // Check if log table exists
      const tables = await this.prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('log', 'logs', 'audit_log')
      `;
      
      if (tables.length === 0) {
        this.log('No log table found, skipping log cleanup', 'warning');
        return { deleted: 0 };
      }
      
      const tableName = tables[0].table_name;
      
      // Count logs to be deleted
      const countQuery = `
        SELECT COUNT(*) as count 
        FROM ${tableName} 
        WHERE created_at < $1
      `;
      
      const countResult = await this.prisma.$queryRawUnsafe(countQuery, cutoffDate);
      const logCount = parseInt(countResult[0]?.count || 0);
      
      this.log(`Found ${logCount} old log entries to clean`);
      
      if (logCount === 0) {
        return { deleted: 0 };
      }
      
      if (!this.dryRun) {
        const deleteQuery = `
          DELETE FROM ${tableName} 
          WHERE created_at < $1
        `;
        
        await this.prisma.$queryRawUnsafe(deleteQuery, cutoffDate);
        this.log(`Successfully deleted ${logCount} old log entries`, 'success');
      } else {
        this.log(`Would delete ${logCount} old log entries`);
      }
      
      return { deleted: logCount };
    } catch (error) {
      this.log(`Error cleaning logs: ${error.message}`, 'error');
      throw error;
    }
  }

  async cleanOldSessions(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      this.log(`Cleaning expired sessions older than ${daysOld} days`);
      
      // Check if session table exists
      const tables = await this.prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('session', 'sessions', 'user_session')
      `;
      
      if (tables.length === 0) {
        this.log('No session table found, skipping session cleanup', 'warning');
        return { deleted: 0 };
      }
      
      const tableName = tables[0].table_name;
      
      // Count sessions to be deleted
      const countQuery = `
        SELECT COUNT(*) as count 
        FROM ${tableName} 
        WHERE (expires_at < NOW() OR updated_at < $1)
      `;
      
      const countResult = await this.prisma.$queryRawUnsafe(countQuery, cutoffDate);
      const sessionCount = parseInt(countResult[0]?.count || 0);
      
      this.log(`Found ${sessionCount} expired sessions to clean`);
      
      if (sessionCount === 0) {
        return { deleted: 0 };
      }
      
      if (!this.dryRun) {
        const deleteQuery = `
          DELETE FROM ${tableName} 
          WHERE (expires_at < NOW() OR updated_at < $1)
        `;
        
        await this.prisma.$queryRawUnsafe(deleteQuery, cutoffDate);
        this.log(`Successfully deleted ${sessionCount} expired sessions`, 'success');
      } else {
        this.log(`Would delete ${sessionCount} expired sessions`);
      }
      
      return { deleted: sessionCount };
    } catch (error) {
      this.log(`Error cleaning sessions: ${error.message}`, 'error');
      throw error;
    }
  }

  async optimizeDatabase() {
    try {
      this.log('Running database optimization...');
      
      if (!this.dryRun) {
        // Analyze tables for better query planning
        await this.prisma.$queryRaw`ANALYZE`;
        
        // Vacuum to reclaim space (PostgreSQL)
        try {
          await this.prisma.$queryRaw`VACUUM`;
          this.log('Database vacuum completed', 'success');
        } catch (error) {
          this.log(`Vacuum failed (may not be supported): ${error.message}`, 'warning');
        }
        
        this.log('Database optimization completed', 'success');
      } else {
        this.log('Would run ANALYZE and VACUUM on database');
      }
    } catch (error) {
      this.log(`Error optimizing database: ${error.message}`, 'error');
      throw error;
    }
  }

  async generateReport() {
    try {
      this.log('Generating database statistics...');
      
      // Get table sizes
      const tableSizes = await this.prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `;
      
      // Get row counts for main tables
      const userCount = await this.prisma.user.count();
      
      const report = {
        timestamp: new Date().toISOString(),
        database_size: tableSizes,
        row_counts: {
          users: userCount
        }
      };
      
      if (this.verbose) {
        console.log('\n📊 Database Report:');
        console.log('==================');
        console.log(`Users: ${userCount}`);
        console.log('\nTable Sizes:');
        tableSizes.forEach(table => {
          console.log(`  ${table.tablename}: ${table.size}`);
        });
      }
      
      return report;
    } catch (error) {
      this.log(`Error generating report: ${error.message}`, 'error');
      throw error;
    }
  }

  async cleanup() {
    try {
      this.log('Starting database cleanup process...');
      
      const results = {
        notifications: await this.cleanOldNotifications(30),
        logs: await this.cleanOldLogs(7),
        sessions: await this.cleanOldSessions(30)
      };
      
      await this.optimizeDatabase();
      const report = await this.generateReport();
      
      this.log('Database cleanup completed successfully', 'success');
      
      return { results, report };
    } catch (error) {
      this.log(`Database cleanup failed: ${error.message}`, 'error');
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const cleaner = new DatabaseCleaner();
  
  console.log('🧹 Database Cleanup Tool');
  console.log('========================');
  
  if (process.argv.includes('--help')) {
    console.log('Usage: node db-cleanup.js [options]');
    console.log('Options:');
    console.log('  --dry-run    Show what would be deleted without actually deleting');
    console.log('  --verbose    Show detailed output');
    console.log('  --help       Show this help message');
    process.exit(0);
  }
  
  cleaner.cleanup()
    .then((result) => {
      console.log('\n✅ Cleanup completed successfully');
      if (cleaner.verbose) {
        console.log('Results:', JSON.stringify(result.results, null, 2));
      }
    })
    .catch((error) => {
      console.error('❌ Cleanup failed:', error.message);
      process.exit(1);
    });
}

export default DatabaseCleaner;