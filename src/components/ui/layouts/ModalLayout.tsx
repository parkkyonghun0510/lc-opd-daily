"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

// Common modal content structure
interface ModalContentProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  showSeparator?: boolean;
  className?: string;
}

export const ModalContent: React.FC<ModalContentProps> = ({
  title,
  description,
  children,
  actions,
  showSeparator = true,
  className
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      
      {showSeparator && <Separator />}
      
      <div className="py-2">
        {children}
      </div>
      
      {actions && (
        <>
          {showSeparator && <Separator />}
          <div className="flex justify-end space-x-2 pt-2">
            {actions}
          </div>
        </>
      )}
    </div>
  );
};

// Enhanced Dialog wrapper with common patterns
interface EnhancedDialogProps {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const dialogSizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
};

export const EnhancedDialog: React.FC<EnhancedDialogProps> = ({
  trigger,
  title,
  description,
  children,
  actions,
  open,
  onOpenChange,
  size = 'md',
  className
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={cn(dialogSizeClasses[size], className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="py-4">
          {children}
        </div>
        {actions && (
          <DialogFooter>
            {actions}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Enhanced Sheet wrapper with common patterns
interface EnhancedSheetProps {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export const EnhancedSheet: React.FC<EnhancedSheetProps> = ({
  trigger,
  title,
  description,
  children,
  actions,
  open,
  onOpenChange,
  side = 'right',
  className
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent side={side} className={className}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="py-4 flex-1 overflow-y-auto">
          {children}
        </div>
        {actions && (
          <SheetFooter>
            {actions}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};

// Enhanced AlertDialog with common patterns
interface EnhancedAlertDialogProps {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: 'default' | 'destructive';
  className?: string;
}

export const EnhancedAlertDialog: React.FC<EnhancedAlertDialogProps> = ({
  trigger,
  title,
  description,
  children,
  confirmText = 'Continue',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  open,
  onOpenChange,
  variant = 'default',
  className
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent className={className}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children && (
          <div className="py-4">
            {children}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// Common confirmation dialog
interface ConfirmationDialogProps {
  trigger?: React.ReactNode;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: 'default' | 'destructive';
  isLoading?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  trigger,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  open,
  onOpenChange,
  variant = 'default',
  isLoading = false
}) => {
  return (
    <EnhancedAlertDialog
      trigger={trigger}
      title={title}
      description={message}
      confirmText={confirmText}
      cancelText={cancelText}
      onConfirm={onConfirm}
      onCancel={onCancel}
      open={open}
      onOpenChange={onOpenChange}
      variant={variant}
    />
  );
};

// Form dialog wrapper
interface FormDialogProps {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  submitText?: string;
  cancelText?: string;
  onSubmit?: () => void;
  onCancel?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isLoading?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const FormDialog: React.FC<FormDialogProps> = ({
  trigger,
  title,
  description,
  children,
  submitText = 'Save',
  cancelText = 'Cancel',
  onSubmit,
  onCancel,
  open,
  onOpenChange,
  isLoading = false,
  size = 'md',
  className
}) => {
  const actions = (
    <>
      <Button variant="outline" onClick={onCancel} disabled={isLoading}>
        {cancelText}
      </Button>
      <Button onClick={onSubmit} disabled={isLoading}>
        {isLoading && <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
        {submitText}
      </Button>
    </>
  );

  return (
    <EnhancedDialog
      trigger={trigger}
      title={title}
      description={description}
      actions={actions}
      open={open}
      onOpenChange={onOpenChange}
      size={size}
      className={className}
    >
      {children}
    </EnhancedDialog>
  );
};

// Quick action modal for common tasks
interface QuickActionModalProps {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  actions: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary';
    icon?: React.ElementType;
  }>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  trigger,
  title,
  description,
  actions,
  open,
  onOpenChange
}) => {
  return (
    <EnhancedDialog
      trigger={trigger}
      title={title}
      description={description}
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
    >
      <div className="space-y-2">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={index}
              variant={action.variant || 'outline'}
              className="w-full justify-start"
              onClick={() => {
                action.onClick();
                onOpenChange?.(false);
              }}
            >
              {Icon && <Icon className="mr-2 h-4 w-4" />}
              {action.label}
            </Button>
          );
        })}
      </div>
    </EnhancedDialog>
  );
};