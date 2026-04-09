import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Dashni',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ff6b6b',
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // Save token to Supabase
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('profiles').update({ push_token: token }).eq('id', user.id);
  }

  return token;
}

export function sendLocalNotification(title, body, data = {}) {
  Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: null,
  });
}

export function useNotificationListener(navigation) {
  Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    if (data.type === 'message' && navigation) {
      navigation.navigate('Chat', {
        name: data.name,
        initials: data.initials,
        bgColor: data.bgColor || '#14102a',
        accentColor: data.accentColor || '#ff6b6b',
        userId: data.userId,
      });
    } else if (data.type === 'match' && navigation) {
      navigation.navigate('Matches');
    }
  });
}
