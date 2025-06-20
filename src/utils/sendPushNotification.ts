interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export async function sendPushNotification(payload: PushNotificationPayload) {
  try {
    const response = await fetch("/api/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Failed to send push notification");
    }

    return await response.json();
  } catch (error) {
    console.error("Error sending push notification:", error);
    throw error;
  }
}
