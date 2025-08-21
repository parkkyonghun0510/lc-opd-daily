'use client';

import { createNetworkError } from '@/lib/errors/error-classes';
import { NetworkErrorCode } from '@/types/errors';

/**
 * Network quality levels
 */
export enum NetworkQuality {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  OFFLINE = 'offline'
}

/**
 * Network connection type
 */
export enum ConnectionType {
  WIFI = 'wifi',
  CELLULAR = 'cellular',
  ETHERNET = 'ethernet',
  UNKNOWN = 'unknown'
}

/**
 * Network metrics interface
 */
export interface NetworkMetrics {
  quality: NetworkQuality;
  connectionType: ConnectionType;
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
  isOnline: boolean;
  timestamp: number;
}

/**
 * Network change event
 */
export interface NetworkChangeEvent {
  type: 'online' | 'offline' | 'quality-change' | 'connection-change';
  metrics: NetworkMetrics;
  previousMetrics?: NetworkMetrics;
}

/**
 * Network monitor options
 */
export interface NetworkMonitorOptions {
  enableQualityDetection?: boolean;
  qualityCheckInterval?: number;
  onNetworkChange?: (event: NetworkChangeEvent) => void;
  debug?: boolean;
}

/**
 * Network monitor class for detecting connection quality and changes
 */
export class NetworkMonitor {
  private metrics: NetworkMetrics;
  private listeners: Set<(event: NetworkChangeEvent) => void> = new Set();
  private qualityCheckInterval?: NodeJS.Timeout;
  private options: Required<NetworkMonitorOptions>;
  private isDestroyed = false;

  constructor(options: NetworkMonitorOptions = {}) {
    this.options = {
      enableQualityDetection: true,
      qualityCheckInterval: 30000, // 30 seconds
      onNetworkChange: () => {},
      debug: false,
      ...options
    };

    this.metrics = this.getCurrentMetrics();
    this.setupEventListeners();

    if (this.options.enableQualityDetection) {
      this.startQualityMonitoring();
    }
  }

  /**
   * Get current network metrics
   */
  private getCurrentMetrics(): NetworkMetrics {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    
    // Get connection info if available
    const connection = (navigator as any)?.connection || (navigator as any)?.mozConnection || (navigator as any)?.webkitConnection;
    
    const effectiveType = connection?.effectiveType || 'unknown';
    const downlink = connection?.downlink || 0;
    const rtt = connection?.rtt || 0;
    const saveData = connection?.saveData || false;
    
    // Determine connection type
    let connectionType = ConnectionType.UNKNOWN;
    if (connection?.type) {
      switch (connection.type) {
        case 'wifi':
          connectionType = ConnectionType.WIFI;
          break;
        case 'cellular':
          connectionType = ConnectionType.CELLULAR;
          break;
        case 'ethernet':
          connectionType = ConnectionType.ETHERNET;
          break;
      }
    }
    
    // Determine quality based on effective type and metrics
    let quality = NetworkQuality.GOOD;
    if (!isOnline) {
      quality = NetworkQuality.OFFLINE;
    } else if (effectiveType === '4g' && downlink > 10) {
      quality = NetworkQuality.EXCELLENT;
    } else if (effectiveType === '4g' || (effectiveType === '3g' && downlink > 1.5)) {
      quality = NetworkQuality.GOOD;
    } else if (effectiveType === '3g' || effectiveType === '2g') {
      quality = NetworkQuality.FAIR;
    } else if (rtt > 2000 || downlink < 0.5) {
      quality = NetworkQuality.POOR;
    }
    
    return {
      quality,
      connectionType,
      effectiveType,
      downlink,
      rtt,
      saveData,
      isOnline,
      timestamp: Date.now()
    };
  }

  /**
   * Setup event listeners for network changes
   */
  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      const previousMetrics = { ...this.metrics };
      this.metrics = this.getCurrentMetrics();
      
      this.emitNetworkChange({
        type: 'online',
        metrics: this.metrics,
        previousMetrics
      });
    };

    const handleOffline = () => {
      const previousMetrics = { ...this.metrics };
      this.metrics = this.getCurrentMetrics();
      
      this.emitNetworkChange({
        type: 'offline',
        metrics: this.metrics,
        previousMetrics
      });
    };

    const handleConnectionChange = () => {
      const previousMetrics = { ...this.metrics };
      const newMetrics = this.getCurrentMetrics();
      
      // Check if quality or connection type changed
      if (newMetrics.quality !== previousMetrics.quality) {
        this.metrics = newMetrics;
        this.emitNetworkChange({
          type: 'quality-change',
          metrics: this.metrics,
          previousMetrics
        });
      } else if (newMetrics.connectionType !== previousMetrics.connectionType) {
        this.metrics = newMetrics;
        this.emitNetworkChange({
          type: 'connection-change',
          metrics: this.metrics,
          previousMetrics
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Listen for connection changes if supported
    const connection = (navigator as any)?.connection;
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }
  }

  /**
   * Start quality monitoring with periodic checks
   */
  private startQualityMonitoring(): void {
    this.qualityCheckInterval = setInterval(() => {
      if (this.isDestroyed) return;
      
      const previousMetrics = { ...this.metrics };
      const newMetrics = this.getCurrentMetrics();
      
      if (newMetrics.quality !== previousMetrics.quality) {
        this.metrics = newMetrics;
        this.emitNetworkChange({
          type: 'quality-change',
          metrics: this.metrics,
          previousMetrics
        });
      }
    }, this.options.qualityCheckInterval);
  }

  /**
   * Emit network change event
   */
  private emitNetworkChange(event: NetworkChangeEvent): void {
    if (this.options.debug) {
      console.log('[NetworkMonitor] Network change:', event);
    }
    
    this.options.onNetworkChange(event);
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[NetworkMonitor] Error in network change listener:', error);
      }
    });
  }

  /**
   * Add network change listener
   */
  public addListener(listener: (event: NetworkChangeEvent) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current network metrics
   */
  public getMetrics(): NetworkMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if network is suitable for heavy operations
   */
  public isHighQuality(): boolean {
    return this.metrics.quality === NetworkQuality.EXCELLENT || 
           this.metrics.quality === NetworkQuality.GOOD;
  }

  /**
   * Check if data saver mode is enabled
   */
  public isDataSaverEnabled(): boolean {
    return this.metrics.saveData;
  }

  /**
   * Perform network speed test
   */
  public async performSpeedTest(): Promise<{ latency: number; downloadSpeed: number }> {
    try {
      const startTime = performance.now();
      
      // Use a small image for speed test
      const testUrl = '/favicon.ico?t=' + Date.now();
      const response = await fetch(testUrl, { cache: 'no-cache' });
      
      if (!response.ok) {
        throw createNetworkError(
          NetworkErrorCode.NETWORK_ERROR,
          'Speed test failed',
          { url: testUrl, statusCode: response.status }
        );
      }
      
      const endTime = performance.now();
      const latency = endTime - startTime;
      
      // Estimate download speed (very rough)
      const contentLength = parseInt(response.headers.get('content-length') || '0');
      const downloadSpeed = contentLength > 0 ? (contentLength * 8) / (latency / 1000) : 0;
      
      return { latency, downloadSpeed };
    } catch (error) {
      throw createNetworkError(
        NetworkErrorCode.NETWORK_ERROR,
        'Failed to perform speed test',
        { cause: error as Error }
      );
    }
  }

  /**
   * Destroy the network monitor
   */
  public destroy(): void {
    this.isDestroyed = true;
    
    if (this.qualityCheckInterval) {
      clearInterval(this.qualityCheckInterval);
    }
    
    this.listeners.clear();
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.getCurrentMetrics);
      window.removeEventListener('offline', this.getCurrentMetrics);
      
      const connection = (navigator as any)?.connection;
      if (connection) {
        connection.removeEventListener('change', this.getCurrentMetrics);
      }
    }
  }
}

// Global network monitor instance
let globalNetworkMonitor: NetworkMonitor | null = null;

/**
 * Get or create global network monitor instance
 */
export function getNetworkMonitor(options?: NetworkMonitorOptions): NetworkMonitor {
  if (!globalNetworkMonitor) {
    globalNetworkMonitor = new NetworkMonitor(options);
  }
  return globalNetworkMonitor;
}

/**
 * Destroy global network monitor
 */
export function destroyNetworkMonitor(): void {
  if (globalNetworkMonitor) {
    globalNetworkMonitor.destroy();
    globalNetworkMonitor = null;
  }
}