import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/src/context/AuthContext';
import { ProfileProvider } from '@/src/context/ProfileContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#0f0f0f' },
            headerTintColor: '#fff',
            contentStyle: { backgroundColor: '#0f0f0f' },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="CreatePost" options={{ headerShown: false }} />
          <Stack.Screen name="PostDetail" options={{ headerShown: false }} />
          <Stack.Screen name="Chat" options={{ headerShown: false }} />
          <Stack.Screen name="ViewProfile" options={{ headerShown: false }} />
          <Stack.Screen name="Filters" options={{ headerShown: false }} />
          <Stack.Screen name="Settings" options={{ headerShown: false }} />
          <Stack.Screen name="Paywall" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="light" />
      </ProfileProvider>
    </AuthProvider>
  );
}
