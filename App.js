import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RootNavigator from './src/navigation/RootNavigator';

// ⚠️ BEFORE APP STORE SUBMISSION:
// Replace this with your RevenueCat PRODUCTION iOS key.
// RevenueCat Dashboard → Apps → (your iOS app) → Public SDK key
// The production key starts with "appl_" not "test_"
const RC_IOS_KEY = 'appl_mrlcuHBIFeclGrBqSifQyHQFNMp';
if (!__DEV__ && RC_IOS_KEY.startsWith('test_')) {
  throw new Error('SUBMISSION BLOCKED: Replace RC_IOS_KEY with your production RevenueCat key before submitting to the App Store.');
}

export default function App() {
  useEffect(() => {
    try {
      if (Platform.OS === 'ios') {
        if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        Purchases.configure({ apiKey: RC_IOS_KEY });
      }
    } catch (e) {
      console.warn('RevenueCat init failed:', e.message);
    }
  }, []);

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
