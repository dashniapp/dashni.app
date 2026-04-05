import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, Dimensions, Animated, ActivityIndicator,
  ScrollView, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Purchases from 'react-native-purchases';
import { colors, radius } from '../theme';

const { width: W } = Dimensions.get('window');

const FEATURES = [
  { icon: 'heart',     label: 'See who liked you',    sub: 'Know exactly who wants to match' },
  { icon: 'infinite',  label: 'Unlimited swipes',      sub: 'Never run out of likes again' },
  { icon: 'star',      label: 'Profile boost',         sub: 'Get 10x more views today' },
  { icon: 'flash',     label: 'Priority discovery',    sub: 'Be seen before everyone else' },
  { icon: 'refresh',   label: 'Rewind last swipe',     sub: 'Changed your mind? Go back' },
];

const PACKAGE_META = {
  '$rc_weekly':      { label: 'Weekly',   period: 'per week'  },
  '$rc_monthly':     { label: 'Monthly',  period: 'per month', popular: true },
  '$rc_two_month':   { label: '2 Months', period: 'every 2 months' },
  '$rc_three_month': { label: '3 Months', period: 'every 3 months' },
};

export default function PaywallScreen({ navigation }) {
  const [packages, setPackages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadOfferings();
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const loadOfferings = async () => {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current?.availablePackages.length > 0) {
        const pkgs = offerings.current.availablePackages;
        setPackages(pkgs);
        const monthly = pkgs.find(p => p.identifier === '$rc_monthly');
        const defaultPkg = monthly || pkgs[0];
        setSelected(defaultPkg.identifier);
        // Scroll to selected plan after a short delay
        const idx = pkgs.indexOf(defaultPkg);
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
        }, 300);
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

  const renderPlanCard = ({ item: pkg }) => {
    const meta = PACKAGE_META[pkg.identifier] || { label: pkg.identifier, period: '' };
    const isSelected = selected === pkg.identifier;
    return (
      <TouchableOpacity
        style={[styles.planCard, isSelected && styles.planCardSelected]}
        onPress={() => setSelected(pkg.identifier)}
        activeOpacity={0.85}
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
        <Text style={[styles.planLabel, isSelected && styles.planLabelSelected]}>
          {meta.label}
        </Text>
        <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
          {pkg.product.priceString}
        </Text>
        <Text style={styles.planPeriod}>{meta.period}</Text>
        {isSelected && (
          <View style={styles.planCheck}>
            <Ionicons name="checkmark-circle" size={20} color="#e91e8c" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0d0014', '#0a000f', '#080810']} style={StyleSheet.absoluteFill} />

      {/* Close button */}
      <SafeAreaView edges={['top']} style={styles.closeWrap}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Feather name="x" size={18} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </SafeAreaView>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>

        {/* Scrollable top content */}
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
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

          {/* Plans - horizontal swipeable */}
          <Text style={styles.sectionLabel}>Choose your plan</Text>
          {loading ? (
            <ActivityIndicator color="#e91e8c" size="large" style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              ref={flatListRef}
              data={packages}
              keyExtractor={pkg => pkg.identifier}
              renderItem={renderPlanCard}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.plansList}
              snapToAlignment="center"
              decelerationRate="fast"
              snapToInterval={W * 0.52}
              onScrollToIndexFailed={() => {}}
            />
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Features */}
          <Text style={styles.sectionLabel}>Everything included</Text>
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

          <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
            <Text style={styles.restoreText}>Restore purchases</Text>
          </TouchableOpacity>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Fixed bottom CTA */}
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
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
                  {selectedPkg ? `Continue — ${selectedPkg.product.priceString}` : 'Continue'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.terms}>Renews automatically · Cancel anytime in App Store</Text>
        </SafeAreaView>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  closeWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16, paddingTop: 8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: 80 },

  // Hero
  hero: { alignItems: 'center', paddingVertical: 24, gap: 10, paddingHorizontal: 20 },
  crownWrap: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', marginBottom: 4, shadowColor: '#e91e8c', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.45)', fontSize: 15, textAlign: 'center' },

  // Section label
  sectionLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginLeft: 20, marginBottom: 14 },

  // Plans
  plansList: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  planCard: { width: W * 0.46, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', padding: 20, alignItems: 'center', gap: 6, position: 'relative', overflow: 'hidden' },
  planCardSelected: { backgroundColor: 'rgba(233,30,140,0.1)', borderColor: '#e91e8c' },
  popularBadge: { position: 'absolute', top: 0, left: 0, right: 0, paddingVertical: 5, alignItems: 'center' },
  popularText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  planLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600', marginTop: 20 },
  planLabelSelected: { color: '#fff' },
  planPrice: { color: 'rgba(255,255,255,0.7)', fontSize: 26, fontWeight: '800' },
  planPriceSelected: { color: '#e91e8c' },
  planPeriod: { color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center' },
  planCheck: { position: 'absolute', top: 10, right: 10 },

  // Divider
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 24, marginHorizontal: 20 },

  // Features
  featuresWrap: { gap: 2, marginBottom: 16, paddingHorizontal: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11 },
  featureIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1 },
  featureLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  featureSub: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 1 },

  // Restore
  restoreBtn: { alignItems: 'center', paddingVertical: 12 },
  restoreText: { color: 'rgba(255,255,255,0.25)', fontSize: 13, textDecorationLine: 'underline' },

  // Fixed bottom CTA
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: 'rgba(8,8,16,0.95)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  ctaWrap: { borderRadius: 16, overflow: 'hidden', shadowColor: '#e91e8c', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10 },
  ctaBtn: { paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  terms: { color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center', marginTop: 8, marginBottom: 4 },
});
