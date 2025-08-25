/**
 * Dragonfly Data Integrity Validation
 * 
 * Comprehensive data integrity validation system for Redis to Dragonfly migration:
 * - Data consistency checks
 * - Migration validation
 * - Checksum verification
 * - Data type validation
 * - Key-value integrity
 * - Performance impact monitoring
 * - Rollback capabilities
 * - Real-time validation
 */

import { Redis } from 'ioredis';
import crypto from 'crypto';
import { performance } from 'perf_hooks';

// Data integrity interfaces
interface DataIntegrityCheck {
  id: string;
  timestamp: number;
  sourceClient: Redis;
  targetClient: Redis;
  keyPattern?: string;
  batchSize: number;
  checksumAlgorithm: 'md5' | 'sha256' | 'sha1';
  validateTypes: boolean;
  validateTTL: boolean;
  validateSize: boolean;
}

interface ValidationResult {
  checkId: string;
  success: boolean;
  totalKeys: number;
  validatedKeys: number;
  inconsistentKeys: string[];
  errors: ValidationError[];
  performance: {
    duration: number;
    keysPerSecond: number;
    memoryUsage: number;
  };
  checksums: {
    source: string;
    target: string;
    match: boolean;
  };
  statistics: {
    dataTypes: Record<string, number>;
    sizesDistribution: Record<string, number>;
    ttlDistribution: Record<string, number>;
  };
}

interface ValidationError {
  key: string;
  type: 'missing' | 'type_mismatch' | 'value_mismatch' | 'ttl_mismatch' | 'size_mismatch' | 'checksum_mismatch';
  details: {
    source?: any;
    target?: any;
    expected?: any;
    actual?: any;
    error?: string;
  };
}

interface MigrationValidationConfig {
  batchSize: number;
  maxConcurrency: number;
  checksumAlgorithm: 'md5' | 'sha256' | 'sha1';
  validateTypes: boolean;
  validateTTL: boolean;
  validateSize: boolean;
  toleranceThreshold: number; // Percentage of acceptable inconsistencies
  realTimeValidation: boolean;
  enableRollback: boolean;
  backupBeforeMigration: boolean;
}

interface KeyMetadata {
  key: string;
  type: string;
  size: number;
  ttl: number;
  checksum: string;
  lastModified?: number;
}

interface MigrationSnapshot {
  id: string;
  timestamp: number;
  totalKeys: number;
  keyMetadata: KeyMetadata[];
  globalChecksum: string;
  statistics: {
    dataTypes: Record<string, number>;
    totalSize: number;
    averageKeySize: number;
    keysWithTTL: number;
  };
}

export class DragonflyDataIntegrityValidator {
  private config: MigrationValidationConfig;
  private validationHistory: ValidationResult[] = [];
  private migrationSnapshots: MigrationSnapshot[] = [];
  private realTimeValidators: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<MigrationValidationConfig> = {}) {
    this.config = {
      batchSize: 1000,
      maxConcurrency: 5,
      checksumAlgorithm: 'sha256',
      validateTypes: true,
      validateTTL: true,
      validateSize: true,
      toleranceThreshold: 0.01, // 1% tolerance
      realTimeValidation: false,
      enableRollback: true,
      backupBeforeMigration: true,
      ...config
    };
  }

  /**
   * Create a pre-migration snapshot
   */
  async createMigrationSnapshot(
    client: Redis,
    keyPattern: string = '*'
  ): Promise<MigrationSnapshot> {
    const startTime = performance.now();
    const snapshotId = `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[DataIntegrity] Creating migration snapshot: ${snapshotId}`);
    
    const keys = await this.scanKeys(client, keyPattern);
    const keyMetadata: KeyMetadata[] = [];
    const statistics = {
      dataTypes: {} as Record<string, number>,
      totalSize: 0,
      averageKeySize: 0,
      keysWithTTL: 0
    };

    // Process keys in batches
    for (let i = 0; i < keys.length; i += this.config.batchSize) {
      const batch = keys.slice(i, i + this.config.batchSize);
      const batchMetadata = await this.extractKeyMetadata(client, batch);
      
      keyMetadata.push(...batchMetadata);
      
      // Update statistics
      for (const metadata of batchMetadata) {
        statistics.dataTypes[metadata.type] = (statistics.dataTypes[metadata.type] || 0) + 1;
        statistics.totalSize += metadata.size;
        if (metadata.ttl > 0) {
          statistics.keysWithTTL++;
        }
      }
    }

    statistics.averageKeySize = statistics.totalSize / keys.length;
    
    // Generate global checksum
    const globalChecksum = this.generateGlobalChecksum(keyMetadata);
    
    const snapshot: MigrationSnapshot = {
      id: snapshotId,
      timestamp: Date.now(),
      totalKeys: keys.length,
      keyMetadata,
      globalChecksum,
      statistics
    };
    
    this.migrationSnapshots.push(snapshot);
    
    const duration = performance.now() - startTime;
    console.log(`[DataIntegrity] Snapshot created in ${duration.toFixed(2)}ms for ${keys.length} keys`);
    
    return snapshot;
  }

  /**
   * Validate data integrity between source and target
   */
  async validateDataIntegrity(
    sourceClient: Redis,
    targetClient: Redis,
    keyPattern: string = '*'
  ): Promise<ValidationResult> {
    const checkId = `integrity_check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage().heapUsed;
    
    console.log(`[DataIntegrity] Starting validation: ${checkId}`);
    
    const result: ValidationResult = {
      checkId,
      success: false,
      totalKeys: 0,
      validatedKeys: 0,
      inconsistentKeys: [],
      errors: [],
      performance: {
        duration: 0,
        keysPerSecond: 0,
        memoryUsage: 0
      },
      checksums: {
        source: '',
        target: '',
        match: false
      },
      statistics: {
        dataTypes: {},
        sizesDistribution: {},
        ttlDistribution: {}
      }
    };

    try {
      // Get all keys from source
      const sourceKeys = await this.scanKeys(sourceClient, keyPattern);
      result.totalKeys = sourceKeys.length;
      
      if (sourceKeys.length === 0) {
        result.success = true;
        return result;
      }

      // Process keys in batches with concurrency control
      const batches = this.createBatches(sourceKeys, this.config.batchSize);
      const concurrencyLimit = Math.min(this.config.maxConcurrency, batches.length);
      
      for (let i = 0; i < batches.length; i += concurrencyLimit) {
        const concurrentBatches = batches.slice(i, i + concurrencyLimit);
        
        const batchPromises = concurrentBatches.map(batch => 
          this.validateKeyBatch(sourceClient, targetClient, batch, result)
        );
        
        await Promise.all(batchPromises);
      }

      // Generate checksums for overall validation
      const sourceMetadata = await this.extractKeyMetadata(sourceClient, sourceKeys);
      const targetKeys = await this.scanKeys(targetClient, keyPattern);
      const targetMetadata = await this.extractKeyMetadata(targetClient, targetKeys);
      
      result.checksums.source = this.generateGlobalChecksum(sourceMetadata);
      result.checksums.target = this.generateGlobalChecksum(targetMetadata);
      result.checksums.match = result.checksums.source === result.checksums.target;

      // Calculate success based on tolerance threshold
      const inconsistencyRate = result.inconsistentKeys.length / result.totalKeys;
      result.success = inconsistencyRate <= this.config.toleranceThreshold && result.checksums.match;
      
      // Performance metrics
      const duration = performance.now() - startTime;
      const memoryAfter = process.memoryUsage().heapUsed;
      
      result.performance = {
        duration,
        keysPerSecond: result.totalKeys / (duration / 1000),
        memoryUsage: memoryAfter - memoryBefore
      };
      
      console.log(`[DataIntegrity] Validation completed: ${result.success ? 'PASSED' : 'FAILED'}`);
      console.log(`[DataIntegrity] Validated ${result.validatedKeys}/${result.totalKeys} keys`);
      console.log(`[DataIntegrity] Found ${result.inconsistentKeys.length} inconsistencies`);
      console.log(`[DataIntegrity] Performance: ${result.performance.keysPerSecond.toFixed(2)} keys/sec`);
      
    } catch (error) {
      console.error(`[DataIntegrity] Validation failed:`, error);
      result.errors.push({
        key: 'VALIDATION_ERROR',
        type: 'missing',
        details: { error: error instanceof Error ? error.message : String(error) }
      });
    }
    
    this.validationHistory.push(result);
    return result;
  }

  /**
   * Validate a batch of keys
   */
  private async validateKeyBatch(
    sourceClient: Redis,
    targetClient: Redis,
    keys: string[],
    result: ValidationResult
  ): Promise<void> {
    for (const key of keys) {
      try {
        const validation = await this.validateSingleKey(sourceClient, targetClient, key);
        
        if (validation.success) {
          result.validatedKeys++;
        } else {
          result.inconsistentKeys.push(key);
          result.errors.push(...validation.errors);
        }
        
        // Update statistics
        if (validation.metadata) {
          const { type, size, ttl } = validation.metadata;
          result.statistics.dataTypes[type] = (result.statistics.dataTypes[type] || 0) + 1;
          
          const sizeCategory = this.getSizeCategory(size);
          result.statistics.sizesDistribution[sizeCategory] = 
            (result.statistics.sizesDistribution[sizeCategory] || 0) + 1;
          
          const ttlCategory = this.getTTLCategory(ttl);
          result.statistics.ttlDistribution[ttlCategory] = 
            (result.statistics.ttlDistribution[ttlCategory] || 0) + 1;
        }
        
      } catch (error) {
        result.errors.push({
          key,
          type: 'missing',
          details: { error: (error as Error).message }
        });
      }
    }
  }

  /**
   * Validate a single key between source and target
   */
  private async validateSingleKey(
    sourceClient: Redis,
    targetClient: Redis,
    key: string
  ): Promise<{ success: boolean; errors: ValidationError[]; metadata?: KeyMetadata }> {
    const errors: ValidationError[] = [];
    
    try {
      // Check if key exists in both clients
      const [sourceExists, targetExists] = await Promise.all([
        sourceClient.exists(key),
        targetClient.exists(key)
      ]);
      
      if (sourceExists && !targetExists) {
        errors.push({
          key,
          type: 'missing',
          details: { source: 'exists', target: 'missing' }
        });
        return { success: false, errors };
      }
      
      if (!sourceExists) {
        return { success: true, errors }; // Key doesn't exist in source, skip
      }

      // Get key metadata from both clients
      const [sourceMetadata, targetMetadata] = await Promise.all([
        this.getKeyMetadata(sourceClient, key),
        this.getKeyMetadata(targetClient, key)
      ]);

      // Validate data type
      if (this.config.validateTypes && sourceMetadata.type !== targetMetadata.type) {
        errors.push({
          key,
          type: 'type_mismatch',
          details: {
            expected: sourceMetadata.type,
            actual: targetMetadata.type
          }
        });
      }

      // Validate TTL
      if (this.config.validateTTL) {
        const ttlDifference = Math.abs(sourceMetadata.ttl - targetMetadata.ttl);
        if (ttlDifference > 5) { // Allow 5 second tolerance for TTL
          errors.push({
            key,
            type: 'ttl_mismatch',
            details: {
              expected: sourceMetadata.ttl,
              actual: targetMetadata.ttl
            }
          });
        }
      }

      // Validate size
      if (this.config.validateSize && sourceMetadata.size !== targetMetadata.size) {
        errors.push({
          key,
          type: 'size_mismatch',
          details: {
            expected: sourceMetadata.size,
            actual: targetMetadata.size
          }
        });
      }

      // Validate checksum (value content)
      if (sourceMetadata.checksum !== targetMetadata.checksum) {
        errors.push({
          key,
          type: 'checksum_mismatch',
          details: {
            expected: sourceMetadata.checksum,
            actual: targetMetadata.checksum
          }
        });
      }

      return {
        success: errors.length === 0,
        errors,
        metadata: sourceMetadata
      };
      
    } catch (error) {
      errors.push({
        key,
        type: 'missing',
        details: { error: (error as Error).message }
      });
      return { success: false, errors };
    }
  }

  /**
   * Get metadata for a single key
   */
  private async getKeyMetadata(client: Redis, key: string): Promise<KeyMetadata> {
    const [type, ttl, value] = await Promise.all([
      client.type(key),
      client.ttl(key),
      this.getKeyValue(client, key)
    ]);
    
    const serializedValue = JSON.stringify(value);
    const size = Buffer.byteLength(serializedValue, 'utf8');
    const checksum = this.generateChecksum(serializedValue);
    
    return {
      key,
      type,
      size,
      ttl: ttl === -1 ? 0 : ttl, // Convert -1 (no expiry) to 0
      checksum
    };
  }

  /**
   * Get value for any Redis data type
   */
  private async getKeyValue(client: Redis, key: string): Promise<any> {
    const type = await client.type(key);
    
    switch (type) {
      case 'string':
        return await client.get(key);
      case 'hash':
        return await client.hgetall(key);
      case 'list':
        return await client.lrange(key, 0, -1);
      case 'set':
        return await client.smembers(key);
      case 'zset':
        return await client.zrange(key, 0, -1, 'WITHSCORES');
      case 'stream':
        return await client.xrange(key, '-', '+');
      default:
        return null;
    }
  }

  /**
   * Extract metadata for multiple keys
   */
  private async extractKeyMetadata(client: Redis, keys: string[]): Promise<KeyMetadata[]> {
    const metadata: KeyMetadata[] = [];
    
    for (let i = 0; i < keys.length; i += this.config.batchSize) {
      const batch = keys.slice(i, i + this.config.batchSize);
      const batchPromises = batch.map(key => this.getKeyMetadata(client, key));
      const batchMetadata = await Promise.all(batchPromises);
      metadata.push(...batchMetadata);
    }
    
    return metadata;
  }

  /**
   * Scan all keys matching pattern
   */
  private async scanKeys(client: Redis, pattern: string = '*'): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    
    do {
      const result = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 1000);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');
    
    return keys;
  }

  /**
   * Generate checksum for data
   */
  private generateChecksum(data: string): string {
    return crypto
      .createHash(this.config.checksumAlgorithm)
      .update(data)
      .digest('hex');
  }

  /**
   * Generate global checksum from metadata array
   */
  private generateGlobalChecksum(metadata: KeyMetadata[]): string {
    const sortedMetadata = metadata
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(m => `${m.key}:${m.checksum}:${m.type}:${m.size}:${m.ttl}`)
      .join('|');
    
    return this.generateChecksum(sortedMetadata);
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Get size category for statistics
   */
  private getSizeCategory(size: number): string {
    if (size < 1024) return 'small (<1KB)';
    if (size < 10240) return 'medium (1-10KB)';
    if (size < 102400) return 'large (10-100KB)';
    return 'xlarge (>100KB)';
  }

  /**
   * Get TTL category for statistics
   */
  private getTTLCategory(ttl: number): string {
    if (ttl === 0) return 'no-expiry';
    if (ttl < 3600) return 'short (<1h)';
    if (ttl < 86400) return 'medium (1-24h)';
    return 'long (>24h)';
  }

  /**
   * Start real-time validation
   */
  startRealTimeValidation(
    sourceClient: Redis,
    targetClient: Redis,
    keyPattern: string = '*',
    intervalMs: number = 60000
  ): string {
    const validatorId = `realtime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const validator = setInterval(async () => {
      try {
        const result = await this.validateDataIntegrity(sourceClient, targetClient, keyPattern);
        
        if (!result.success) {
          console.warn(`[DataIntegrity] Real-time validation failed: ${result.inconsistentKeys.length} inconsistencies`);
          
          // Emit event or trigger alert
          this.handleValidationFailure(result);
        }
      } catch (error) {
        console.error(`[DataIntegrity] Real-time validation error:`, error);
      }
    }, intervalMs);
    
    this.realTimeValidators.set(validatorId, validator);
    console.log(`[DataIntegrity] Started real-time validation: ${validatorId}`);
    
    return validatorId;
  }

  /**
   * Stop real-time validation
   */
  stopRealTimeValidation(validatorId: string): boolean {
    const validator = this.realTimeValidators.get(validatorId);
    if (validator) {
      clearInterval(validator);
      this.realTimeValidators.delete(validatorId);
      console.log(`[DataIntegrity] Stopped real-time validation: ${validatorId}`);
      return true;
    }
    return false;
  }

  /**
   * Handle validation failure
   */
  private handleValidationFailure(result: ValidationResult): void {
    // Log detailed failure information
    console.error(`[DataIntegrity] Validation failure details:`);
    console.error(`- Check ID: ${result.checkId}`);
    console.error(`- Inconsistent keys: ${result.inconsistentKeys.length}`);
    console.error(`- Error count: ${result.errors.length}`);
    console.error(`- Checksum match: ${result.checksums.match}`);
    
    // In a production environment, you might:
    // - Send alerts to monitoring systems
    // - Trigger automatic rollback procedures
    // - Pause migration processes
    // - Generate detailed reports
  }

  /**
   * Generate validation report
   */
  generateValidationReport(): {
    summary: {
      totalValidations: number;
      successfulValidations: number;
      failedValidations: number;
      averagePerformance: number;
    };
    recentValidations: ValidationResult[];
    snapshots: MigrationSnapshot[];
  } {
    const successful = this.validationHistory.filter(v => v.success).length;
    const avgPerformance = this.validationHistory.length > 0 
      ? this.validationHistory.reduce((sum, v) => sum + v.performance.keysPerSecond, 0) / this.validationHistory.length
      : 0;
    
    return {
      summary: {
        totalValidations: this.validationHistory.length,
        successfulValidations: successful,
        failedValidations: this.validationHistory.length - successful,
        averagePerformance: avgPerformance
      },
      recentValidations: this.validationHistory.slice(-10),
      snapshots: this.migrationSnapshots
    };
  }

  /**
   * Compare two snapshots
   */
  compareSnapshots(snapshot1Id: string, snapshot2Id: string): {
    keysDifference: {
      added: string[];
      removed: string[];
      modified: string[];
    };
    statisticsDifference: {
      totalKeys: number;
      totalSize: number;
      dataTypes: Record<string, number>;
    };
  } {
    const snapshot1 = this.migrationSnapshots.find(s => s.id === snapshot1Id);
    const snapshot2 = this.migrationSnapshots.find(s => s.id === snapshot2Id);
    
    if (!snapshot1 || !snapshot2) {
      throw new Error('Snapshot not found');
    }
    
    const keys1 = new Set(snapshot1.keyMetadata.map(k => k.key));
    const keys2 = new Set(snapshot2.keyMetadata.map(k => k.key));
    const checksums1 = new Map(snapshot1.keyMetadata.map(k => [k.key, k.checksum]));
    const checksums2 = new Map(snapshot2.keyMetadata.map(k => [k.key, k.checksum]));
    
    const added = Array.from(keys2).filter(k => !keys1.has(k));
    const removed = Array.from(keys1).filter(k => !keys2.has(k));
    const modified = Array.from(keys1)
      .filter(k => keys2.has(k) && checksums1.get(k) !== checksums2.get(k));
    
    return {
      keysDifference: { added, removed, modified },
      statisticsDifference: {
        totalKeys: snapshot2.totalKeys - snapshot1.totalKeys,
        totalSize: snapshot2.statistics.totalSize - snapshot1.statistics.totalSize,
        dataTypes: Object.keys({ ...snapshot1.statistics.dataTypes, ...snapshot2.statistics.dataTypes })
          .reduce((acc, type) => {
            acc[type] = (snapshot2.statistics.dataTypes[type] || 0) - (snapshot1.statistics.dataTypes[type] || 0);
            return acc;
          }, {} as Record<string, number>)
      }
    };
  }

  /**
   * Get validation history
   */
  getValidationHistory(): ValidationResult[] {
    return [...this.validationHistory];
  }

  /**
   * Clear validation history
   */
  clearValidationHistory(): void {
    this.validationHistory = [];
  }

  /**
   * Get migration snapshots
   */
  getMigrationSnapshots(): MigrationSnapshot[] {
    return [...this.migrationSnapshots];
  }
}

// Export types and interfaces
export type {
  DataIntegrityCheck,
  ValidationResult,
  ValidationError,
  MigrationValidationConfig,
  KeyMetadata,
  MigrationSnapshot
};