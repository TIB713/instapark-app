import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(api) {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('[PUSH] Registered push token:', token.data?.substring(0, 40) + '...');
    try { await api.post('/drivers/push-token', { push_token: token.data }); return token.data; } catch {}
    try { await api.post('/providers/push-token', { push_token: token.data }); return token.data; } catch {}
    try { await api.post('/supervisors/push-token', { push_token: token.data }); return token.data; } catch {}
    return token.data;
  } catch (e) {
    console.warn('Push registration failed:', e);
    return null;
  }
}
