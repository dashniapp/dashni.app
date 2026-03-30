import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Image, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme';

const { width: W, height: H } = Dimensions.get('window');

const FEATURES = [
  { icon: 'eye', label: 'See everyone who liked you' },
  { icon: 'infinite', label: 'Unlimited swipes' },
  { icon: 'star', label: '5 Super likes per day' },
  { icon: 'trending-up', label: 'Daily profile boost' },
  { icon: 'refresh', label: 'Rewind last swipe' },
  { icon: 'shield-checkmark', label: 'Priority in discovery' },
];

const BLURRED_COLORS = [
  ['#3a0a2e', '#1a0a3e'],
  ['#0a2a3e', '#0a1a2e'],
  ['#2e1a0a', '#3e0a1a'],
  ['#0a3e2a', '#0a1e3e'],
  ['#3e2a0a', '#1e0a3e'],
];

export default function PaywallScreen({ navigation }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1200, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.safe}>
      <LinearGradient colors={['#1a0010', '#08080f']} style={StyleSheet.absoluteFill} />

      <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          <View style={styles.logoPill}>
            <Image source={require('../../assets/icon.png')} style={styles.logoImg} />
            <Text style={styles.logoText}>Dashni Gold</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}

      >
        {/* Blurred photos strip */}
        <View style={styles.photosStrip}>
          {BLURRED_COLORS.map((cols, i) => (
            <View key={i} style={[styles.photoThumb, i === 2 && styles.photoThumbCenter]}>
              <LinearGradient colors={cols} style={StyleSheet.absoluteFill} />
              <View style={styles.initCircle}>
                <Feather name={i === 2 ? 'heart' : 'lock'} size={i === 2 ? 20 : 14} color={i === 2 ? '#ff6b6b' : 'rgba(255,255,255,0.5)'} />
              </View>
              {i !== 2 && <View style={styles.photoBlur} />}
            </View>
          ))}
        </View>

        {/* Hero text */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>You have new likes!</Text>
          <Text style={styles.heroSub}>Upgrade to see exactly who liked you and match instantly</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresCard}>
          {FEATURES.map((f, i) => (
            <View key={i} style={[styles.featureRow, i < FEATURES.length - 1 && styles.featureRowBorder]}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={f.icon} size={16} color={colors.accent} />
              </View>
              <Text style={styles.featureLabel}>{f.label}</Text>
              <Ionicons name="checkmark-circle" size={18} color="#4caf50" />
            </View>
          ))}
        </View>

        {/* Coming soon banner */}
        <Animated.View style={[styles.ctaWrap, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient
            colors={['#e91e8c', '#ff6b6b', '#ff9a3c']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.ctaBtn, { opacity: 0.85 }]}
          >
            <Ionicons name="star" size={18} color="#fff" />
            <Text style={styles.ctaBtnText}>Dashni Gold — Coming Soon</Text>
          </LinearGradient>
        </Animated.View>

        <Text style={styles.terms}>Premium features launching soon · You'll be notified</Text>

        <View style={{ height: 50 }} />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingTop: 100 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  logoPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,107,107,0.15)', borderWidth: 1, borderColor: colors.accentBorder, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 14 },
  logoImg: { width: 22, height: 22, borderRadius: 6 },
  logoText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  photosStrip: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 24, paddingHorizontal: 20 },
  photoThumb: { width: 64, height: 80, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  photoThumbCenter: { width: 80, height: 100, borderRadius: 16, borderWidth: 2.5, borderColor: colors.accent },
  photoBlur: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,8,16,0.7)' },
  initCircle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoLock: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  heroSection: { alignItems: 'center', paddingHorizontal: 24, marginBottom: 24, gap: 8 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.55)', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  featuresCard: { marginHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16, overflow: 'hidden' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  featureRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  featureIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accentBorder, alignItems: 'center', justifyContent: 'center' },
  featureLabel: { color: '#fff', fontSize: 14, flex: 1 },
  ctaWrap: { marginHorizontal: 16, borderRadius: radius.full, overflow: 'hidden', marginBottom: 20 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17, borderRadius: radius.full },
  ctaBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  terms: { color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', marginTop: 12 },
});
