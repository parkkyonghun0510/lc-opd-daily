/**
 * Application Initializer
 * 
 * Runs comprehensive environment validation and system checks during application startup
 * Provides graceful error handling and clear user feedback
 */

// Environment validation utilities (replaced EnvironmentValidator)

// System initialization interface
interface InitializationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  services: {
    environment: boolean;
    redis: boolean;
    dragonfly: boolean;
    vapid: boolean;
  };
  startupTime: number;
}

// Application initializer service
export class ApplicationInitializer {
  private static instance: ApplicationInitializer;
  private isInitialized: boolean = false;
  private initResult: InitializationResult | null = null;

  public static getInstance(): ApplicationInitializer {
    if (!ApplicationInitializer.instance) {
      ApplicationInitializer.instance = new ApplicationInitializer();
    }
    return ApplicationInitializer.instance;
  }

  /**
   * Initialize the application with comprehensive checks
   * @param strict Whether to throw errors on initialization failure
   * @returns Initialization result with detailed status
   */
  public async initialize(strict: boolean = false): Promise<InitializationResult> {
    const startTime = Date.now();
    
    // Skip if already initialized
    if (this.isInitialized && this.initResult) {
      return this.initResult;
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const services = {
      environment: false,
      redis: false,
      dragonfly: false,
      vapid: false,
    };

    try {
      console.log('🚀 Starting application initialization...');

      // Step 1: Validate environment variables
      console.log('📋 Validating environment variables...');
      const envResult = this.validateEnvironmentVariables();
      
      services.environment = envResult.success;
      
      if (!envResult.success) {
        errors.push(...envResult.errors);
      }
      
      if (envResult.warnings.length > 0) {
        warnings.push(...envResult.warnings);
      }

      // Skip server-side checks in browser environment
      const isBrowser = typeof window !== 'undefined';
      if (!isBrowser) {
        try {
          // Dynamic imports to prevent webpack from bundling Node.js modules
          const [{ testRedisConnection }, { getDragonflyQueueService }] = await Promise.all([
            import('@/lib/redis').then(mod => ({ testRedisConnection: mod.testRedisConnection })),
            import('@/lib/dragonfly-queue').then(mod => ({ getDragonflyQueueService: mod.getDragonflyQueueService }))
          ]);

          // Step 2: Test Redis/Dragonfly connection (server-side only)
          console.log('🔌 Testing Redis/Dragonfly connection...');
          try {
            const redisConnected = await testRedisConnection();
            services.redis = redisConnected;
            
            if (!redisConnected) {
              errors.push('Redis/Dragonfly connection failed - queue functionality may be limited');
            } else {
              console.log('✅ Redis/Dragonfly connection successful');
            }
          } catch (error) {
            errors.push(`Redis/Dragonfly connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }

          // Step 3: Test Dragonfly queue service (server-side only)
          console.log('📦 Testing Dragonfly queue service...');
          try {
            const dragonflyQueue = getDragonflyQueueService();
            if (dragonflyQueue) {
              services.dragonfly = true;
              console.log('✅ Dragonfly queue service initialized');
            } else {
              errors.push('Dragonfly queue service failed to initialize');
            }
          } catch (error) {
            errors.push(`Dragonfly queue error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        } catch (importError) {
          warnings.push('Could not load server-side validation modules');
          services.redis = false;
          services.dragonfly = false;
        }
      } else {
        // Browser environment - mark services as unavailable but not errors
        services.redis = false;
        services.dragonfly = false;
        warnings.push('Server-side services (Redis/Dragonfly) cannot be tested in browser environment');
      }

      // Step 4: Validate VAPID configuration
      console.log('🔐 Validating VAPID configuration...');
      try {
        const vapidValid = this.validateVapidConfiguration();
        services.vapid = vapidValid;
        
        if (!vapidValid) {
          warnings.push('VAPID configuration missing or invalid - push notifications will be disabled');
        } else {
          console.log('✅ VAPID configuration valid');
        }
      } catch (error) {
        warnings.push(`VAPID validation warning: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      const startupTime = Date.now() - startTime;

      const result: InitializationResult = {
        success: errors.length === 0,
        errors,
        warnings,
        services,
        startupTime
      };

      this.initResult = result;
      this.isInitialized = true;

      // Print initialization summary
      this.printInitializationSummary(result);

      if (strict && !result.success) {
        throw new Error(`Application initialization failed:\n${errors.join('\n')}`);
      }

      return result;

    } catch (error) {
      const startupTime = Date.now() - startTime;
      
      const result: InitializationResult = {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown initialization error'],
        warnings,
        services,
        startupTime
      };

      this.initResult = result;
      return result;
    }
  }

  /**
   * Validate VAPID configuration specifically
   */
  private validateVapidConfiguration(): boolean {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    const privateKey = process.env.VAPID_PRIVATE_KEY || '';
    const contactEmail = process.env.VAPID_CONTACT_EMAIL || '';

    if (!publicKey || !privateKey || !contactEmail) {
      return false;
    }

    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      return false;
    }

    // Key length validation
    if (publicKey.length < 20 || privateKey.length < 20) {
      return false;
    }

    return true;
  }

  /**
   * Validate environment variables with basic checks
   */
  private validateEnvironmentVariables(): { success: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const isBrowser = typeof window !== 'undefined';

    // Validate Dragonfly/Redis configuration
    const dragonflyUrl = process.env.DRAGONFLY_URL;
    if (!isBrowser) {
      if (!dragonflyUrl) {
        errors.push('DRAGONFLY_URL must be configured for queue functionality');
      } else {
        try {
          new URL(dragonflyUrl);
        } catch {
          errors.push(`Invalid DRAGONFLY_URL format: ${dragonflyUrl}`);
        }
      }
    }

    const queueName = process.env.DRAGONFLY_QUEUE_NAME;
    if (!queueName || queueName.trim().length === 0) {
      warnings.push('DRAGONFLY_QUEUE_NAME not set, using default: "notifications"');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(queueName)) {
      errors.push('DRAGONFLY_QUEUE_NAME must contain only alphanumeric characters, hyphens, and underscores');
    }

    const queueUrl = process.env.DRAGONFLY_QUEUE_URL;
    if (queueUrl) {
      try {
        new URL(queueUrl);
      } catch {
        errors.push(`Invalid DRAGONFLY_QUEUE_URL format: ${queueUrl}`);
      }
    }

    // Validate VAPID configuration
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const contactEmail = process.env.VAPID_CONTACT_EMAIL;

    if (isBrowser) {
      if (!publicKey || publicKey.trim().length === 0) {
        warnings.push('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set; push notifications will be disabled');
      }
    } else {
      // Server-side validation
      if (!publicKey || publicKey.trim().length === 0) {
        warnings.push('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set; push notifications will be disabled');
      }

      if (!privateKey || privateKey.trim().length === 0) {
        warnings.push('VAPID_PRIVATE_KEY is not set; push notifications will be disabled');
      }

      if (!contactEmail) {
        warnings.push('VAPID_CONTACT_EMAIL is not set; push notifications will be disabled');
      }

      // Basic email validation
      if (contactEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contactEmail)) {
          warnings.push('VAPID_CONTACT_EMAIL appears to be invalid');
        }
      }

      // Key validation
      if (publicKey && privateKey) {
        if (publicKey.length < 20 || publicKey.length > 100) {
          warnings.push('NEXT_PUBLIC_VAPID_PUBLIC_KEY appears to be an unusual length');
        }
        if (privateKey.length < 20 || privateKey.length > 100) {
          warnings.push('VAPID_PRIVATE_KEY appears to be an unusual length');
        }
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Print initialization summary to console
   */
  private printInitializationSummary(result: InitializationResult): void {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 APPLICATION INITIALIZATION SUMMARY');
    console.log('='.repeat(60));
    
    if (result.success) {
      console.log('✅ Application initialized successfully');
      console.log(`⏱️  Startup time: ${result.startupTime}ms`);
    } else {
      console.log('❌ Application initialization failed');
      console.log(`⏱️  Startup time: ${result.startupTime}ms`);
    }

    console.log('\n📊 Service Status:');
    console.log(`   Environment: ${result.services.environment ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`   Redis/Dragonfly: ${result.services.redis ? '✅ Connected' : '❌ Failed'}`);
    console.log(`   Dragonfly Queue: ${result.services.dragonfly ? '✅ Ready' : '❌ Failed'}`);
    console.log(`   VAPID Push: ${result.services.vapid ? '✅ Configured' : '❌ Invalid'}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => console.log(`   • ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.log(`   • ${warning}`));
    }

    console.log('='.repeat(60) + '\n');
  }

  /**
   * Check if application is initialized
   */
  public isApplicationReady(): boolean {
    return this.isInitialized && (this.initResult?.success || false);
  }

  /**
   * Get initialization status
   */
  public getInitializationStatus(): InitializationResult | null {
    return this.initResult;
  }

  /**
   * Get specific service status
   */
  public getServiceStatus(service: keyof InitializationResult['services']): boolean {
    return this.initResult?.services[service] || false;
  }

  /**
   * Reset initialization (for testing purposes)
   */
  public reset(): void {
    this.isInitialized = false;
    this.initResult = null;
  }
}

// Utility functions for quick access
export async function initializeApplication(strict: boolean = false): Promise<InitializationResult> {
  const initializer = ApplicationInitializer.getInstance();
  return await initializer.initialize(strict);
}

export function isApplicationReady(): boolean {
  const initializer = ApplicationInitializer.getInstance();
  return initializer.isApplicationReady();
}

export function getServiceStatus(service: keyof InitializationResult['services']): boolean {
  const initializer = ApplicationInitializer.getInstance();
  return initializer.getServiceStatus(service);
}

// Export types
export type { InitializationResult };