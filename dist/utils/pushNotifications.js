function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
export async function subscribeToPushNotifications() {
    try {
        console.log('Starting push notification subscription process...');
        const registration = await navigator.serviceWorker.ready;
        console.log('Service Worker is ready:', registration);
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        console.log('VAPID Public Key available:', !!vapidPublicKey);
        if (!vapidPublicKey) {
            throw new Error('VAPID public key not found');
        }
        // Check for existing subscription
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
            console.log('Found existing subscription');
            return existingSubscription;
        }
        console.log('Subscribing to push notifications...');
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
        console.log('Push subscription created:', subscription);
        // Send subscription to the server
        console.log('Sending subscription to server...');
        const response = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(subscription),
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response error:', errorText);
            throw new Error('Failed to save subscription');
        }
        console.log('Subscription saved successfully');
        return subscription;
    }
    catch (error) {
        console.error('Error in subscribeToPushNotifications:', error);
        throw error;
    }
}
export async function unsubscribeFromPushNotifications() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            console.log('No subscription found to unsubscribe');
            return true; // No subscription to remove, so technically a success
        }
        // Send unsubscribe request to server
        const response = await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(subscription),
        });
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server failed to unsubscribe:', errorData);
            throw new Error(errorData.error || 'Failed to unsubscribe on server');
        }
        // Even if server unsubscription failed, try to unsubscribe locally
        try {
            await subscription.unsubscribe();
            console.log('Successfully unsubscribed from push notifications');
        }
        catch (error) {
            console.warn('Failed to unsubscribe locally, but server unsubscription was successful:', error);
            // Don't throw here, as server unsubscription succeeded
        }
        return true;
    }
    catch (error) {
        console.error('Error unsubscribing from push notifications:', error);
        throw error;
    }
}
export async function checkSubscription() {
    try {
        // First, check if the necessary APIs are available
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return false;
        }
        // Check if service worker is ready
        const registration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise(resolve => setTimeout(() => resolve(null), 3000)) // 3 second timeout
        ]);
        if (!registration) {
            console.warn('Service worker not ready after timeout');
            return false;
        }
        // Get subscription (we know it's a ServiceWorkerRegistration if not null)
        const subscription = await registration.pushManager.getSubscription();
        return !!subscription;
    }
    catch (error) {
        console.error('Error checking subscription status:', error);
        return false;
    }
}
export async function requestNotificationPermission() {
    try {
        console.log('Requesting notification permission...');
        const permission = await Notification.requestPermission();
        console.log('Notification permission result:', permission);
        if (permission === 'granted') {
            console.log('Permission granted, proceeding with subscription...');
            return await subscribeToPushNotifications();
        }
        console.log('Permission not granted');
        return null;
    }
    catch (error) {
        console.error('Error in requestNotificationPermission:', error);
        throw error;
    }
}
