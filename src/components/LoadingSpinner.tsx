import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface LoadingSpinnerProps {
    message?: string;
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
    return (
        <Card>
            <CardContent className="flex items-center justify-center p-8">
                <div className="flex flex-col items-center space-y-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">{message}</p>
                </div>
            </CardContent>
        </Card>
    );
}