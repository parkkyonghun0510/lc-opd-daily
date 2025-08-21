'use client';

import { NetworkMonitor, NetworkQuality, getNetworkMonitor, type NetworkChangeEvent } from '@/lib/network/network-monitor';
import { ActivityTracker, ActivityLevel, getActivityTracker, type ActivityChangeEvent } from '@/lib/activity/activity-tracker';
import { createNetworkError } from '@/lib/errors/error-classes';
import { NetworkErrorCode } from '@/types/errors';

/**
 * Refresh strategy types
 */
export enum RefreshStrategy {
  AGGRESSIVE = 'aggressive',
  NORMAL = 'normal',
  CONSERVATIVE = 'conservative',
  MINIMAL = 'minimal',
  PAUSED = 'paused'
}

/**
 * Refresh configuration for different scenarios
 */
export interface RefreshConfig {
  strategy: RefreshStrategy;
  baseInterval: number;
  minInterval: number;
  maxInterval: number;
  multiplier: number;
  enabled: boolean;
}

/**
 * Dynamic refresh context
 */
export interface RefreshContext {
  networkQuality: NetworkQuality;
  activityLevel: ActivityLevel;
  isDataSaverEnabled: boolean;
  pageVisible: boolean;
  errorCount: number;
  lastSuccessTime: number;
  consecutiveFailures: number;
}

/**
 * Refresh interval change event
 */
export interface RefreshIntervalChangeEvent {
  type: 'interval-change' | 'strategy-change' | 'pause' | 'resume';
  oldInterval: number;
  newInterval: number;
  oldStrategy: RefreshStrategy;
  newStrategy: RefreshStrategy;
  context: RefreshContext;
  reason: string;
}

/**
 * Dynamic refresh manager options
 */
export interface DynamicRefreshManagerOptions {
  baseInterval?: number;
  minInterval?: number;
  maxInterval?: number;
  enableNetworkAdaptation?: boolean;
  enableActivityAdaptation?: boolean;
  enableErrorBackoff?: boolean;
  onIntervalChange?: (event: RefreshIntervalChangeEvent) => void;
  debug?: boolean;
}

/**
 * Predefined refresh configurations
 */
const REFRESH_CONFIGS: Record<RefreshStrategy, RefreshConfig> = {
  [RefreshStrategy.AGGRESSIVE]: {
    strategy: RefreshStrategy.AGGRESSIVE,
    baseInterval: 5000, // 5 seconds
    minInterval: 2000, // 2 seconds
    maxInterval: 10000, // 10 seconds
    multiplier: 0.5,
    enabled: true
  },
  [RefreshStrategy.NORMAL]: {
    strategy: RefreshStrategy.NORMAL,
    baseInterval: 15000, // 15 seconds
    minInterval: 5000, // 5 seconds
    maxInterval: 30000, // 30 seconds
    multiplier: 1.0,
    enabled: true
  },
  [RefreshStrategy.CONSERVATIVE]: {
    strategy: RefreshStrategy.CONSERVATIVE,
    baseInterval: 60000, // 1 minute
    minInterval: 30000, // 30 seconds
    maxInterval: 300000, // 5 minutes
    multiplier: 2.0,
    enabled: true
  },
  [RefreshStrategy.MINIMAL]: {
    strategy: RefreshStrategy.MINIMAL,
    baseInterval: 300000, // 5 minutes
    minInterval: 120000, // 2 minutes
    maxInterval: 1800000, // 30 minutes
    multiplier: 3.0,
    enabled: true
  },
  [RefreshStrategy.PAUSED]: {
    strategy: RefreshStrategy.PAUSED,
    baseInterval: 0,
    minInterval: 0,
    maxInterval: 0,
    multiplier: 0,
    enabled: false
  }
};

/**
 * Dynamic refresh manager class
 */
export class DynamicRefreshManager {
  private networkMonitor: NetworkMonitor;
  private activityTracker: ActivityTracker;
  private options: Required<DynamicRefreshManagerOptions>;
  private currentStrategy: RefreshStrategy = RefreshStrategy.NORMAL;
  private currentInterval: number;
  private context: RefreshContext;
  private listeners: Set<(event: RefreshIntervalChangeEvent) => void> = new Set();
  private isDestroyed = false;
  private networkUnsubscribe?: () => void;
  private activityUnsubscribe?: () => void;

  constructor(options: DynamicRefreshManagerOptions = {}) {
    this.options = {
      baseInterval: 15000, // 15 seconds
      minInterval: 5000, // 5 seconds
      maxInterval: 300000, // 5 minutes
      enableNetworkAdaptation: true,
      enableActivityAdaptation: true,
      enableErrorBackoff: true,
      onIntervalChange: () => {},
      debug: false,
      ...options
    };

    this.currentInterval = this.options.baseInterval;
    
    // Initialize monitors
    this.networkMonitor = getNetworkMonitor({ debug: this.options.debug });
    this.activityTracker = getActivityTracker({ debug: this.options.debug });
    
    // Initialize context
    this.context = this.getCurrentContext();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Calculate initial strategy and interval
    this.updateStrategy();
  }

  /**
   * Get current refresh context
   */
  private getCurrentContext(): RefreshContext {
    const networkMetrics = this.networkMonitor.getMetrics();
    const activityMetrics = this.activityTracker.getMetrics();
    
    return {
      networkQuality: networkMetrics.quality,
      activityLevel: activityMetrics.level,
      isDataSaverEnabled: networkMetrics.saveData,
      pageVisible: activityMetrics.pageVisible,
      errorCount: this.context?.errorCount || 0,
      lastSuccessTime: this.context?.lastSuccessTime || Date.now(),
      consecutiveFailures: this.context?.consecutiveFailures || 0
    };
  }

  /**
   * Setup event listeners for network and activity changes
   */
  private setupEventListeners(): void {
    if (this.options.enableNetworkAdaptation) {
      this.networkUnsubscribe = this.networkMonitor.addListener(this.handleNetworkChange.bind(this));
    }
    
    if (this.options.enableActivityAdaptation) {
      this.activityUnsubscribe = this.activityTracker.addListener(this.handleActivityChange.bind(this));
    }
  }

  /**
   * Handle network changes
   */
  private handleNetworkChange(event: NetworkChangeEvent): void {
    if (this.isDestroyed) return;
    
    const previousContext = { ...this.context };
    this.context = this.getCurrentContext();
    
    if (this.options.debug) {
      console.log('[DynamicRefreshManager] Network change:', event.type, event.metrics.quality);
    }
    
    this.updateStrategy('Network quality changed');
  }

  /**
   * Handle activity changes
   */
  private handleActivityChange(event: ActivityChangeEvent): void {
    if (this.isDestroyed) return;
    
    const previousContext = { ...this.context };
    this.context = this.getCurrentContext();
    
    if (this.options.debug) {
      console.log('[DynamicRefreshManager] Activity change:', event.type, event.metrics.level);
    }
    
    this.updateStrategy('User activity changed');
  }

  /**
   * Determine optimal refresh strategy based on context
   */
  private determineStrategy(): RefreshStrategy {
    const { networkQuality, activityLevel, isDataSaverEnabled, pageVisible, consecutiveFailures } = this.context;
    
    // If page is not visible, use minimal strategy
    if (!pageVisible) {
      return RefreshStrategy.MINIMAL;
    }
    
    // If data saver is enabled, be conservative
    if (isDataSaverEnabled) {
      return RefreshStrategy.CONSERVATIVE;
    }
    
    // If there are consecutive failures, back off
    if (consecutiveFailures >= 3) {
      return RefreshStrategy.MINIMAL;
    } else if (consecutiveFailures >= 1) {
      return RefreshStrategy.CONSERVATIVE;
    }
    
    // If network is poor or offline, reduce frequency
    if (networkQuality === NetworkQuality.OFFLINE) {
      return RefreshStrategy.PAUSED;
    } else if (networkQuality === NetworkQuality.POOR) {
      return RefreshStrategy.MINIMAL;
    } else if (networkQuality === NetworkQuality.FAIR) {
      return RefreshStrategy.CONSERVATIVE;
    }
    
    // If user is inactive, reduce frequency
    if (activityLevel === ActivityLevel.INACTIVE) {
      return RefreshStrategy.MINIMAL;
    } else if (activityLevel === ActivityLevel.AWAY) {
      return RefreshStrategy.CONSERVATIVE;
    } else if (activityLevel === ActivityLevel.IDLE) {
      return RefreshStrategy.NORMAL;
    }
    
    // If user is active and network is good, be aggressive
    if (activityLevel === ActivityLevel.ACTIVE && 
        (networkQuality === NetworkQuality.EXCELLENT || networkQuality === NetworkQuality.GOOD)) {
      return RefreshStrategy.AGGRESSIVE;
    }
    
    // Default to normal strategy
    return RefreshStrategy.NORMAL;
  }

  /**
   * Calculate interval based on strategy and context
   */
  private calculateInterval(strategy: RefreshStrategy): number {
    const config = REFRESH_CONFIGS[strategy];
    
    if (!config.enabled) {
      return 0;
    }
    
    let interval = config.baseInterval;
    
    // Apply error backoff if enabled
    if (this.options.enableErrorBackoff && this.context.consecutiveFailures > 0) {
      const backoffMultiplier = Math.min(Math.pow(2, this.context.consecutiveFailures), 8);
      interval = Math.min(interval * backoffMultiplier, config.maxInterval);
    }
    
    // Apply network quality adjustments
    if (this.options.enableNetworkAdaptation) {
      switch (this.context.networkQuality) {
        case NetworkQuality.EXCELLENT:
          interval = Math.max(interval * 0.8, config.minInterval);
          break;
        case NetworkQuality.POOR:
          interval = Math.min(interval * 1.5, config.maxInterval);
          break;
        case NetworkQuality.FAIR:
          interval = Math.min(interval * 1.2, config.maxInterval);
          break;
      }
    }
    
    // Ensure interval is within bounds
    return Math.max(Math.min(interval, this.options.maxInterval), this.options.minInterval);
  }

  /**
   * Update strategy and interval
   */
  private updateStrategy(reason = 'Context changed'): void {
    const oldStrategy = this.currentStrategy;
    const oldInterval = this.currentInterval;
    
    const newStrategy = this.determineStrategy();
    const newInterval = this.calculateInterval(newStrategy);
    
    // Check if anything changed
    if (newStrategy === oldStrategy && newInterval === oldInterval) {
      return;
    }
    
    this.currentStrategy = newStrategy;
    this.currentInterval = newInterval;
    
    // Emit change event
    const event: RefreshIntervalChangeEvent = {
      type: newStrategy !== oldStrategy ? 'strategy-change' : 'interval-change',
      oldInterval,
      newInterval,
      oldStrategy,
      newStrategy,
      context: { ...this.context },
      reason
    };
    
    this.emitIntervalChange(event);
  }

  /**
   * Emit interval change event
   */
  private emitIntervalChange(event: RefreshIntervalChangeEvent): void {
    if (this.options.debug) {
      console.log('[DynamicRefreshManager] Interval change:', event);
    }
    
    this.options.onIntervalChange(event);
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[DynamicRefreshManager] Error in interval change listener:', error);
      }
    });
  }

  /**
   * Add interval change listener
   */
  public addListener(listener: (event: RefreshIntervalChangeEvent) => void): () => void {
    this.listeners.add(listener);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current refresh interval
   */
  public getCurrentInterval(): number {
    return this.currentInterval;
  }

  /**
   * Get current refresh strategy
   */
  public getCurrentStrategy(): RefreshStrategy {
    return this.currentStrategy;
  }

  /**
   * Get current context
   */
  public getContext(): RefreshContext {
    return { ...this.context };
  }

  /**
   * Report successful operation
   */
  public reportSuccess(): void {
    this.context.lastSuccessTime = Date.now();
    this.context.consecutiveFailures = 0;
    this.updateStrategy('Operation succeeded');
  }

  /**
   * Report failed operation
   */
  public reportError(error?: Error): void {
    this.context.errorCount++;
    this.context.consecutiveFailures++;
    this.updateStrategy('Operation failed');
  }

  /**
   * Force a specific strategy
   */
  public forceStrategy(strategy: RefreshStrategy, reason = 'Manually forced'): void {
    const oldStrategy = this.currentStrategy;
    const oldInterval = this.currentInterval;
    
    this.currentStrategy = strategy;
    this.currentInterval = this.calculateInterval(strategy);
    
    const event: RefreshIntervalChangeEvent = {
      type: 'strategy-change',
      oldInterval,
      newInterval: this.currentInterval,
      oldStrategy,
      newStrategy: strategy,
      context: { ...this.context },
      reason
    };
    
    this.emitIntervalChange(event);
  }

  /**
   * Pause refresh operations
   */
  public pause(reason = 'Manually paused'): void {
    this.forceStrategy(RefreshStrategy.PAUSED, reason);
  }

  /**
   * Resume refresh operations
   */
  public resume(reason = 'Manually resumed'): void {
    // Reset to automatic strategy determination
    this.updateStrategy(reason);
  }

  /**
   * Check if refresh is currently enabled
   */
  public isEnabled(): boolean {
    return this.currentStrategy !== RefreshStrategy.PAUSED && this.currentInterval > 0;
  }

  /**
   * Get recommended intervals for different operations
   */
  public getRecommendedIntervals(): Record<string, number> {
    const baseInterval = this.currentInterval;
    
    return {
      critical: Math.max(baseInterval * 0.5, this.options.minInterval),
      normal: baseInterval,
      background: Math.min(baseInterval * 2, this.options.maxInterval),
      lowPriority: Math.min(baseInterval * 4, this.options.maxInterval)
    };
  }

  /**
   * Destroy the refresh manager
   */
  public destroy(): void {
    this.isDestroyed = true;
    
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
    }
    
    if (this.activityUnsubscribe) {
      this.activityUnsubscribe();
    }
    
    this.listeners.clear();
  }
}

// Global refresh manager instance
let globalRefreshManager: DynamicRefreshManager | null = null;

/**
 * Get or create global refresh manager instance
 */
export function getDynamicRefreshManager(options?: DynamicRefreshManagerOptions): DynamicRefreshManager {
  if (!globalRefreshManager) {
    globalRefreshManager = new DynamicRefreshManager(options);
  }
  return globalRefreshManager;
}

/**
 * Destroy global refresh manager
 */
export function destroyDynamicRefreshManager(): void {
  if (globalRefreshManager) {
    globalRefreshManager.destroy();
    globalRefreshManager = null;
  }
}