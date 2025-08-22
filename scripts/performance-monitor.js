#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.production') });

class PerformanceMonitor {
  constructor() {
    this.thresholds = {
      cpu: 80,        // CPU usage percentage
      memory: 85,     // Memory usage percentage
      disk: 85,       // Disk usage percentage
      load: 2.0,      // Load average (1 minute)
      restarts: 10    // PM2 process restarts
    };
    
    this.alerts = [];
    this.metrics = {
      timestamp: new Date().toISOString(),
      system: {},
      processes: {},
      alerts: []
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const emoji = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      alert: '🚨'
    };
    
    console.log(`${emoji[level]} ${timestamp} ${message}`);
  }

  addAlert(type, message, severity = 'warning', value = null, threshold = null) {
    const alert = {
      type,
      message,
      severity,
      value,
      threshold,
      timestamp: new Date().toISOString()
    };
    
    this.alerts.push(alert);
    this.metrics.alerts.push(alert);
    
    const emoji = severity === 'critical' ? '🚨' : '⚠️';
    this.log(`${emoji} ALERT [${type.toUpperCase()}]: ${message}`, 'alert');
  }

  getCPUUsage() {
    try {
      // Get CPU usage using top command
      const topOutput = execSync('top -bn1 | grep "Cpu(s)"', { encoding: 'utf8' });
      const cpuMatch = topOutput.match(/([0-9.]+)%us/);
      const cpuUsage = cpuMatch ? parseFloat(cpuMatch[1]) : 0;
      
      this.metrics.system.cpu = {
        usage_percent: cpuUsage,
        timestamp: new Date().toISOString()
      };
      
      if (cpuUsage > this.thresholds.cpu) {
        this.addAlert(
          'cpu',
          `High CPU usage: ${cpuUsage}%`,
          cpuUsage > 95 ? 'critical' : 'warning',
          cpuUsage,
          this.thresholds.cpu
        );
      }
      
      return cpuUsage;
    } catch (error) {
      this.log(`Error getting CPU usage: ${error.message}`, 'error');
      return null;
    }
  }

  getMemoryUsage() {
    try {
      const free = execSync('free -m', { encoding: 'utf8' });
      const lines = free.trim().split('\n');
      const memInfo = lines[1].split(/\s+/);
      const total = parseInt(memInfo[1]);
      const used = parseInt(memInfo[2]);
      const available = parseInt(memInfo[6] || memInfo[3]); // available or free
      const usedPercent = Math.round((used / total) * 100);
      
      this.metrics.system.memory = {
        total_mb: total,
        used_mb: used,
        available_mb: available,
        usage_percent: usedPercent,
        timestamp: new Date().toISOString()
      };
      
      if (usedPercent > this.thresholds.memory) {
        this.addAlert(
          'memory',
          `High memory usage: ${usedPercent}% (${used}MB/${total}MB)`,
          usedPercent > 95 ? 'critical' : 'warning',
          usedPercent,
          this.thresholds.memory
        );
      }
      
      return usedPercent;
    } catch (error) {
      this.log(`Error getting memory usage: ${error.message}`, 'error');
      return null;
    }
  }

  getDiskUsage() {
    try {
      const df = execSync('df -h /', { encoding: 'utf8' });
      const lines = df.trim().split('\n');
      const diskInfo = lines[1].split(/\s+/);
      const usedPercent = parseInt(diskInfo[4]);
      
      this.metrics.system.disk = {
        total: diskInfo[1],
        used: diskInfo[2],
        available: diskInfo[3],
        usage_percent: usedPercent,
        timestamp: new Date().toISOString()
      };
      
      if (usedPercent > this.thresholds.disk) {
        this.addAlert(
          'disk',
          `High disk usage: ${usedPercent}% (${diskInfo[2]}/${diskInfo[1]})`,
          usedPercent > 95 ? 'critical' : 'warning',
          usedPercent,
          this.thresholds.disk
        );
      }
      
      return usedPercent;
    } catch (error) {
      this.log(`Error getting disk usage: ${error.message}`, 'error');
      return null;
    }
  }

  getLoadAverage() {
    try {
      const uptime = execSync('uptime', { encoding: 'utf8' });
      const loadMatch = uptime.match(/load average: ([0-9.]+), ([0-9.]+), ([0-9.]+)/);
      
      if (loadMatch) {
        const load1 = parseFloat(loadMatch[1]);
        const load5 = parseFloat(loadMatch[2]);
        const load15 = parseFloat(loadMatch[3]);
        
        this.metrics.system.load = {
          load_1min: load1,
          load_5min: load5,
          load_15min: load15,
          timestamp: new Date().toISOString()
        };
        
        if (load1 > this.thresholds.load) {
          this.addAlert(
            'load',
            `High system load: ${load1} (1min average)`,
            load1 > 4.0 ? 'critical' : 'warning',
            load1,
            this.thresholds.load
          );
        }
        
        return { load1, load5, load15 };
      }
      
      return null;
    } catch (error) {
      this.log(`Error getting load average: ${error.message}`, 'error');
      return null;
    }
  }

  getPM2ProcessMetrics() {
    try {
      const pm2List = execSync('pm2 jlist', { encoding: 'utf8' });
      const processes = JSON.parse(pm2List);
      
      const processMetrics = processes.map(proc => {
        const metrics = {
          name: proc.name,
          pid: proc.pid,
          status: proc.pm2_env.status,
          restarts: proc.pm2_env.restart_time,
          uptime: proc.pm2_env.pm_uptime,
          memory_mb: Math.round(proc.monit.memory / 1024 / 1024),
          cpu_percent: proc.monit.cpu,
          timestamp: new Date().toISOString()
        };
        
        // Check for high restart count
        if (metrics.restarts > this.thresholds.restarts) {
          this.addAlert(
            'process_restarts',
            `Process ${metrics.name} has high restart count: ${metrics.restarts}`,
            metrics.restarts > 50 ? 'critical' : 'warning',
            metrics.restarts,
            this.thresholds.restarts
          );
        }
        
        // Check for stopped processes
        if (metrics.status !== 'online') {
          this.addAlert(
            'process_status',
            `Process ${metrics.name} is not online: ${metrics.status}`,
            'critical',
            metrics.status
          );
        }
        
        // Check for high memory usage (per process)
        if (metrics.memory_mb > 500) {
          this.addAlert(
            'process_memory',
            `Process ${metrics.name} using high memory: ${metrics.memory_mb}MB`,
            metrics.memory_mb > 1000 ? 'critical' : 'warning',
            metrics.memory_mb,
            500
          );
        }
        
        return metrics;
      });
      
      this.metrics.processes = processMetrics;
      return processMetrics;
    } catch (error) {
      this.log(`Error getting PM2 metrics: ${error.message}`, 'error');
      return [];
    }
  }

  checkDatabaseConnections() {
    try {
      // Check for database connection leaks
      const netstat = execSync('netstat -an | grep :5432 | wc -l', { encoding: 'utf8' });
      const dbConnections = parseInt(netstat.trim());
      
      this.metrics.system.database_connections = {
        count: dbConnections,
        timestamp: new Date().toISOString()
      };
      
      if (dbConnections > 50) {
        this.addAlert(
          'database_connections',
          `High number of database connections: ${dbConnections}`,
          dbConnections > 100 ? 'critical' : 'warning',
          dbConnections,
          50
        );
      }
      
      return dbConnections;
    } catch (error) {
      this.log(`Error checking database connections: ${error.message}`, 'error');
      return null;
    }
  }

  async runMonitoring() {
    this.log('Starting performance monitoring...');
    
    // Collect all metrics
    this.getCPUUsage();
    this.getMemoryUsage();
    this.getDiskUsage();
    this.getLoadAverage();
    this.getPM2ProcessMetrics();
    this.checkDatabaseConnections();
    
    return this.metrics;
  }

  generateReport() {
    console.log('\n📊 Performance Monitoring Report');
    console.log('================================');
    console.log(`Timestamp: ${this.metrics.timestamp}`);
    
    // System metrics
    if (this.metrics.system.cpu) {
      console.log(`\n🖥️  System Metrics:`);
      console.log(`   CPU Usage: ${this.metrics.system.cpu.usage_percent}%`);
    }
    
    if (this.metrics.system.memory) {
      console.log(`   Memory Usage: ${this.metrics.system.memory.usage_percent}% (${this.metrics.system.memory.used_mb}MB/${this.metrics.system.memory.total_mb}MB)`);
    }
    
    if (this.metrics.system.disk) {
      console.log(`   Disk Usage: ${this.metrics.system.disk.usage_percent}% (${this.metrics.system.disk.used}/${this.metrics.system.disk.total})`);
    }
    
    if (this.metrics.system.load) {
      console.log(`   Load Average: ${this.metrics.system.load.load_1min} (1m), ${this.metrics.system.load.load_5min} (5m), ${this.metrics.system.load.load_15min} (15m)`);
    }
    
    // Process metrics
    if (this.metrics.processes.length > 0) {
      console.log(`\n🔄 Process Metrics:`);
      this.metrics.processes.forEach(proc => {
        const status = proc.status === 'online' ? '✅' : '❌';
        console.log(`   ${status} ${proc.name}: ${proc.status}, Memory: ${proc.memory_mb}MB, CPU: ${proc.cpu_percent}%, Restarts: ${proc.restarts}`);
      });
    }
    
    // Alerts
    if (this.alerts.length > 0) {
      console.log(`\n🚨 Active Alerts (${this.alerts.length}):`);
      this.alerts.forEach(alert => {
        const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';
        console.log(`   ${emoji} [${alert.type.toUpperCase()}] ${alert.message}`);
      });
    } else {
      console.log('\n✅ No alerts - system is performing well');
    }
    
    console.log('\n' + '='.repeat(50));
  }

  saveMetrics() {
    try {
      const metricsDir = path.join(__dirname, '..', 'metrics');
      if (!fs.existsSync(metricsDir)) {
        fs.mkdirSync(metricsDir, { recursive: true });
      }
      
      const filename = `performance-${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(metricsDir, filename);
      
      // Load existing metrics for the day if they exist
      let dailyMetrics = [];
      if (fs.existsSync(filepath)) {
        const existingData = fs.readFileSync(filepath, 'utf8');
        dailyMetrics = JSON.parse(existingData);
      }
      
      // Add current metrics
      dailyMetrics.push(this.metrics);
      
      // Keep only last 24 hours of data (assuming hourly checks)
      if (dailyMetrics.length > 24) {
        dailyMetrics = dailyMetrics.slice(-24);
      }
      
      fs.writeFileSync(filepath, JSON.stringify(dailyMetrics, null, 2));
      this.log(`Metrics saved to: ${filepath}`);
    } catch (error) {
      this.log(`Error saving metrics: ${error.message}`, 'error');
    }
  }

  async sendAlerts() {
    if (this.alerts.length === 0) return;
    
    // Here you could integrate with notification services
    // For now, we'll just log the alerts
    const criticalAlerts = this.alerts.filter(alert => alert.severity === 'critical');
    
    if (criticalAlerts.length > 0) {
      this.log(`🚨 ${criticalAlerts.length} critical alerts detected!`, 'alert');
      
      // You could add email, Slack, or other notification integrations here
      // Example: await this.sendEmailAlert(criticalAlerts);
      // Example: await this.sendSlackAlert(criticalAlerts);
    }
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new PerformanceMonitor();
  
  console.log('📊 Performance Monitor');
  console.log('=====================');
  
  if (process.argv.includes('--help')) {
    console.log('Usage: node performance-monitor.js [options]');
    console.log('Options:');
    console.log('  --save       Save metrics to file');
    console.log('  --quiet      Suppress detailed output');
    console.log('  --help       Show this help message');
    process.exit(0);
  }
  
  monitor.runMonitoring()
    .then(async () => {
      if (!process.argv.includes('--quiet')) {
        monitor.generateReport();
      }
      
      if (process.argv.includes('--save')) {
        monitor.saveMetrics();
      }
      
      await monitor.sendAlerts();
      
      // Exit with error code if there are critical alerts
      const criticalAlerts = monitor.alerts.filter(alert => alert.severity === 'critical');
      process.exit(criticalAlerts.length > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Performance monitoring failed:', error.message);
      process.exit(1);
    });
}

export default PerformanceMonitor;