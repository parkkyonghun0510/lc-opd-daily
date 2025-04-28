/**
 * SSE Alerting System
 * 
 * This module provides alerting for critical SSE metrics.
 * It can send alerts via email, Slack, or other channels.
 */

import { sseMetrics } from '@/lib/sse/sseMetrics';

/**
 * Alert thresholds
 */
interface AlertThresholds {
  connections: {
    active: number;
    peak: number;
  };
  events: {
    errorRate: number; // Percentage
  };
  performance: {
    avgProcessingTime: number; // Milliseconds
  };
}

/**
 * Alert channels
 */
type AlertChannel = 'email' | 'slack' | 'console';

/**
 * Alert configuration
 */
interface AlertConfig {
  enabled: boolean;
  thresholds: AlertThresholds;
  channels: AlertChannel[];
  cooldown: number; // Milliseconds
}

/**
 * Default alert configuration
 */
const defaultAlertConfig: AlertConfig = {
  enabled: true,
  thresholds: {
    connections: {
      active: 1000, // Alert if more than 1000 active connections
      peak: 2000 // Alert if peak connections exceed 2000
    },
    events: {
      errorRate: 5 // Alert if error rate exceeds 5%
    },
    performance: {
      avgProcessingTime: 100 // Alert if average processing time exceeds 100ms
    }
  },
  channels: ['console'], // Default to console alerts only
  cooldown: 5 * 60 * 1000 // 5 minutes cooldown between alerts
};

/**
 * SSE Alerting System
 */
class SSEAlertingSystem {
  private config: AlertConfig;
  private lastAlerts: Record<string, number> = {};
  
  constructor(config: Partial<AlertConfig> = {}) {
    this.config = {
      ...defaultAlertConfig,
      ...config,
      thresholds: {
        ...defaultAlertConfig.thresholds,
        ...config.thresholds,
        connections: {
          ...defaultAlertConfig.thresholds.connections,
          ...config.thresholds?.connections
        },
        events: {
          ...defaultAlertConfig.thresholds.events,
          ...config.thresholds?.events
        },
        performance: {
          ...defaultAlertConfig.thresholds.performance,
          ...config.thresholds?.performance
        }
      }
    };
  }
  
  /**
   * Check metrics and send alerts if needed
   */
  async checkMetricsAndAlert() {
    if (!this.config.enabled) {
      return;
    }
    
    const metrics = sseMetrics.getMetrics();
    const alerts: string[] = [];
    
    // Check connection metrics
    if (metrics.connections.active > this.config.thresholds.connections.active) {
      alerts.push(`[HIGH CONNECTIONS] Active connections (${metrics.connections.active}) exceed threshold (${this.config.thresholds.connections.active})`);
    }
    
    if (metrics.connections.peak > this.config.thresholds.connections.peak) {
      alerts.push(`[HIGH PEAK] Peak connections (${metrics.connections.peak}) exceed threshold (${this.config.thresholds.connections.peak})`);
    }
    
    // Check error rate
    if (metrics.events.total > 0) {
      const errorRate = (metrics.errors.total / metrics.events.total) * 100;
      if (errorRate > this.config.thresholds.events.errorRate) {
        alerts.push(`[HIGH ERROR RATE] Error rate (${errorRate.toFixed(2)}%) exceeds threshold (${this.config.thresholds.events.errorRate}%)`);
      }
    }
    
    // Check performance metrics
    if (metrics.performance.averageEventProcessingTime > this.config.thresholds.performance.avgProcessingTime) {
      alerts.push(`[SLOW PROCESSING] Average event processing time (${metrics.performance.averageEventProcessingTime.toFixed(2)}ms) exceeds threshold (${this.config.thresholds.performance.avgProcessingTime}ms)`);
    }
    
    // Send alerts if needed
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
    
    return alerts;
  }
  
  /**
   * Send an alert
   */
  private async sendAlert(message: string) {
    // Check cooldown
    const now = Date.now();
    if (this.lastAlerts[message] && now - this.lastAlerts[message] < this.config.cooldown) {
      return;
    }
    
    // Update last alert time
    this.lastAlerts[message] = now;
    
    // Send alerts to configured channels
    for (const channel of this.config.channels) {
      switch (channel) {
        case 'console':
          console.error(`[SSE ALERT] ${message}`);
          break;
        case 'email':
          await this.sendEmailAlert(message);
          break;
        case 'slack':
          await this.sendSlackAlert(message);
          break;
      }
    }
  }
  
  /**
   * Send an email alert
   */
  private async sendEmailAlert(message: string) {
    // This is a placeholder for email alerting
    // In a real implementation, you would use an email service like SendGrid, Mailgun, etc.
    console.log(`[EMAIL ALERT] ${message}`);
    
    // Example implementation with SendGrid (commented out)
    /*
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    const msg = {
      to: process.env.ALERT_EMAIL,
      from: 'alerts@yourdomain.com',
      subject: 'SSE Alert',
      text: message,
      html: `<strong>${message}</strong>`,
    };
    
    try {
      await sgMail.send(msg);
    } catch (error) {
      console.error('Error sending email alert:', error);
    }
    */
  }
  
  /**
   * Send a Slack alert
   */
  private async sendSlackAlert(message: string) {
    // This is a placeholder for Slack alerting
    // In a real implementation, you would use the Slack API
    console.log(`[SLACK ALERT] ${message}`);
    
    // Example implementation with Slack API (commented out)
    /*
    const { WebClient } = require('@slack/web-api');
    const slack = new WebClient(process.env.SLACK_TOKEN);
    
    try {
      await slack.chat.postMessage({
        channel: process.env.SLACK_CHANNEL,
        text: message,
        username: 'SSE Alert Bot',
        icon_emoji: ':warning:'
      });
    } catch (error) {
      console.error('Error sending Slack alert:', error);
    }
    */
  }
  
  /**
   * Update alert configuration
   */
  updateConfig(config: Partial<AlertConfig>) {
    this.config = {
      ...this.config,
      ...config,
      thresholds: {
        ...this.config.thresholds,
        ...config.thresholds,
        connections: {
          ...this.config.thresholds.connections,
          ...config.thresholds?.connections
        },
        events: {
          ...this.config.thresholds.events,
          ...config.thresholds?.events
        },
        performance: {
          ...this.config.thresholds.performance,
          ...config.thresholds?.performance
        }
      }
    };
  }
  
  /**
   * Get current alert configuration
   */
  getConfig() {
    return this.config;
  }
}

// Create a singleton instance
export const sseAlertingSystem = new SSEAlertingSystem({
  enabled: process.env.SSE_ALERTS_ENABLED === 'true',
  channels: (process.env.SSE_ALERT_CHANNELS || 'console').split(',') as AlertChannel[],
  thresholds: {
    connections: {
      active: parseInt(process.env.SSE_ALERT_ACTIVE_CONNECTIONS || '1000', 10),
      peak: parseInt(process.env.SSE_ALERT_PEAK_CONNECTIONS || '2000', 10)
    },
    events: {
      errorRate: parseFloat(process.env.SSE_ALERT_ERROR_RATE || '5')
    },
    performance: {
      avgProcessingTime: parseFloat(process.env.SSE_ALERT_AVG_PROCESSING_TIME || '100')
    }
  }
});
