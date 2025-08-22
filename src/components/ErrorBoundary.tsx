import React from 'react';
import { AlertCircle, RefreshCw, Home, Bug } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppError, ErrorSeverity, NetworkErrorCode } from '@/types/errors';
import { handleError } from '@/lib/errors/error-handler';
import { createNetworkError } from '@/lib/errors/error-classes';

interface Props {
    children: React.ReactNode;
    fallback?: React.ComponentType<ErrorBoundaryFallbackProps>;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    level?: 'page' | 'section' | 'component';
    enableRetry?: boolean;
    maxRetries?: number;
    resetOnPropsChange?: boolean;
    resetKeys?: Array<string | number>;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
    retryCount: number;
    errorId: string;
}

export interface ErrorBoundaryFallbackProps {
    error: Error;
    errorInfo: React.ErrorInfo | null;
    resetError: () => void;
    retryCount: number;
    level: 'page' | 'section' | 'component';
    onRetry?: () => void;
    maxRetries?: number;
}

export class ErrorBoundary extends React.Component<Props, State> {
    private resetTimeoutId: number | null = null;

    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            retryCount: 0,
            errorId: ''
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return {
            hasError: true,
            error,
            errorId
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({ errorInfo });
        
        // Handle error through our centralized error handler
        const appError = createNetworkError(
            NetworkErrorCode.NETWORK_ERROR,
            `Component error in ${this.props.level || 'unknown'} level`,
            {
                originalError: error,
                componentStack: errorInfo.componentStack,
                retryable: this.props.enableRetry !== false,
                severity: this.getSeverityFromLevel(this.props.level || 'component')
            }
        );

        handleError(appError, {
            userId: 'unknown',
            sessionId: 'unknown',
            timestamp: new Date(),
            additionalData: {
                component: 'ErrorBoundary',
                level: this.props.level || 'component',
                retryCount: this.state.retryCount,
                errorId: this.state.errorId
            }
        });

        // Call custom error handler if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    componentDidUpdate(prevProps: Props) {
        const { resetKeys, resetOnPropsChange } = this.props;
        const { hasError } = this.state;
        
        if (hasError && prevProps.resetKeys !== resetKeys) {
            if (resetKeys?.some((key, idx) => prevProps.resetKeys?.[idx] !== key)) {
                this.resetError();
            }
        }
        
        if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
            this.resetError();
        }
    }

    componentWillUnmount() {
        if (this.resetTimeoutId) {
            clearTimeout(this.resetTimeoutId);
        }
    }

    private getSeverityFromLevel(level: string): ErrorSeverity {
        switch (level) {
            case 'page': return ErrorSeverity.HIGH;
            case 'section': return ErrorSeverity.MEDIUM;
            case 'component': return ErrorSeverity.LOW;
            default: return ErrorSeverity.MEDIUM;
        }
    }

    private resetError = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            retryCount: 0,
            errorId: ''
        });
    };

    private handleRetry = () => {
        const { maxRetries = 3 } = this.props;
        const { retryCount } = this.state;
        
        if (retryCount < maxRetries) {
            this.setState(prevState => ({
                hasError: false,
                error: null,
                errorInfo: null,
                retryCount: prevState.retryCount + 1
            }));
        }
    };

    private handleReload = () => {
        window.location.reload();
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            const { fallback: Fallback, level = 'component', enableRetry = true, maxRetries = 3 } = this.props;
            const { error, errorInfo, retryCount } = this.state;
            
            if (Fallback) {
                return (
                    <Fallback
                        error={error!}
                        errorInfo={errorInfo}
                        resetError={this.resetError}
                        retryCount={retryCount}
                        level={level}
                    />
                );
            }
            
            return <DefaultErrorFallback
                error={error!}
                errorInfo={errorInfo}
                resetError={this.resetError}
                retryCount={retryCount}
                level={level}
                onRetry={this.handleRetry}
                onReload={this.handleReload}
                onGoHome={this.handleGoHome}
                enableRetry={enableRetry}
                maxRetries={maxRetries}
            />;
        }

        return this.props.children;
    }
}

// Default Error Fallback Components
interface DefaultErrorFallbackProps extends ErrorBoundaryFallbackProps {
    onRetry: () => void;
    onReload: () => void;
    onGoHome: () => void;
    enableRetry: boolean;
    maxRetries: number;
}

function DefaultErrorFallback({
    error,
    errorInfo,
    resetError,
    retryCount,
    level,
    onRetry,
    onReload,
    onGoHome,
    enableRetry,
    maxRetries
}: DefaultErrorFallbackProps) {
    const canRetry = enableRetry && retryCount < maxRetries;
    
    if (level === 'page') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <CardTitle className="text-xl font-semibold text-gray-900">
                            Page Error
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <p className="text-gray-600">
                            {error.message || 'An unexpected error occurred while loading this page.'}
                        </p>
                        {retryCount > 0 && (
                            <p className="text-sm text-gray-500">
                                Retry attempt: {retryCount}/{maxRetries}
                            </p>
                        )}
                        <div className="flex flex-col sm:flex-row gap-2 justify-center">
                            {canRetry && (
                                <Button onClick={onRetry} className="flex items-center gap-2">
                                    <RefreshCw className="w-4 h-4" />
                                    Try Again
                                </Button>
                            )}
                            <Button variant="outline" onClick={onGoHome} className="flex items-center gap-2">
                                <Home className="w-4 h-4" />
                                Go Home
                            </Button>
                            <Button variant="outline" onClick={onReload} className="flex items-center gap-2">
                                <RefreshCw className="w-4 h-4" />
                                Reload Page
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    if (level === 'section') {
        return (
            <Card className="border-red-200 bg-red-50">
                <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="font-medium text-red-900 mb-1">Section Error</h3>
                            <p className="text-sm text-red-700 mb-3">
                                {error.message || 'This section encountered an error.'}
                            </p>
                            {retryCount > 0 && (
                                <p className="text-xs text-red-600 mb-3">
                                    Retry attempt: {retryCount}/{maxRetries}
                                </p>
                            )}
                            <div className="flex gap-2">
                                {canRetry && (
                                    <Button size="sm" onClick={onRetry} className="flex items-center gap-1">
                                        <RefreshCw className="w-3 h-3" />
                                        Retry
                                    </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={resetError}>
                                    Dismiss
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    // Component level error
    return (
        <Alert variant="destructive" className="my-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Component Error</AlertTitle>
            <AlertDescription className="mt-2">
                <p className="mb-2 text-sm">
                    {error.message || 'This component encountered an error.'}
                </p>
                {retryCount > 0 && (
                    <p className="text-xs text-gray-600 mb-2">
                        Retry attempt: {retryCount}/{maxRetries}
                    </p>
                )}
                <div className="flex gap-2">
                    {canRetry && (
                        <Button size="sm" variant="outline" onClick={onRetry} className="flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            Retry
                        </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={resetError}>
                        Dismiss
                    </Button>
                </div>
            </AlertDescription>
        </Alert>
    );
}

// Specialized Error Boundaries
export function AuthErrorBoundary({ children }: { children: React.ReactNode }) {
    return (
        <ErrorBoundary
            level="section"
            enableRetry={true}
            maxRetries={2}
            fallback={({ error, resetError }) => (
                <Alert variant="destructive" className="my-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Authentication Error</AlertTitle>
                    <AlertDescription className="mt-2">
                        <p className="mb-2">
                            {error.message || 'Authentication failed. Please try again.'}
                        </p>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={resetError}>
                                Try Again
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => window.location.href = '/login'}>
                                Go to Login
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            )}
        >
            {children}
        </ErrorBoundary>
    );
}

export function FormErrorBoundary({ children }: { children: React.ReactNode }) {
    return (
        <ErrorBoundary
            level="component"
            enableRetry={true}
            maxRetries={3}
            fallback={({ error, resetError }) => (
                <Alert variant="destructive" className="my-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Form Error</AlertTitle>
                    <AlertDescription className="mt-2">
                        <p className="mb-2 text-sm">
                            {error.message || 'Form submission failed. Please check your input and try again.'}
                        </p>
                        <Button size="sm" variant="outline" onClick={resetError}>
                            Reset Form
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
        >
            {children}
        </ErrorBoundary>
    );
}

export function ApiErrorBoundary({ children }: { children: React.ReactNode }) {
    return (
        <ErrorBoundary
            level="section"
            enableRetry={true}
            maxRetries={3}
            fallback={({ error, resetError }) => (
                <Alert variant="destructive" className="my-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>API Error</AlertTitle>
                    <AlertDescription className="mt-2">
                        <p className="mb-2">
                            {error.message || 'Failed to load data. Please check your connection and try again.'}
                        </p>
                        {retryCount > 0 && (
                            <p className="text-xs text-gray-600 mb-2">
                                Retry attempt: {retryCount}/{maxRetries}
                            </p>
                        )}
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={resetError}>
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Retry
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                                Refresh Page
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            )}
        >
            {children}
        </ErrorBoundary>
    );
}