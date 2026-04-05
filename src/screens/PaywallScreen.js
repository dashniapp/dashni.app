import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, Dimensions, Image, Animated, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Purchases from 'react-native-purchases';
import { colors, radius } from '../theme';

const { width: W, height: H } = Dimensions.get('window');

const FEATURES = [
  { icon: 'heart',         label: 'See who liked you',      sub: 'Know exactly who wants to match' },
  { icon: 'infinite',      label: 'Unlimited swipes',        sub: 'Never run out of likes again' },
  { icon: 'star',          label: 'Profile boost',           sub: 'Get 10x more views today' },
  { icon: 'flash',         label: 'Priority in discovery',   sub: 'Be seen before everyone else' },
  { icon: 'refresh',       label: 'Rewind last swipe',       sub: 'Changed your mind? Go back' },
];

const PACKAGE_META = {
  '$rc_weekly':      { label: 'Weekly',   period: '/ week',  popular: false },
  '$rc_monthly':     { label: 'Monthly',  period: '/ month', popular: true  },
  '$rc_two_month':   { label: '2 Months', period: '/ 2 mo',  popular: false },
  '$rc_three_month': { label: '3 Months', period: '/ 3 mo',  popular: false },
};

export default function PaywallScreen({ navigation }) {
  const [packages, setPackages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadOfferings();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadOfferings = async () => {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current?.availablePackages.length > 0) {
        const pkgs = offerings.current.availablePackages;
        setPackages(pkgs);
        const monthly = pkgs.find(p => p.identifier === '$rc_monthly');
        setSelected(monthly ? monthly.identifier : pkgs[0].identifier);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not load plans. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    const pkg = packages.find(p => p.identifier === selected);
    if (!pkg) return;
    setPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      if (customerInfo.entitlements.active['premium']) {
        Alert.alert('Welcome to Dashni Premium!', 'You now have full access.', [
          { text: "Let's go!", onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e) {
      if (!e.userCancelled) Alert.alert('Purchase failed', e.message);
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active['premium']) {
        Alert.alert('Restored!', 'Your premium is back.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Nothing to restore', 'No previous purchases found.');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const selectedPkg = packages.find(p => p.identifier === selected);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0d0014', '#0a000f', '#080810']} style={StyleSheet.absoluteFill} />

      {/* Close button */}
      <SafeAreaView edges={['top']} style={styles.closeWrap}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Feather name="x" size={18} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Hero */}
          <View style={styles.hero}>
            <LinearGradient
              colors={['#e91e8c', '#ff6b35']}
              style={styles.crownWrap}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Ionicons name="star" size={32} color="#fff" />
            </LinearGradient>
            <Text style={styles.heroTitle}>Dashni Premium</Text>
            <Text style={styles.heroSub}>Unlock everything. Match faster.</Text>
          </View>

          {/* Features */}
          <View style={styles.featuresWrap}>
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <LinearGradient colors={['#e91e8c22', '#ff6b3511']} style={styles.featureIconWrap}>
                  <Ionicons name={f.icon} size={18} color="#e91e8c" />
                </LinearGradient>
                <View style={styles.featureText}>
                  <Text style={styles.featureLabel}>{f.label}</Text>
                  <Text style={styles.featureSub}>{f.sub}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
              </View>
            ))}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Plans */}
          {loading ? (
            <ActivityIndicator color="#e91e8c" size="large" style={{ marginVertical: 30 }} />
          ) : (
            <View style={styles.plansWrap}>
              {packages.map((pkg) => {
                const meta = PACKAGE_META[pkg.identifier] || { label: pkg.identifier, period: '', popular: false };
                const isSelected = selected === pkg.identifier;
                return (
                  <TouchableOpacity
                    key={pkg.identifier}
                    style={[styles.planCard, isSelected && styles.planCardSelected]}
                    onPress={() => setSelected(pkg.identifier)}
                    activeOpacity={0.8}
                  >
                    {meta.popular && (
                      <LinearGradient
                        colors={['#e91e8c', '#ff6b35']}
                        style={styles.popularBadge}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      >
                        <Text style={styles.popularText}>BEST VALUE</Text>
                      </LinearGradient>
                    )}
                    <View style={styles.planLeft}>
                      <View style={[styles.radio, isSelected && styles.radioSelected]}>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                      <Text style={[styles.planLabel, isSelected && styles.planLabelSelected]}>
                        {meta.label}
                      </Text>
                    </View>
                    <View style={styles.planRight}>
                      <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
                        {pkg.product.priceString}
                      </Text>
                      <Text style={styles.planPeriod}>{meta.period}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* CTA */}
          <TouchableOpacity
            style={styles.ctaWrap}
            onPress={handleSubscribe}
            activeOpacity={0.9}
            disabled={purchasing || loading}
          >
            <LinearGradient
              colors={['#e91e8c', '#ff5f40', '#ff9a3c']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.ctaBtn}
            >
              {purchasing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>
                  {selectedPkg ? `Start for ${selectedPkg.product.priceString}` : 'Get Premium'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.terms}>
            Renews automatically · Cancel anytime in App Store
          </Text>

          <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
            <Text style={styles.restoreText}>Restore purchases</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16, paddingTop: 8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: 80, paddingHorizontal: 20 },

  // Hero
  hero: { alignItems: 'center', paddingVertical: 28, gap: 12 },
  crownWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4, shadowColor: '#e91e8c', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  heroTitle: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.5)', fontSize: 16, textAlign: 'center' },

  // Features
  featuresWrap: { gap: 4, marginBottom: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 4 },
  featureIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1 },
  featureLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  featureSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 },

  // Divider
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 24 },

  // Plans
  plansWrap: { gap: 10, marginBottom: 24 },
  planCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', padding: 18, position: 'relative', overflow: 'hidden' },
  planCardSelected: { backgroundColor: 'rgba(233,30,140,0.08)', borderColor: '#e91e8c' },
  popularBadge: { position: 'absolute', top: 0, right: 0, paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: 12 },
  popularText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  planLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#e91e8c' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e91e8c' },
  planLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: '600' },
  planLabelSelected: { color: '#fff' },
  planRight: { alignItems: 'flex-end' },
  planPrice: { color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: '800' },
  planPriceSelected: { color: '#e91e8c' },
  planPeriod: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 2 },

  // CTA
  ctaWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 14, shadowColor: '#e91e8c', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10 },
  ctaBtn: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },

  // Footer
  terms: { color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', marginBottom: 10 },
  restoreBtn: { alignItems: 'center', paddingVertical: 8 },
  restoreText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, textDecorationLine: 'underline' },
});
