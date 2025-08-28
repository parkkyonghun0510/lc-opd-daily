"use client";

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Enhanced feedback types
export type FeedbackType = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'progress';

export interface FeedbackMessage {
  id: string;
  type: FeedbackType;
  title: string;
  message: string;
  details?: string;
  timestamp: number;
  duration?: number;
  persistent?: boolean;
  actions?: FeedbackAction[];
  category?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  progress?: number;
  canDismiss?: boolean;
  autoRetry?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export interface FeedbackAction {
  label: string;
  action: () => void | Promise<void>;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  loading?: boolean;
}

interface FeedbackState {
  messages: FeedbackMessage[];
  isVisible: boolean;
  globalLoading: boolean;
  networkStatus: 'online' | 'offline' | 'slow';
  lastError: FeedbackMessage | null;
  errorCount: number;
  successStreak: number;
}

type FeedbackAction = 
  | { type: 'ADD_MESSAGE'; payload: FeedbackMessage }
  | { type: 'REMOVE_MESSAGE'; payload: string }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<FeedbackMessage> } }
  | { type: 'CLEAR_ALL' }
  | { type: 'CLEAR_CATEGORY'; payload: string }
  | { type: 'SET_GLOBAL_LOADING'; payload: boolean }
  | { type: 'SET_NETWORK_STATUS'; payload: 'online' | 'offline' | 'slow' }
  | { type: 'INCREMENT_ERROR_COUNT' }
  | { type: 'RESET_ERROR_COUNT' }
  | { type: 'INCREMENT_SUCCESS_STREAK' }
  | { type: 'RESET_SUCCESS_STREAK' };

const initialState: FeedbackState = {
  messages: [],
  isVisible: true,
  globalLoading: false,
  networkStatus: 'online',
  lastError: null,
  errorCount: 0,
  successStreak: 0,
};

function feedbackReducer(state: FeedbackState, action: FeedbackAction): FeedbackState {
  switch (action.type) {
    case 'ADD_MESSAGE': {
      const message = action.payload;
      
      // Update error tracking
      let updates: Partial<FeedbackState> = {};
      if (message.type === 'error') {
        updates.lastError = message;
        updates.errorCount = state.errorCount + 1;
        updates.successStreak = 0;
      } else if (message.type === 'success') {
        updates.successStreak = state.successStreak + 1;
      }

      return {
        ...state,
        messages: [...state.messages, message],
        ...updates,
      };
    }
    
    case 'REMOVE_MESSAGE':
      return {
        ...state,
        messages: state.messages.filter(m => m.id !== action.payload),
      };
    
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(m => 
          m.id === action.payload.id 
            ? { ...m, ...action.payload.updates }
            : m
        ),
      };
    
    case 'CLEAR_ALL':
      return {
        ...state,
        messages: [],
      };
    
    case 'CLEAR_CATEGORY':
      return {
        ...state,
        messages: state.messages.filter(m => m.category !== action.payload),
      };
    
    case 'SET_GLOBAL_LOADING':
      return {
        ...state,
        globalLoading: action.payload,
      };
    
    case 'SET_NETWORK_STATUS':
      return {
        ...state,
        networkStatus: action.payload,
      };
    
    case 'INCREMENT_ERROR_COUNT':
      return {
        ...state,
        errorCount: state.errorCount + 1,
        successStreak: 0,
      };
    
    case 'RESET_ERROR_COUNT':
      return {
        ...state,
        errorCount: 0,
      };
    
    case 'INCREMENT_SUCCESS_STREAK':
      return {
        ...state,
        successStreak: state.successStreak + 1,
      };
    
    case 'RESET_SUCCESS_STREAK':
      return {
        ...state,
        successStreak: 0,
      };
    
    default:
      return state;
  }
}

interface FeedbackContextType {
  state: FeedbackState;
  showMessage: (message: Omit<FeedbackMessage, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, updates: Partial<FeedbackMessage>) => void;
  removeMessage: (id: string) => void;
  clearAll: () => void;
  clearCategory: (category: string) => void;
  showSuccess: (title: string, message?: string, actions?: FeedbackAction[]) => string;
  showError: (title: string, message?: string, error?: Error, actions?: FeedbackAction[]) => string;
  showWarning: (title: string, message?: string, actions?: FeedbackAction[]) => string;
  showInfo: (title: string, message?: string, actions?: FeedbackAction[]) => string;
  showLoading: (title: string, message?: string) => string;
  showProgress: (title: string, progress: number, message?: string) => string;
  setGlobalLoading: (loading: boolean) => void;
  handleNetworkError: (error: Error) => void;
  handleAsyncOperation: <T>(
    operation: () => Promise<T>,
    options?: {
      loadingMessage?: string;
      successMessage?: string;
      errorMessage?: string;
      onSuccess?: (result: T) => void;
      onError?: (error: Error) => void;
    }
  ) => Promise<T>;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export function EnhancedFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(feedbackReducer, initialState);

  // Network status monitoring
  useEffect(() => {
    const updateNetworkStatus = () => {
      if (navigator.onLine) {
        // Check connection speed
        const connection = (navigator as any).connection;
        if (connection) {
          const { effectiveType, downlink } = connection;
          if (effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 1) {
            dispatch({ type: 'SET_NETWORK_STATUS', payload: 'slow' });
          } else {
            dispatch({ type: 'SET_NETWORK_STATUS', payload: 'online' });
          }
        } else {
          dispatch({ type: 'SET_NETWORK_STATUS', payload: 'online' });
        }
      } else {
        dispatch({ type: 'SET_NETWORK_STATUS', payload: 'offline' });
      }
    };

    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

  // Auto-remove messages based on duration
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    state.messages.forEach(message => {
      if (message.duration && !message.persistent && message.canDismiss !== false) {
        const timer = setTimeout(() => {
          dispatch({ type: 'REMOVE_MESSAGE', payload: message.id });
        }, message.duration);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [state.messages]);

  const generateId = useCallback(() => {
    return `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const showMessage = useCallback((messageData: Omit<FeedbackMessage, 'id' | 'timestamp'>) => {
    const id = generateId();
    const message: FeedbackMessage = {
      ...messageData,
      id,
      timestamp: Date.now(),
      canDismiss: messageData.canDismiss ?? true,
    };

    dispatch({ type: 'ADD_MESSAGE', payload: message });

    // Also show toast for immediate feedback
    if (message.type !== 'loading' && message.type !== 'progress') {
      toast(message.title, {
        description: message.message,
        duration: message.duration || 4000,
      });
    }

    return id;
  }, [generateId]);

  const updateMessage = useCallback((id: string, updates: Partial<FeedbackMessage>) => {
    dispatch({ type: 'UPDATE_MESSAGE', payload: { id, updates } });
  }, []);

  const removeMessage = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_MESSAGE', payload: id });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const clearCategory = useCallback((category: string) => {
    dispatch({ type: 'CLEAR_CATEGORY', payload: category });
  }, []);

  const showSuccess = useCallback((title: string, message = '', actions?: FeedbackAction[]) => {
    return showMessage({
      type: 'success',
      title,
      message,
      actions,
      duration: 4000,
      severity: 'low',
    });
  }, [showMessage]);

  const showError = useCallback((title: string, message = '', error?: Error, actions?: FeedbackAction[]) => {
    const errorDetails = error ? `${error.message}\n${error.stack}` : undefined;
    const isNetworkError = error?.message.toLowerCase().includes('network') || 
                          error?.message.toLowerCase().includes('fetch');
    
    return showMessage({
      type: 'error',
      title,
      message: message || 'An unexpected error occurred',
      details: errorDetails,
      actions: actions || (isNetworkError ? [
        {
          label: 'Retry',
          action: () => window.location.reload(),
          variant: 'default',
        }
      ] : []),
      persistent: true,
      severity: isNetworkError ? 'high' : 'medium',
      category: 'error',
    });
  }, [showMessage]);

  const showWarning = useCallback((title: string, message = '', actions?: FeedbackAction[]) => {
    return showMessage({
      type: 'warning',
      title,
      message,
      actions,
      duration: 6000,
      severity: 'medium',
    });
  }, [showMessage]);

  const showInfo = useCallback((title: string, message = '', actions?: FeedbackAction[]) => {
    return showMessage({
      type: 'info',
      title,
      message,
      actions,
      duration: 5000,
      severity: 'low',
    });
  }, [showMessage]);

  const showLoading = useCallback((title: string, message = '') => {
    return showMessage({
      type: 'loading',
      title,
      message,
      persistent: true,
      canDismiss: false,
      category: 'loading',
    });
  }, [showMessage]);

  const showProgress = useCallback((title: string, progress: number, message = '') => {
    return showMessage({
      type: 'progress',
      title,
      message,
      progress,
      persistent: true,
      canDismiss: false,
      category: 'progress',
    });
  }, [showMessage]);

  const setGlobalLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_GLOBAL_LOADING', payload: loading });
  }, []);

  const handleNetworkError = useCallback((error: Error) => {
    const isOffline = state.networkStatus === 'offline';
    const isSlow = state.networkStatus === 'slow';

    if (isOffline) {
      showError(
        'No Internet Connection',
        'Please check your internet connection and try again.',
        error,
        [
          {
            label: 'Retry',
            action: () => window.location.reload(),
            variant: 'default',
          }
        ]
      );
    } else if (isSlow) {
      showWarning(
        'Slow Connection',
        'Your internet connection appears to be slow. Some features may be limited.',
        [
          {
            label: 'Continue Anyway',
            action: () => clearCategory('network'),
            variant: 'outline',
          }
        ]
      );
    } else {
      showError(
        'Network Error',
        'Failed to connect to the server. Please try again.',
        error
      );
    }
  }, [state.networkStatus, showError, showWarning, clearCategory]);

  const handleAsyncOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    options: {
      loadingMessage?: string;
      successMessage?: string;
      errorMessage?: string;
      onSuccess?: (result: T) => void;
      onError?: (error: Error) => void;
    } = {}
  ): Promise<T> => {
    const {
      loadingMessage = 'Processing...',
      successMessage,
      errorMessage = 'Operation failed',
      onSuccess,
      onError,
    } = options;

    const loadingId = showLoading('Processing', loadingMessage);

    try {
      const result = await operation();
      
      removeMessage(loadingId);
      
      if (successMessage) {
        showSuccess('Success', successMessage);
      }
      
      onSuccess?.(result);
      return result;
    } catch (error) {
      removeMessage(loadingId);
      
      const err = error instanceof Error ? error : new Error('Unknown error');
      showError('Error', errorMessage, err);
      
      onError?.(err);
      throw error;
    }
  }, [showLoading, removeMessage, showSuccess, showError]);

  const contextValue: FeedbackContextType = {
    state,
    showMessage,
    updateMessage,
    removeMessage,
    clearAll,
    clearCategory,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading,
    showProgress,
    setGlobalLoading,
    handleNetworkError,
    handleAsyncOperation,
  };

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}
      <FeedbackDisplay />
    </FeedbackContext.Provider>
  );
}

// Component to display feedback messages
function FeedbackDisplay() {
  const context = useContext(FeedbackContext);
  if (!context) return null;

  const { state, removeMessage, updateMessage } = context;
  const { messages, networkStatus } = state;

  const getIcon = (type: FeedbackType) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'info': return <Info className="h-4 w-4 text-blue-600" />;
      case 'loading': return <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      case 'progress': return <Info className="h-4 w-4 text-blue-600" />;
      default: return null;
    }
  };

  const getAlertVariant = (type: FeedbackType) => {
    switch (type) {
      case 'error': return 'destructive';
      case 'warning': return 'default';
      default: return 'default';
    }
  };

  // Show network status indicator
  const showNetworkIndicator = networkStatus !== 'online';

  if (messages.length === 0 && !showNetworkIndicator) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {/* Network Status Indicator */}
      {showNetworkIndicator && (
        <Alert variant={networkStatus === 'offline' ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {networkStatus === 'offline' ? 'Offline' : 'Slow Connection'}
          </AlertTitle>
          <AlertDescription>
            {networkStatus === 'offline' 
              ? 'You are currently offline. Some features may not work.'
              : 'Your connection is slow. Some operations may take longer.'
            }
          </AlertDescription>
        </Alert>
      )}

      {/* Feedback Messages */}
      {messages.map((message) => (
        <Card key={message.id} className="shadow-lg border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                {getIcon(message.type)}
                <CardTitle className="text-sm font-medium">
                  {message.title}
                </CardTitle>
              </div>
              {message.canDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMessage(message.id)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          
          {(message.message || message.progress !== undefined) && (
            <CardContent className="pt-0">
              {message.message && (
                <p className="text-sm text-gray-600 mb-2">{message.message}</p>
              )}
              
              {message.type === 'progress' && message.progress !== undefined && (
                <div className="space-y-1">
                  <Progress value={message.progress} className="h-2" />
                  <p className="text-xs text-gray-500">{message.progress}% complete</p>
                </div>
              )}
              
              {message.actions && message.actions.length > 0 && (
                <div className="flex space-x-2 mt-3">
                  {message.actions.map((action, index) => (
                    <Button
                      key={index}
                      variant={action.variant || 'default'}
                      size="sm"
                      onClick={action.action}
                      disabled={action.loading}
                    >
                      {action.loading && (
                        <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                      )}
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

export function useEnhancedFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useEnhancedFeedback must be used within an EnhancedFeedbackProvider');
  }
  return context;
}

export default EnhancedFeedbackProvider;