'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from './ThemeProvider';
import { OfflineProvider } from './OfflineProvider';
import { Toaster } from '@/components/ui/toaster';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider>
                <OfflineProvider>
                    {children}
                    <Toaster />
                </OfflineProvider>
            </ThemeProvider>
        </SessionProvider>
    );
}