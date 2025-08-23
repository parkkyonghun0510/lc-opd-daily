"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Common dashboard header with gradient background
interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  gradient?: 'blue' | 'purple' | 'green' | 'orange';
  rightContent?: React.ReactNode;
  className?: string;
}

const gradientClasses = {
  blue: 'from-blue-600 to-indigo-600',
  purple: 'from-purple-600 to-indigo-600',
  green: 'from-green-600 to-emerald-600',
  orange: 'from-orange-600 to-red-600'
};

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  subtitle,
  gradient = 'blue',
  rightContent,
  className
}) => {
  return (
    <div className={cn(
      'bg-gradient-to-r rounded-lg p-6 text-white',
      gradientClasses[gradient],
      className
    )}>
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-semibold mb-2">{title}</h2>
          {subtitle && <p className="opacity-90">{subtitle}</p>}
        </div>
        {rightContent && (
          <div className="text-right">
            {rightContent}
          </div>
        )}
      </div>
    </div>
  );
};

// Common metrics grid layout
interface MetricsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({
  children,
  columns = 4,
  className
}) => {
  const gridClasses = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4'
  };

  return (
    <div className={cn(
      'grid gap-4',
      gridClasses[columns],
      className
    )}>
      {children}
    </div>
  );
};

// Common data table card wrapper
interface DataTableCardProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const DataTableCard: React.FC<DataTableCardProps> = ({
  title,
  description,
  icon: Icon,
  children,
  actions,
  className
}) => {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5" />}
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
};

// Common action buttons section
interface ActionSectionProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export const ActionSection: React.FC<ActionSectionProps> = ({
  children,
  align = 'right',
  className
}) => {
  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end'
  };

  return (
    <div className={cn(
      'flex items-center gap-2',
      alignClasses[align],
      className
    )}>
      {children}
    </div>
  );
};

// Common page layout wrapper
interface PageLayoutProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
}

const maxWidthClasses = {
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
  '2xl': 'max-w-screen-2xl',
  full: 'max-w-full'
};

const paddingClasses = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8'
};

export const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  maxWidth = 'xl',
  padding = 'md',
  className
}) => {
  return (
    <div className={cn(
      'container mx-auto space-y-6',
      maxWidthClasses[maxWidth],
      paddingClasses[padding],
      className
    )}>
      {children}
    </div>
  );
};

// Common stats card with consistent styling
interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ElementType;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  isLoading?: boolean;
  className?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  trend,
  isLoading,
  className
}) => {
  return (
    <Card className={cn('shadow-sm hover:shadow-md transition-shadow duration-200', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-8 w-1/2 bg-muted animate-pulse rounded" />
            <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {value}
            </div>
            <div className="flex items-center justify-between">
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
              {trend && (
                <span className={cn(
                  'text-xs font-medium',
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                )}>
                  {trend.isPositive ? '+' : ''}{trend.value}%
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};