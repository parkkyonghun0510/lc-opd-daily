#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env.production') });

class HealthChecker {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {}
    };
  }

  async checkDatabase() {
    try {
      const prisma = new PrismaClient();
      await prisma.$connect();
      const userCount = await prisma.user.count();
      await prisma.$disconnect();
      
      this.results.checks.database = {
        status: 'healthy',
        message: `Connected successfully. Users: ${userCount}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.results.checks.database = {
        status: 'unhealthy',
        message: `Database connection failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      this.results.status = 'unhealthy';
    }
  }

  async checkRedis() {
    try {
      const redis = new Redis(process.env.DRAGONFLY_URL || 'redis://localhost:6379');
      const pong = await redis.ping();
      const info = await redis.info('memory');
      await redis.disconnect();
      
      this.results.checks.redis = {
        status: 'healthy',
        message: `Redis/Dragonfly responding: ${pong}`,
        details: { memory_info: info.split('\n')[1] },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.results.checks.redis = {
        status: 'unhealthy',
        message: `Redis/Dragonfly connection failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      this.results.status = 'unhealthy';
    }
  }

  checkPM2Processes() {
    try {
      const pm2List = execSync('pm2 jlist', { encoding: 'utf8' });
      const processes = JSON.parse(pm2List);
      
      const processStatus = processes.map(proc => ({
        name: proc.name,
        status: proc.pm2_env.status,
        restarts: proc.pm2_env.restart_time,
        memory: Math.round(proc.monit.memory / 1024 / 1024) + 'MB',
        cpu: proc.monit.cpu + '%'
      }));
      
      const unhealthyProcesses = processes.filter(proc => 
        proc.pm2_env.status !== 'online' || proc.pm2_env.restart_time > 50
      );
      
      this.results.checks.pm2 = {
        status: unhealthyProcesses.length === 0 ? 'healthy' : 'warning',
        message: `${processes.length} processes monitored`,
        details: { processes: processStatus },
        timestamp: new Date().toISOString()
      };
      
      if (unhealthyProcesses.length > 0) {
        this.results.checks.pm2.warnings = unhealthyProcesses.map(proc => 
          `${proc.name}: ${proc.pm2_env.status}, restarts: ${proc.pm2_env.restart_time}`
        );
      }
    } catch (error) {
      this.results.checks.pm2 = {
        status: 'unhealthy',
        message: `PM2 check failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      this.results.status = 'unhealthy';
    }
  }

  checkDiskSpace() {
    try {
      const df = execSync('df -h /', { encoding: 'utf8' });
      const lines = df.trim().split('\n');
      const diskInfo = lines[1].split(/\s+/);
      const usedPercent = parseInt(diskInfo[4]);
      
      this.results.checks.disk = {
        status: usedPercent > 85 ? 'warning' : 'healthy',
        message: `Disk usage: ${diskInfo[4]} (${diskInfo[2]}/${diskInfo[1]})`,
        details: {
          total: diskInfo[1],
          used: diskInfo[2],
          available: diskInfo[3],
          percentage: diskInfo[4]
        },
        timestamp: new Date().toISOString()
      };
      
      if (usedPercent > 90) {
        this.results.status = 'unhealthy';
      }
    } catch (error) {
      this.results.checks.disk = {
        status: 'unhealthy',
        message: `Disk check failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  checkMemory() {
    try {
      const free = execSync('free -m', { encoding: 'utf8' });
      const lines = free.trim().split('\n');
      const memInfo = lines[1].split(/\s+/);
      const total = parseInt(memInfo[1]);
      const used = parseInt(memInfo[2]);
      const usedPercent = Math.round((used / total) * 100);
      
      this.results.checks.memory = {
        status: usedPercent > 85 ? 'warning' : 'healthy',
        message: `Memory usage: ${usedPercent}% (${used}MB/${total}MB)`,
        details: {
          total: total + 'MB',
          used: used + 'MB',
          free: (total - used) + 'MB',
          percentage: usedPercent + '%'
        },
        timestamp: new Date().toISOString()
      };
      
      if (usedPercent > 95) {
        this.results.status = 'unhealthy';
      }
    } catch (error) {
      this.results.checks.memory = {
        status: 'unhealthy',
        message: `Memory check failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  checkLogFiles() {
    try {
      const logsDir = path.join(__dirname, '..', 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      const logFiles = fs.readdirSync(logsDir);
      const logSizes = logFiles.map(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        return {
          file,
          size: Math.round(stats.size / 1024 / 1024 * 100) / 100 + 'MB',
          modified: stats.mtime.toISOString()
        };
      });
      
      const largeLogs = logSizes.filter(log => parseFloat(log.size) > 100);
      
      this.results.checks.logs = {
        status: largeLogs.length === 0 ? 'healthy' : 'warning',
        message: `${logFiles.length} log files monitored`,
        details: { files: logSizes },
        timestamp: new Date().toISOString()
      };
      
      if (largeLogs.length > 0) {
        this.results.checks.logs.warnings = largeLogs.map(log => 
          `${log.file}: ${log.size} (consider rotation)`
        );
      }
    } catch (error) {
      this.results.checks.logs = {
        status: 'warning',
        message: `Log check failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  async runAllChecks() {
    console.log('🔍 Starting health checks...');
    
    await this.checkDatabase();
    await this.checkRedis();
    this.checkPM2Processes();
    this.checkDiskSpace();
    this.checkMemory();
    this.checkLogFiles();
    
    return this.results;
  }

  generateReport() {
    const statusEmoji = {
      healthy: '✅',
      warning: '⚠️',
      unhealthy: '❌'
    };
    
    console.log(`\n${statusEmoji[this.results.status]} Overall Status: ${this.results.status.toUpperCase()}`);
    console.log(`📅 Timestamp: ${this.results.timestamp}\n`);
    
    Object.entries(this.results.checks).forEach(([check, result]) => {
      console.log(`${statusEmoji[result.status]} ${check.toUpperCase()}: ${result.message}`);
      
      if (result.warnings) {
        result.warnings.forEach(warning => {
          console.log(`   ⚠️  ${warning}`);
        });
      }
      
      if (result.details && process.argv.includes('--verbose')) {
        console.log(`   📊 Details:`, JSON.stringify(result.details, null, 2));
      }
    });
    
    console.log('\n' + '='.repeat(50));
  }

  saveReport() {
    const reportsDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const filename = `health-check-${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(reportsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
    console.log(`📄 Report saved to: ${filepath}`);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const checker = new HealthChecker();
  
  checker.runAllChecks()
    .then(() => {
      checker.generateReport();
      
      if (process.argv.includes('--save')) {
        checker.saveReport();
      }
      
      // Exit with appropriate code
      process.exit(checker.results.status === 'unhealthy' ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Health check failed:', error);
      process.exit(1);
    });
}

export default HealthChecker;