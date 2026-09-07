import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useAppStore } from './store';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    const isRetrievalScreen = data?.screen === 'retrievals';
    const isDriverContext = !!useAppStore.getState().driver;
    // Drivers already get an in-app modal (vibration + sound) for retrieval requests
    // via the WebSocket, driven from useIncomingRequests.js — suppress the redundant
    // OS banner/sound for them so it doesn't double-alert. Supervisors have no
    // equivalent in-app alert, so their banner/sound stays on.
    const suppress = isRetrievalScreen && isDriverContext;
    return {
      shouldShowBanner: !suppress,
      shouldShowList: true,
      shouldPlaySound: !suppress,
      shouldSetBadge: true,
    };
  },
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
    let token;
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        token = await Notifications.getExpoPushTokenAsync({ projectId });
        break;
      } catch (e) {
        lastErr = e;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    if (!token) throw lastErr;
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
