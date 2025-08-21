'use client';

/**
 * User activity levels
 */
export enum ActivityLevel {
  ACTIVE = 'active',
  IDLE = 'idle',
  AWAY = 'away',
  INACTIVE = 'inactive'
}

/**
 * Activity event types
 */
export type ActivityEventType = 'mousemove' | 'mousedown' | 'keydown' | 'scroll' | 'touchstart' | 'click' | 'focus' | 'blur';

/**
 * Activity metrics interface
 */
export interface ActivityMetrics {
  level: ActivityLevel;
  lastActivity: number;
  idleTime: number;
  sessionDuration: number;
  eventCounts: Record<ActivityEventType, number>;
  pageVisible: boolean;
  timestamp: number;
}

/**
 * Activity change event
 */
export interface ActivityChangeEvent {
  type: 'activity-change' | 'visibility-change';
  metrics: ActivityMetrics;
  previousLevel?: ActivityLevel;
}

/**
 * Activity tracker options
 */
export interface ActivityTrackerOptions {
  idleThreshold?: number; // ms before considered idle
  awayThreshold?: number; // ms before considered away
  inactiveThreshold?: number; // ms before considered inactive
  trackEvents?: ActivityEventType[];
  onActivityChange?: (event: ActivityChangeEvent) => void;
  debug?: boolean;
}

/**
 * Activity tracker class for monitoring user engagement
 */
export class ActivityTracker {
  private metrics: ActivityMetrics;
  private listeners: Set<(event: ActivityChangeEvent) => void> = new Set();
  private options: Required<ActivityTrackerOptions>;
  private sessionStartTime: number;
  private lastActivityTime: number;
  private checkInterval?: NodeJS.Timeout;
  private isDestroyed = false;
  private eventListeners: Map<string, EventListener> = new Map();

  constructor(options: ActivityTrackerOptions = {}) {
    this.options = {
      idleThreshold: 30000, // 30 seconds
      awayThreshold: 300000, // 5 minutes
      inactiveThreshold: 1800000, // 30 minutes
      trackEvents: ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'],
      onActivityChange: () => {},
      debug: false,
      ...options
    };

    this.sessionStartTime = Date.now();
    this.lastActivityTime = Date.now();
    
    this.metrics = this.getCurrentMetrics();
    this.setupEventListeners();
    this.startActivityMonitoring();
  }

  /**
   * Get current activity metrics
   */
  private getCurrentMetrics(): ActivityMetrics {
    const now = Date.now();
    const idleTime = now - this.lastActivityTime;
    const sessionDuration = now - this.sessionStartTime;
    const pageVisible = typeof document !== 'undefined' ? !document.hidden : true;
    
    // Determine activity level
    let level = ActivityLevel.ACTIVE;
    if (idleTime > this.options.inactiveThreshold) {
      level = ActivityLevel.INACTIVE;
    } else if (idleTime > this.options.awayThreshold) {
      level = ActivityLevel.AWAY;
    } else if (idleTime > this.options.idleThreshold) {
      level = ActivityLevel.IDLE;
    }
    
    // If page is not visible, consider user away
    if (!pageVisible && level === ActivityLevel.ACTIVE) {
      level = ActivityLevel.IDLE;
    }
    
    return {
      level,
      lastActivity: this.lastActivityTime,
      idleTime,
      sessionDuration,
      eventCounts: this.metrics?.eventCounts || this.initializeEventCounts(),
      pageVisible,
      timestamp: now
    };
  }

  /**
   * Initialize event counts
   */
  private initializeEventCounts(): Record<ActivityEventType, number> {
    const counts: Record<ActivityEventType, number> = {} as any;
    this.options.trackEvents.forEach(event => {
      counts[event] = 0;
    });
    return counts;
  }

  /**
   * Setup event listeners for activity tracking
   */
  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    // Activity event handlers
    const handleActivity = (eventType: ActivityEventType) => {
      const now = Date.now();
      const previousLevel = this.metrics.level;
      
      this.lastActivityTime = now;
      
      // Update event counts
      if (this.metrics.eventCounts[eventType] !== undefined) {
        this.metrics.eventCounts[eventType]++;
      }
      
      // Update metrics
      const newMetrics = this.getCurrentMetrics();
      
      // Check if activity level changed
      if (newMetrics.level !== previousLevel) {
        this.metrics = newMetrics;
        this.emitActivityChange({
          type: 'activity-change',
          metrics: this.metrics,
          previousLevel
        });
      } else {
        this.metrics = newMetrics;
      }
    };

    // Visibility change handler
    const handleVisibilityChange = () => {
      const previousMetrics = { ...this.metrics };
      this.metrics = this.getCurrentMetrics();
      
      if (this.metrics.pageVisible !== previousMetrics.pageVisible) {
        this.emitActivityChange({
          type: 'visibility-change',
          metrics: this.metrics,
          previousLevel: previousMetrics.level
        });
      }
    };

    // Add event listeners
    this.options.trackEvents.forEach(eventType => {
      const listener = () => handleActivity(eventType);
      this.eventListeners.set(eventType, listener);
      window.addEventListener(eventType, listener, { passive: true });
    });

    // Add visibility change listener
    const visibilityListener = handleVisibilityChange;
    this.eventListeners.set('visibilitychange', visibilityListener);
    document.addEventListener('visibilitychange', visibilityListener);

    // Add focus/blur listeners
    const focusListener = () => handleActivity('focus' as ActivityEventType);
    const blurListener = () => handleActivity('blur' as ActivityEventType);
    
    this.eventListeners.set('focus', focusListener);
    this.eventListeners.set('blur', blurListener);
    
    window.addEventListener('focus', focusListener);
    window.addEventListener('blur', blurListener);
  }

  /**
   * Start activity monitoring with periodic checks
   */
  private startActivityMonitoring(): void {
    this.checkInterval = setInterval(() => {
      if (this.isDestroyed) return;
      
      const previousLevel = this.metrics.level;
      const newMetrics = this.getCurrentMetrics();
      
      if (newMetrics.level !== previousLevel) {
        this.metrics = newMetrics;
        this.emitActivityChange({
          type: 'activity-change',
          metrics: this.metrics,
          previousLevel
        });
      } else {
        this.metrics = newMetrics;
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Emit activity change event
   */
  private emitActivityChange(event: ActivityChangeEvent): void {
    if (this.options.debug) {
      console.log('[ActivityTracker] Activity change:', event);
    }
    
    this.options.onActivityChange(event);
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[ActivityTracker] Error in activity change listener:', error);
      }
    });
  }

  /**
   * Add activity change listener
   */
  public addListener(listener: (event: ActivityChangeEvent) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current activity metrics
   */
  public getMetrics(): ActivityMetrics {
    return { ...this.metrics, eventCounts: { ...this.metrics.eventCounts } };
  }

  /**
   * Check if user is currently active
   */
  public isActive(): boolean {
    return this.metrics.level === ActivityLevel.ACTIVE;
  }

  /**
   * Check if user is idle
   */
  public isIdle(): boolean {
    return this.metrics.level === ActivityLevel.IDLE;
  }

  /**
   * Check if user is away
   */
  public isAway(): boolean {
    return this.metrics.level === ActivityLevel.AWAY;
  }

  /**
   * Check if user is inactive
   */
  public isInactive(): boolean {
    return this.metrics.level === ActivityLevel.INACTIVE;
  }

  /**
   * Get time since last activity
   */
  public getIdleTime(): number {
    return Date.now() - this.lastActivityTime;
  }

  /**
   * Get session duration
   */
  public getSessionDuration(): number {
    return Date.now() - this.sessionStartTime;
  }

  /**
   * Reset activity tracking
   */
  public reset(): void {
    this.sessionStartTime = Date.now();
    this.lastActivityTime = Date.now();
    this.metrics = this.getCurrentMetrics();
  }

  /**
   * Destroy the activity tracker
   */
  public destroy(): void {
    this.isDestroyed = true;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    // Remove all event listeners
    this.eventListeners.forEach((listener, eventType) => {
      if (eventType === 'visibilitychange') {
        document.removeEventListener('visibilitychange', listener);
      } else if (eventType === 'focus' || eventType === 'blur') {
        window.removeEventListener(eventType, listener);
      } else {
        window.removeEventListener(eventType, listener);
      }
    });
    
    this.eventListeners.clear();
    this.listeners.clear();
  }
}

// Global activity tracker instance
let globalActivityTracker: ActivityTracker | null = null;

/**
 * Get or create global activity tracker instance
 */
export function getActivityTracker(options?: ActivityTrackerOptions): ActivityTracker {
  if (!globalActivityTracker) {
    globalActivityTracker = new ActivityTracker(options);
  }
  return globalActivityTracker;
}

/**
 * Destroy global activity tracker
 */
export function destroyActivityTracker(): void {
  if (globalActivityTracker) {
    globalActivityTracker.destroy();
    globalActivityTracker = null;
  }
}