import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RootNavigator from './src/navigation/RootNavigator';

const RC_IOS_KEY = 'appl_mrlcuHBIFeclGrBqSifQyHQFNMp';
if (!__DEV__ && RC_IOS_KEY.startsWith('test_')) {
  throw new Error('SUBMISSION BLOCKED: Replace RC_IOS_KEY with your production RevenueCat key before submitting to the App Store.');
}

// Configure RevenueCat immediately at module load — before any component renders
// so Purchases.getOfferings() never runs before configure() finishes.
if (Platform.OS === 'ios') {
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: RC_IOS_KEY });
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat init failed:', e.message);
  }
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080810' },
});
