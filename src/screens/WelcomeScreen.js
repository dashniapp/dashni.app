import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme';

const { height } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#e91e8c', '#ff6b6b', '#ff9a3c']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Dark overlay */}
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safe}>
        {/* Logo */}
        <View style={styles.logoArea}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
          <Text style={styles.appName}>Dashni</Text>
          <Text style={styles.tagline}>Albanian Dating App</Text>
        </View>

        {/* Buttons */}
        <View style={styles.btnArea}>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => navigation.navigate('Signup')}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText}>Create account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <Text style={styles.btnSecondaryText}>Log in</Text>
          </TouchableOpacity>

          <Text style={styles.terms}>
            By continuing you agree to our{' '}
            <Text style={styles.termsLink} onPress={() => navigation.navigate('Legal', { type: 'terms' })}>Terms</Text>
            {' '}and{' '}
            <Text style={styles.termsLink} onPress={() => navigation.navigate('Legal', { type: 'privacy' })}>Privacy Policy</Text>
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,16,0.55)',
  },
  safe: { flex: 1, justifyContent: 'space-between', padding: 28 },
  logoArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  logoImg: { width: 120, height: 120, borderRadius: 28 },
  appName: {
    color: '#fff',
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  tagline: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    letterSpacing: 1,
  },
  btnArea: { gap: 12 },
  btnPrimary: {
    backgroundColor: '#fff',
    borderRadius: radius.full,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#e91e8c', fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: radius.full,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnSecondaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  terms: { color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  termsLink: { color: 'rgba(255,255,255,0.75)', textDecorationLine: 'underline' },
});
