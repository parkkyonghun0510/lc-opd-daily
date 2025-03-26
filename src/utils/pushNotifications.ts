function urlBase64ToUint8Array(base64String: string) {
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
  } catch (error) {
    console.error('Error in subscribeToPushNotifications:', error);
    throw error;
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
  } catch (error) {
    console.error('Error in requestNotificationPermission:', error);
    throw error;
  }
} 