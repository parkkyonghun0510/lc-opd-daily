import { NextRequest, NextResponse } from 'next/server';

interface EnvironmentCheck {
  name: string;
  status: 'configured' | 'missing' | 'invalid';
  message: string;
  required: boolean;
  category: 'database' | 'auth' | 'push-notifications' | 'external-services' | 'security';
}

interface HealthCheckResponse {
  status: 'healthy' | 'warning' | 'error';
  timestamp: string;
  environment: string;
  checks: EnvironmentCheck[];
  summary: {
    total: number;
    configured: number;
    missing: number;
    invalid: number;
  };
}

// Environment variables that can be safely checked on the client side
const CLIENT_SIDE_VARIABLES = [
  {
    name: 'NEXTAUTH_URL',
    required: true,
    category: 'auth' as const,
    description: 'Base URL for NextAuth.js callbacks'
  },
  {
    name: 'VAPID_PUBLIC_KEY',
    required: true,
    category: 'push-notifications' as const,
    description: 'Public key for web push notifications'
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    required: false,
    category: 'auth' as const,
    description: 'Google OAuth client identifier'
  },
  {
    name: 'NODE_ENV',
    required: true,
    category: 'security' as const,
    description: 'Node.js environment mode'
  }
];

// Server-side variables that cannot be validated in browser context
const SERVER_SIDE_VARIABLES = [
  {
    name: 'DATABASE_URL',
    required: true,
    category: 'database' as const,
    description: 'PostgreSQL database connection string'
  },
  {
    name: 'DRAGONFLY_URL',
    required: true,
    category: 'database' as const,
    description: 'Redis-compatible cache database URL'
  },
  {
    name: 'NEXTAUTH_SECRET',
    required: true,
    category: 'auth' as const,
    description: 'Secret key for NextAuth.js session encryption'
  },
  {
    name: 'VAPID_PRIVATE_KEY',
    required: true,
    category: 'push-notifications' as const,
    description: 'Private key for web push notifications'
  },
  {
    name: 'VAPID_CONTACT_EMAIL',
    required: true,
    category: 'push-notifications' as const,
    description: 'Contact email for VAPID identification'
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    required: false,
    category: 'auth' as const,
    description: 'Google OAuth client secret'
  }
];

function validateEnvironmentVariable(name: string, value: string | undefined, required: boolean): {
  status: 'configured' | 'missing' | 'invalid';
  message: string;
} {
  if (!value || value.trim() === '') {
    return {
      status: required ? 'missing' : 'configured',
      message: required ? `Required variable ${name} is not configured` : `Optional variable ${name} is not configured`
    };
  }

  // Basic validation for specific variables
  switch (name) {
    case 'NEXTAUTH_URL':
      try {
        new URL(value);
        return { status: 'configured', message: 'Valid URL format' };
      } catch {
        return { status: 'invalid', message: 'Invalid URL format' };
      }
    
    case 'VAPID_PUBLIC_KEY':
      if (value.length !== 88) {
        return { status: 'invalid', message: 'VAPID public key should be 88 characters long' };
      }
      return { status: 'configured', message: 'Valid VAPID public key format' };
    
    case 'NODE_ENV':
      const validEnvs = ['development', 'production', 'test'];
      if (!validEnvs.includes(value)) {
        return { status: 'invalid', message: `NODE_ENV should be one of: ${validEnvs.join(', ')}` };
      }
      return { status: 'configured', message: `Environment set to ${value}` };
    
    case 'GOOGLE_CLIENT_ID':
      if (!value.endsWith('.googleusercontent.com')) {
        return { status: 'invalid', message: 'Google Client ID should end with .googleusercontent.com' };
      }
      return { status: 'configured', message: 'Valid Google Client ID format' };
    
    default:
      return { status: 'configured', message: 'Variable is configured' };
  }
}

export async function GET(request: NextRequest) {
  try {
    const checks: EnvironmentCheck[] = [];
    
    // Check client-side variables (can be validated)
    CLIENT_SIDE_VARIABLES.forEach(variable => {
      const value = process.env[variable.name];
      const validation = validateEnvironmentVariable(variable.name, value, variable.required);
      
      checks.push({
        name: variable.name,
        status: validation.status,
        message: validation.message,
        required: variable.required,
        category: variable.category
      });
    });
    
    // Add server-side variables with appropriate status
    SERVER_SIDE_VARIABLES.forEach(variable => {
      const value = process.env[variable.name];
      const hasValue = value && value.trim() !== '';
      
      checks.push({
        name: variable.name,
        status: hasValue ? 'configured' : 'missing',
        message: hasValue 
          ? 'Server-side variable is configured (cannot validate in browser)'
          : variable.required 
            ? 'Required server-side variable is missing'
            : 'Optional server-side variable is not configured',
        required: variable.required,
        category: variable.category
      });
    });
    
    // Calculate summary
    const summary = {
      total: checks.length,
      configured: checks.filter(c => c.status === 'configured').length,
      missing: checks.filter(c => c.status === 'missing').length,
      invalid: checks.filter(c => c.status === 'invalid').length
    };
    
    // Determine overall status
    let overallStatus: 'healthy' | 'warning' | 'error' = 'healthy';
    
    const requiredMissing = checks.filter(c => c.required && c.status === 'missing').length;
    const hasInvalid = checks.some(c => c.status === 'invalid');
    
    if (requiredMissing > 0 || hasInvalid) {
      overallStatus = 'error';
    } else if (summary.missing > 0) {
      overallStatus = 'warning';
    }
    
    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      checks,
      summary
    };
    
    return NextResponse.json(response, {
      status: overallStatus === 'error' ? 500 : 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Environment health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
}

// Optional: Add a simple HEAD request for basic health checks
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}