"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AlertCircle, Home, ChevronRight } from 'lucide-react';
import Link from 'next/link';

// Common form page header with breadcrumbs
interface FormPageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Array<{
    label: string;
    href?: string;
    icon?: React.ElementType;
  }>;
  className?: string;
}

export const FormPageHeader: React.FC<FormPageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  className
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="flex items-center hover:text-foreground"
                >
                  {crumb.icon && <crumb.icon className="h-4 w-4 mr-1" />}
                  {crumb.label}
                </Link>
              ) : (
                <span className="flex items-center">
                  {crumb.icon && <crumb.icon className="h-4 w-4 mr-1" />}
                  {crumb.label}
                </span>
              )}
              {index < breadcrumbs.length - 1 && (
                <ChevronRight className="h-4 w-4" />
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

// Common form section card
interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  children,
  actions,
  className
}) => {
  return (
    <Card className={className}>
      <CardHeader className={actions ? 'flex flex-row items-center justify-between' : undefined}>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions && <div>{actions}</div>}
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
};

// Common form field group
interface FormFieldGroupProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

export const FormFieldGroup: React.FC<FormFieldGroupProps> = ({
  children,
  columns = 1,
  className
}) => {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3'
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

// Common form actions (submit, cancel, etc.)
interface FormActionsProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export const FormActions: React.FC<FormActionsProps> = ({
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
      'flex items-center space-x-2',
      alignClasses[align],
      className
    )}>
      {children}
    </div>
  );
};

// Common form skeleton loader
interface FormSkeletonProps {
  sections?: number;
  fieldsPerSection?: number;
  showActions?: boolean;
  className?: string;
}

export const FormSkeleton: React.FC<FormSkeletonProps> = ({
  sections = 1,
  fieldsPerSection = 4,
  showActions = true,
  className
}) => {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header skeleton */}
      <div className="mb-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      {/* Breadcrumb skeleton */}
      <div className="flex items-center space-x-2 mb-6">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-16" />
      </div>

      {/* Form sections skeleton */}
      {Array.from({ length: sections }).map((_, sectionIndex) => (
        <Card key={sectionIndex}>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: fieldsPerSection }).map((_, fieldIndex) => (
                <div key={fieldIndex} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Actions skeleton */}
      {showActions && (
        <div className="flex justify-end space-x-2">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-24" />
        </div>
      )}
    </div>
  );
};

// Common form error display
interface FormErrorProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const FormError: React.FC<FormErrorProps> = ({
  title = 'Error',
  message,
  onRetry,
  className
}) => {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{message}</span>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm" className="ml-4">
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

// Common form layout wrapper
interface FormLayoutProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const maxWidthClasses = {
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl'
};

export const FormLayout: React.FC<FormLayoutProps> = ({
  children,
  maxWidth = 'lg',
  className
}) => {
  return (
    <div className={cn(
      'container mx-auto p-4 space-y-6',
      maxWidthClasses[maxWidth],
      className
    )}>
      {children}
    </div>
  );
};

// Profile-specific components
interface ProfileAvatarSectionProps {
  avatarUrl?: string;
  name: string;
  role?: string;
  onAvatarChange?: () => void;
  isLoading?: boolean;
  className?: string;
}

export const ProfileAvatarSection: React.FC<ProfileAvatarSectionProps> = ({
  avatarUrl,
  name,
  role,
  onAvatarChange,
  isLoading,
  className
}) => {
  return (
    <div className={cn('flex flex-col items-center space-y-4', className)}>
      {isLoading ? (
        <Skeleton className="h-24 w-24 rounded-full" />
      ) : (
        <div className="relative">
          <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center text-2xl font-semibold">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </div>
          {onAvatarChange && (
            <Button
              size="sm"
              variant="outline"
              className="absolute -bottom-2 -right-2"
              onClick={onAvatarChange}
            >
              Edit
            </Button>
          )}
        </div>
      )}
      {isLoading ? (
        <div className="space-y-1 text-center">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      ) : (
        <div className="text-center">
          <h3 className="font-semibold">{name}</h3>
          {role && <p className="text-sm text-muted-foreground">{role}</p>}
        </div>
      )}
    </div>
  );
};