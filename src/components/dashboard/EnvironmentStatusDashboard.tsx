'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ChevronDownIcon, ChevronRightIcon, CheckIcon, AlertTriangleIcon, XIcon, InfoIcon } from 'lucide-react';

interface EnvironmentVariable {
  name: string;
  status: 'configured' | 'missing' | 'browser-restricted';
  description: string;
  required: boolean;
  category: 'database' | 'auth' | 'push-notifications' | 'external-services' | 'security';
}

interface ValidationResult {
  variable: string;
  status: 'success' | 'warning' | 'error';
  message: string;
}

interface HealthCheckResponse {
  status: 'healthy' | 'warning' | 'error';
  timestamp: string;
  environment: string;
  checks: Array<{
    name: string;
    status: 'configured' | 'missing' | 'invalid';
    message: string;
    required: boolean;
    category: string;
  }>;
  summary: {
    total: number;
    configured: number;
    missing: number;
    invalid: number;
  };
}

const ENVIRONMENT_VARIABLES: EnvironmentVariable[] = [
  {
    name: 'DATABASE_URL',
    status: 'configured',
    description: 'PostgreSQL database connection string',
    required: true,
    category: 'database'
  },
  {
    name: 'DRAGONFLY_URL',
    status: 'browser-restricted',
    description: 'Redis-compatible cache database URL',
    required: true,
    category: 'database'
  },
  {
    name: 'NEXTAUTH_SECRET',
    status: 'configured',
    description: 'Secret key for NextAuth.js session encryption',
    required: true,
    category: 'auth'
  },
  {
    name: 'NEXTAUTH_URL',
    status: 'configured',
    description: 'Base URL for NextAuth.js callbacks',
    required: true,
    category: 'auth'
  },
  {
    name: 'VAPID_PRIVATE_KEY',
    status: 'browser-restricted',
    description: 'Private key for web push notifications',
    required: true,
    category: 'push-notifications'
  },
  {
    name: 'VAPID_PUBLIC_KEY',
    status: 'configured',
    description: 'Public key for web push notifications',
    required: true,
    category: 'push-notifications'
  },
  {
    name: 'VAPID_CONTACT_EMAIL',
    status: 'browser-restricted',
    description: 'Contact email for VAPID identification',
    required: true,
    category: 'push-notifications'
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    status: 'configured',
    description: 'Google OAuth client identifier',
    required: false,
    category: 'auth'
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    status: 'browser-restricted',
    description: 'Google OAuth client secret',
    required: false,
    category: 'auth'
  }
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'configured':
    case 'success':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'browser-restricted':
    case 'warning':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'missing':
    case 'error':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'configured':
    case 'success':
      return <CheckIcon className="w-4 h-4" />;
    case 'browser-restricted':
    case 'warning':
      return <AlertTriangleIcon className="w-4 h-4" />;
    case 'missing':
    case 'error':
      return <XIcon className="w-4 h-4" />;
    default:
      return <InfoIcon className="w-4 h-4" />;
  }
};

const CategorySection: React.FC<{
  category: string;
  variables: EnvironmentVariable[];
  value: string;
}> = ({ category, variables, value }) => {
  const categoryStats = {
    total: variables.length,
    configured: variables.filter(v => v.status === 'configured').length,
    browserRestricted: variables.filter(v => v.status === 'browser-restricted').length,
    missing: variables.filter(v => v.status === 'missing').length
  };

  const categoryTitle = category.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');

  return (
    <AccordionItem value={value}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-3">
            <div className="text-left">
              <h3 className="font-medium">{categoryTitle}</h3>
              <p className="text-sm text-muted-foreground">
                {categoryStats.configured} configured, {categoryStats.browserRestricted} browser-restricted, {categoryStats.missing} missing
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {categoryStats.configured > 0 && (
              <Badge variant="secondary" className={getStatusColor('configured')}>
                {categoryStats.configured}
              </Badge>
            )}
            {categoryStats.browserRestricted > 0 && (
              <Badge variant="secondary" className={getStatusColor('browser-restricted')}>
                {categoryStats.browserRestricted}
              </Badge>
            )}
            {categoryStats.missing > 0 && (
              <Badge variant="secondary" className={getStatusColor('missing')}>
                {categoryStats.missing}
              </Badge>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-2">
          {variables.map((variable) => (
            <div key={variable.name} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    {variable.name}
                  </code>
                  {variable.required && (
                    <Badge variant="outline" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {variable.description}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(variable.status)}>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(variable.status)}
                    <span className="capitalize">
                      {variable.status === 'browser-restricted' ? 'Secure' : variable.status}
                    </span>
                  </div>
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export const EnvironmentStatusDashboard: React.FC = () => {
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const runValidation = async () => {
    setIsValidating(true);
    
    try {
      const response = await fetch('/api/health/environment');
      const healthData: HealthCheckResponse = await response.json();
      
      const results: ValidationResult[] = healthData.checks.map(check => {
        let status: 'success' | 'warning' | 'error';
        
        switch (check.status) {
          case 'configured':
            status = 'success';
            break;
          case 'missing':
            status = check.required ? 'error' : 'warning';
            break;
          case 'invalid':
            status = 'error';
            break;
          default:
            status = 'warning';
        }
        
        return {
          variable: check.name,
          status,
          message: check.message
        };
      });
      
      setValidationResults(results);
    } catch (error) {
      console.error('Failed to run environment validation:', error);
      setValidationResults([{
        variable: 'HEALTH_CHECK',
        status: 'error',
        message: 'Failed to connect to health check endpoint'
      }]);
    } finally {
      setIsValidating(false);
    }
  };

  const groupedVariables = ENVIRONMENT_VARIABLES.reduce((acc, variable) => {
    if (!acc[variable.category]) {
      acc[variable.category] = [];
    }
    acc[variable.category].push(variable);
    return acc;
  }, {} as Record<string, EnvironmentVariable[]>);

  const totalStats = {
    total: ENVIRONMENT_VARIABLES.length,
    configured: ENVIRONMENT_VARIABLES.filter(v => v.status === 'configured').length,
    browserRestricted: ENVIRONMENT_VARIABLES.filter(v => v.status === 'browser-restricted').length,
    missing: ENVIRONMENT_VARIABLES.filter(v => v.status === 'missing').length
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Environment Configuration Status</CardTitle>
              <CardDescription>
                Monitor and validate your application's environment variables
              </CardDescription>
            </div>
            <Button onClick={runValidation} disabled={isValidating}>
              {isValidating ? 'Validating...' : 'Run Validation'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">{totalStats.total}</div>
              <div className="text-sm text-muted-foreground">Total Variables</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{totalStats.configured}</div>
              <div className="text-sm text-muted-foreground">Configured</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{totalStats.browserRestricted}</div>
              <div className="text-sm text-muted-foreground">Browser Restricted</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-red-600">{totalStats.missing}</div>
              <div className="text-sm text-muted-foreground">Missing</div>
            </div>
          </div>

          {validationResults.length > 0 && (
            <div className="mb-6 p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <InfoIcon className="w-4 h-4 text-blue-600" />
                <h3 className="font-medium">Live Validation Status</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Last checked: {new Date().toLocaleString()}
              </p>
            </div>
          )}

          <Accordion type="multiple" defaultValue={['database', 'auth']} className="space-y-4">
            {Object.entries(groupedVariables).map(([category, variables]) => (
              <CategorySection
                key={category}
                category={category}
                variables={variables}
                value={category}
              />
            ))}
          </Accordion>

          {validationResults.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-4">Validation Results</h3>
              <div className="space-y-2">
                {validationResults.map((result) => (
                  <div key={result.variable} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(result.status)}
                      <code className="text-sm font-mono">{result.variable}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{result.message}</span>
                      <Badge className={getStatusColor(result.status)}>
                        {result.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EnvironmentStatusDashboard;