import * as Notifications from 'expo-notifications';

export async function setupPushNotifications() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    throw new Error('Failed to get push notification permissions');
  }

  console.log('Push notifications setup successfully');
}

export async function sendPushNotification(expoPushToken: string, message: string) {
  const messagePayload = {
    to: expoPushToken,
    sound: 'default',
    title: 'Notification',
    body: message,
    data: { message },
  };

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messagePayload),
  });

  console.log('Push notification sent successfully');
}
