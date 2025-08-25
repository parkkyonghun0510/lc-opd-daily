/**
 * Dragonfly Configuration Optimization
 * 
 * Advanced configuration management for Dragonfly that optimizes:
 * - Memory management and allocation
 * - Connection pooling and networking
 * - Performance tuning parameters
 * - Security and authentication
 * - Monitoring and logging
 * - Production-ready settings
 * - Environment-specific configurations
 */

import { Redis, RedisOptions } from 'ioredis';

// Environment types
type Environment = 'development' | 'staging' | 'production';

// Dragonfly-specific configuration interface
interface DragonflyConfiguration {
  // Connection settings
  connection: {
    url: string;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    tls?: boolean;
    family?: 4 | 6;
  };
  
  // Performance optimization
  performance: {
    maxMemoryPolicy: 'noeviction' | 'allkeys-lru' | 'allkeys-lfu' | 'volatile-lru' | 'volatile-lfu' | 'allkeys-random' | 'volatile-random' | 'volatile-ttl';
    maxMemory: string;
    threadPoolSize: number;
    ioThreads: number;
    enableMultiThreading: boolean;
    pipelineBufferSize: number;
    tcpKeepAlive: number;
    tcpNoDelay: boolean;
  };
  
  // Connection pooling
  pooling: {
    maxConnections: number;
    minConnections: number;
    acquireTimeoutMillis: number;
    idleTimeoutMillis: number;
    maxRetriesPerRequest: number;
    retryDelayOnFailover: number;
    enableReadyCheck: boolean;
    lazyConnect: boolean;
  };
  
  // Persistence and durability
  persistence: {
    enablePersistence: boolean;
    snapshotInterval: number;
    aofEnabled: boolean;
    aofSyncPolicy: 'always' | 'everysec' | 'no';
    rdbCompression: boolean;
  };
  
  // Security settings
  security: {
    requireAuth: boolean;
    enableTLS: boolean;
    tlsMinVersion: string;
    allowedCommands?: string[];
    deniedCommands?: string[];
    clientTimeout: number;
  };
  
  // Monitoring and logging
  monitoring: {
    enableSlowLog: boolean;
    slowLogMaxLen: number;
    slowLogSlowerThan: number;
    enableLatencyMonitoring: boolean;
    enableMemoryTracking: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  
  // Cache-specific settings
  cache: {
    defaultTTL: number;
    maxKeySize: number;
    maxValueSize: number;
    compressionEnabled: boolean;
    compressionThreshold: number;
    evictionBatchSize: number;
  };
  
  // Pub/Sub settings
  pubsub: {
    maxChannels: number;
    maxPatterns: number;
    messageBufferSize: number;
    enablePersistentChannels: boolean;
  };
}

// Configuration profiles for different environments
const CONFIGURATION_PROFILES: Record<Environment, Partial<DragonflyConfiguration>> = {
  development: {
    performance: {
      maxMemoryPolicy: 'allkeys-lru',
      maxMemory: '256mb',
      threadPoolSize: 2,
      ioThreads: 1,
      enableMultiThreading: false,
      pipelineBufferSize: 1024,
      tcpKeepAlive: 60,
      tcpNoDelay: true
    },
    pooling: {
      maxConnections: 5,
      minConnections: 1,
      acquireTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true
    },
    persistence: {
      enablePersistence: false,
      snapshotInterval: 0,
      aofEnabled: false,
      aofSyncPolicy: 'no',
      rdbCompression: false
    },
    security: {
      requireAuth: false,
      enableTLS: false,
      tlsMinVersion: '1.2',
      clientTimeout: 300
    },
    monitoring: {
      enableSlowLog: true,
      slowLogMaxLen: 100,
      slowLogSlowerThan: 10000,
      enableLatencyMonitoring: true,
      enableMemoryTracking: true,
      logLevel: 'debug'
    },
    cache: {
      defaultTTL: 3600,
      maxKeySize: 1024,
      maxValueSize: 1048576, // 1MB
      compressionEnabled: false,
      compressionThreshold: 1024,
      evictionBatchSize: 10
    }
  },
  
  staging: {
    performance: {
      maxMemoryPolicy: 'allkeys-lru',
      maxMemory: '1gb',
      threadPoolSize: 4,
      ioThreads: 2,
      enableMultiThreading: true,
      pipelineBufferSize: 4096,
      tcpKeepAlive: 300,
      tcpNoDelay: true
    },
    pooling: {
      maxConnections: 20,
      minConnections: 5,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 300000,
      maxRetriesPerRequest: 5,
      retryDelayOnFailover: 200,
      enableReadyCheck: true,
      lazyConnect: false
    },
    persistence: {
      enablePersistence: true,
      snapshotInterval: 3600,
      aofEnabled: true,
      aofSyncPolicy: 'everysec',
      rdbCompression: true
    },
    security: {
      requireAuth: true,
      enableTLS: true,
      tlsMinVersion: '1.2',
      clientTimeout: 600
    },
    monitoring: {
      enableSlowLog: true,
      slowLogMaxLen: 500,
      slowLogSlowerThan: 5000,
      enableLatencyMonitoring: true,
      enableMemoryTracking: true,
      logLevel: 'info'
    },
    cache: {
      defaultTTL: 7200,
      maxKeySize: 2048,
      maxValueSize: 5242880, // 5MB
      compressionEnabled: true,
      compressionThreshold: 1024,
      evictionBatchSize: 50
    }
  },
  
  production: {
    performance: {
      maxMemoryPolicy: 'allkeys-lru',
      maxMemory: '4gb',
      threadPoolSize: 8,
      ioThreads: 4,
      enableMultiThreading: true,
      pipelineBufferSize: 8192,
      tcpKeepAlive: 600,
      tcpNoDelay: true
    },
    pooling: {
      maxConnections: 100,
      minConnections: 10,
      acquireTimeoutMillis: 60000,
      idleTimeoutMillis: 600000,
      maxRetriesPerRequest: 10,
      retryDelayOnFailover: 500,
      enableReadyCheck: true,
      lazyConnect: false
    },
    persistence: {
      enablePersistence: true,
      snapshotInterval: 1800, // 30 minutes
      aofEnabled: true,
      aofSyncPolicy: 'everysec',
      rdbCompression: true
    },
    security: {
      requireAuth: true,
      enableTLS: true,
      tlsMinVersion: '1.3',
      clientTimeout: 900,
      deniedCommands: ['FLUSHDB', 'FLUSHALL', 'DEBUG', 'CONFIG', 'SHUTDOWN']
    },
    monitoring: {
      enableSlowLog: true,
      slowLogMaxLen: 1000,
      slowLogSlowerThan: 1000,
      enableLatencyMonitoring: true,
      enableMemoryTracking: true,
      logLevel: 'warn'
    },
    cache: {
      defaultTTL: 14400, // 4 hours
      maxKeySize: 4096,
      maxValueSize: 10485760, // 10MB
      compressionEnabled: true,
      compressionThreshold: 512,
      evictionBatchSize: 100
    },
    pubsub: {
      maxChannels: 10000,
      maxPatterns: 1000,
      messageBufferSize: 65536,
      enablePersistentChannels: true
    }
  }
};

// Hardware-based optimization profiles
interface HardwareProfile {
  cpu: 'low' | 'medium' | 'high';
  memory: 'low' | 'medium' | 'high';
  network: 'low' | 'medium' | 'high';
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

const HARDWARE_OPTIMIZATIONS: Record<string, DeepPartial<DragonflyConfiguration>> = {
  'low-cpu': {
    performance: {
      threadPoolSize: 2,
      ioThreads: 1,
      enableMultiThreading: false
    }
  },
  'medium-cpu': {
    performance: {
      threadPoolSize: 4,
      ioThreads: 2,
      enableMultiThreading: true
    }
  },
  'high-cpu': {
    performance: {
      threadPoolSize: 8,
      ioThreads: 4,
      enableMultiThreading: true
    }
  },
  'low-memory': {
    performance: {
      maxMemory: '256mb',
      maxMemoryPolicy: 'allkeys-lru'
    },
    cache: {
      compressionEnabled: true,
      compressionThreshold: 256,
      evictionBatchSize: 20
    }
  },
  'medium-memory': {
    performance: {
      maxMemory: '1gb',
      maxMemoryPolicy: 'allkeys-lru'
    },
    cache: {
      compressionEnabled: true,
      compressionThreshold: 512
    }
  },
  'high-memory': {
    performance: {
      maxMemory: '8gb',
      maxMemoryPolicy: 'noeviction'
    },
    cache: {
      compressionEnabled: false,
      evictionBatchSize: 200
    }
  }
};

export class DragonflyConfigManager {
  private config: DragonflyConfiguration;
  private environment: Environment;
  private hardwareProfile?: HardwareProfile;

  constructor(
    environment: Environment = 'development',
    hardwareProfile?: HardwareProfile,
    customConfig?: Partial<DragonflyConfiguration>
  ) {
    this.environment = environment;
    this.hardwareProfile = hardwareProfile;
    
    // Build configuration from profile, hardware optimizations, and custom config
    this.config = this.buildConfiguration(customConfig);
  }

  /**
   * Build optimized configuration
   */
  private buildConfiguration(customConfig?: Partial<DragonflyConfiguration>): DragonflyConfiguration {
    // Start with base configuration
    const baseConfig: DragonflyConfiguration = {
      connection: {
        url: process.env.DRAGONFLY_URL || process.env.REDIS_URL || 'redis://localhost:6379',
        tls: false,
        family: 4
      },
      performance: {
        maxMemoryPolicy: 'allkeys-lru',
        maxMemory: '1gb',
        threadPoolSize: 4,
        ioThreads: 2,
        enableMultiThreading: true,
        pipelineBufferSize: 4096,
        tcpKeepAlive: 300,
        tcpNoDelay: true
      },
      pooling: {
        maxConnections: 20,
        minConnections: 2,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 300000,
        maxRetriesPerRequest: 5,
        retryDelayOnFailover: 200,
        enableReadyCheck: true,
        lazyConnect: false
      },
      persistence: {
        enablePersistence: false,
        snapshotInterval: 0,
        aofEnabled: false,
        aofSyncPolicy: 'no',
        rdbCompression: false
      },
      security: {
        requireAuth: false,
        enableTLS: false,
        tlsMinVersion: '1.2',
        clientTimeout: 300
      },
      monitoring: {
        enableSlowLog: true,
        slowLogMaxLen: 100,
        slowLogSlowerThan: 10000,
        enableLatencyMonitoring: true,
        enableMemoryTracking: true,
        logLevel: 'info'
      },
      cache: {
        defaultTTL: 3600,
        maxKeySize: 1024,
        maxValueSize: 1048576,
        compressionEnabled: false,
        compressionThreshold: 1024,
        evictionBatchSize: 10
      },
      pubsub: {
        maxChannels: 1000,
        maxPatterns: 100,
        messageBufferSize: 8192,
        enablePersistentChannels: false
      }
    };

    // Apply environment profile
    const envProfile = CONFIGURATION_PROFILES[this.environment];
    const configWithEnv = this.mergeConfigurations(baseConfig, envProfile);

    // Apply hardware optimizations
    let configWithHardware = configWithEnv;
    if (this.hardwareProfile) {
      const cpuOptimization = HARDWARE_OPTIMIZATIONS[`${this.hardwareProfile.cpu}-cpu`];
      const memoryOptimization = HARDWARE_OPTIMIZATIONS[`${this.hardwareProfile.memory}-memory`];
      
      if (cpuOptimization) {
        configWithHardware = this.mergeConfigurations(configWithHardware, cpuOptimization);
      }
      if (memoryOptimization) {
        configWithHardware = this.mergeConfigurations(configWithHardware, memoryOptimization);
      }
    }

    // Apply custom configuration
    const finalConfig = customConfig 
      ? this.mergeConfigurations(configWithHardware, customConfig)
      : configWithHardware;

    return finalConfig;
  }

  /**
   * Deep merge configurations
   */
  private mergeConfigurations(
    base: DragonflyConfiguration, 
    override: DeepPartial<DragonflyConfiguration>
  ): DragonflyConfiguration {
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key as keyof DragonflyConfiguration] = {
          ...result[key as keyof DragonflyConfiguration],
          ...value
        } as any;
      } else {
        result[key as keyof DragonflyConfiguration] = value as any;
      }
    }
    
    return result;
  }

  /**
   * Get Redis client options from Dragonfly configuration
   */
  getRedisOptions(): RedisOptions {
    const { connection, pooling, security, monitoring } = this.config;
    
    // Parse connection URL if provided
    let connectionOptions: any = {};
    
    if (connection.url) {
      const url = new URL(connection.url);
      connectionOptions = {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || connection.password,
        db: parseInt(url.pathname.slice(1)) || connection.db || 0
      };
    } else {
      connectionOptions = {
        host: connection.host || 'localhost',
        port: connection.port || 6379,
        password: connection.password,
        db: connection.db || 0
      };
    }

    const redisOptions: RedisOptions = {
      ...connectionOptions,
      family: connection.family || 4,
      
      // Connection pooling
      maxRetriesPerRequest: pooling.maxRetriesPerRequest,
      enableReadyCheck: pooling.enableReadyCheck,
      lazyConnect: pooling.lazyConnect,
      
      // Performance optimizations
      keepAlive: this.config.performance.tcpKeepAlive * 1000,
      
      // Connection timeout
      connectTimeout: pooling.acquireTimeoutMillis,
      commandTimeout: security.clientTimeout * 1000,
      
      // TLS configuration
      tls: security.enableTLS ? {
        minVersion: security.tlsMinVersion as any,
        rejectUnauthorized: this.environment === 'production'
      } : undefined,
      
      // Dragonfly-specific optimizations
      enableAutoPipelining: this.config.performance.enableMultiThreading,
      maxLoadingTimeout: 30000,
      
      // Retry configuration
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      
      // Connection events
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      }
    };

    return redisOptions;
  }

  /**
   * Get configuration for specific component
   */
  getComponentConfig<T extends keyof DragonflyConfiguration>(component: T): DragonflyConfiguration[T] {
    return this.config[component];
  }

  /**
   * Get full configuration
   */
  getFullConfig(): DragonflyConfiguration {
    return { ...this.config };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(updates: Partial<DragonflyConfiguration>): void {
    this.config = this.mergeConfigurations(this.config, updates);
  }

  /**
   * Validate configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate connection
    if (!this.config.connection.url && !this.config.connection.host) {
      errors.push('Either connection.url or connection.host must be specified');
    }
    
    // Validate performance settings
    if (this.config.performance.threadPoolSize < 1) {
      errors.push('threadPoolSize must be at least 1');
    }
    
    if (this.config.performance.ioThreads < 1) {
      errors.push('ioThreads must be at least 1');
    }
    
    // Validate pooling settings
    if (this.config.pooling.maxConnections < this.config.pooling.minConnections) {
      errors.push('maxConnections must be greater than or equal to minConnections');
    }
    
    // Validate cache settings
    if (this.config.cache.defaultTTL < 0) {
      errors.push('defaultTTL must be non-negative');
    }
    
    // Validate security settings
    if (this.environment === 'production') {
      if (!this.config.security.requireAuth) {
        errors.push('Authentication should be required in production');
      }
      
      if (!this.config.security.enableTLS) {
        errors.push('TLS should be enabled in production');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate configuration summary
   */
  getConfigSummary(): string {
    const summary = [
      `Environment: ${this.environment}`,
      `Connection: ${this.config.connection.url || `${this.config.connection.host}:${this.config.connection.port}`}`,
      `Max Memory: ${this.config.performance.maxMemory}`,
      `Thread Pool: ${this.config.performance.threadPoolSize}`,
      `Max Connections: ${this.config.pooling.maxConnections}`,
      `TLS Enabled: ${this.config.security.enableTLS}`,
      `Auth Required: ${this.config.security.requireAuth}`,
      `Persistence: ${this.config.persistence.enablePersistence}`,
      `Compression: ${this.config.cache.compressionEnabled}`
    ];
    
    return summary.join('\n');
  }

  /**
   * Export configuration to environment variables format
   */
  exportToEnvVars(): Record<string, string> {
    const envVars: Record<string, string> = {};
    
    // Connection
    if (this.config.connection.url) {
      envVars.DRAGONFLY_URL = this.config.connection.url;
    }
    
    // Performance
    envVars.DRAGONFLY_MAX_MEMORY = this.config.performance.maxMemory;
    envVars.DRAGONFLY_THREAD_POOL_SIZE = this.config.performance.threadPoolSize.toString();
    envVars.DRAGONFLY_IO_THREADS = this.config.performance.ioThreads.toString();
    envVars.DRAGONFLY_MULTI_THREADING = this.config.performance.enableMultiThreading.toString();
    
    // Cache
    envVars.DRAGONFLY_DEFAULT_TTL = this.config.cache.defaultTTL.toString();
    envVars.DRAGONFLY_COMPRESSION = this.config.cache.compressionEnabled.toString();
    envVars.DRAGONFLY_COMPRESSION_THRESHOLD = this.config.cache.compressionThreshold.toString();
    
    // Security
    envVars.DRAGONFLY_REQUIRE_AUTH = this.config.security.requireAuth.toString();
    envVars.DRAGONFLY_ENABLE_TLS = this.config.security.enableTLS.toString();
    
    // Monitoring
    envVars.DRAGONFLY_LOG_LEVEL = this.config.monitoring.logLevel;
    envVars.DRAGONFLY_SLOW_LOG = this.config.monitoring.enableSlowLog.toString();
    
    return envVars;
  }
}

// Singleton instance
let configManager: DragonflyConfigManager | null = null;

/**
 * Get optimized Dragonfly configuration manager
 */
export function getDragonflyConfig(
  environment?: Environment,
  hardwareProfile?: HardwareProfile,
  customConfig?: Partial<DragonflyConfiguration>
): DragonflyConfigManager {
  if (!configManager || environment || hardwareProfile || customConfig) {
    const env = environment || (process.env.NODE_ENV as Environment) || 'development';
    configManager = new DragonflyConfigManager(env, hardwareProfile, customConfig);
  }
  
  return configManager;
}

/**
 * Auto-detect hardware profile based on system resources
 */
export function detectHardwareProfile(): HardwareProfile {
  // In a real implementation, you would detect actual system resources
  // For now, we'll use environment variables or defaults
  
  const cpuCores = parseInt(process.env.CPU_CORES || '4');
  const memoryGB = parseInt(process.env.MEMORY_GB || '4');
  
  return {
    cpu: cpuCores <= 2 ? 'low' : cpuCores <= 8 ? 'medium' : 'high',
    memory: memoryGB <= 1 ? 'low' : memoryGB <= 8 ? 'medium' : 'high',
    network: 'medium' // Default to medium for network
  };
}

/**
 * Create optimized Redis client with Dragonfly configuration
 */
export async function createOptimizedRedisClient(
  environment?: Environment,
  hardwareProfile?: HardwareProfile
): Promise<Redis> {
  const configManager = getDragonflyConfig(environment, hardwareProfile);
  const redisOptions = configManager.getRedisOptions();
  
  // Validate configuration
  const validation = configManager.validateConfig();
  if (!validation.valid) {
    throw new Error(`Invalid Dragonfly configuration: ${validation.errors.join(', ')}`);
  }
  
  console.log('[DragonflyConfig] Creating optimized Redis client with configuration:');
  console.log(configManager.getConfigSummary());
  
  const client = new Redis(redisOptions);
  
  // Set up event handlers
  client.on('connect', () => {
    console.log('[DragonflyConfig] Connected to Dragonfly');
  });
  
  client.on('error', (error) => {
    console.error('[DragonflyConfig] Connection error:', error);
  });
  
  return client;
}

// Export types and constants
export type {
  DragonflyConfiguration,
  Environment,
  HardwareProfile
};

export {
  CONFIGURATION_PROFILES,
  HARDWARE_OPTIMIZATIONS
};