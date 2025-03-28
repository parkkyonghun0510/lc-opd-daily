export async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered with scope:', registration.scope);
            return registration;
        }
        catch (error) {
            console.error('Service Worker registration failed:', error);
            throw error;
        }
    }
    else {
        console.log('Service Worker is not supported in this browser');
        return null;
    }
}
