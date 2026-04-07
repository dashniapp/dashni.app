import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, Animated, ActivityIndicator,
  ScrollView, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Purchases from 'react-native-purchases';
import { colors, radius } from '../theme';

// Outcome-driven feature copy — sells the result, not the feature
const FEATURES = [
  { icon: 'heart',      label: 'Match instantly',          sub: 'See everyone who already likes you and match in one tap' },
  { icon: 'infinite',   label: 'Like without limits',       sub: 'Swipe as many people as you want, every single day' },
  { icon: 'star',       label: 'Get seen by 10x more people', sub: 'Boost your profile to the top of discovery' },
  { icon: 'flash',      label: 'Show up first',             sub: 'Appear before everyone else in search results' },
  { icon: 'chatbubble', label: 'Message anyone, anytime',   sub: 'Start a conversation without waiting for a match' },
];

const DURATIONS_DAYS = {
  '$rc_weekly':      7,
  '$rc_monthly':     30,
  '$rc_three_month': 91,
};

const PACKAGE_META = {
  '$rc_weekly':      { label: 'Weekly',   period: 'per week' },
  '$rc_monthly':     { label: 'Monthly',  period: 'per month' },
  '$rc_three_month': { label: '3 Months', period: 'every 3 months', popular: true },
};

export default function PaywallScreen({ navigation }) {
  const [packages, setPackages]       = useState([]);
  const [selected, setSelected]       = useState(null);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState(null);
  const [purchasing, setPurchasing]   = useState(false);
  const [perDay, setPerDay]           = useState({});
  const [savings, setSavings]         = useState({});

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadOfferings();
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    // Subtle CTA pulse to draw attention
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const loadOfferings = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current?.availablePackages?.length > 0) {
        const pkgs = offerings.current.availablePackages.filter(
          p => p.identifier !== '$rc_two_month'
        );
        setPackages(pkgs);

        // Compute per-day rate and savings vs weekly
        const weeklyPkg = pkgs.find(p => p.identifier === '$rc_weekly');
        const weeklyDaily = weeklyPkg
          ? weeklyPkg.product.price / 7
          : null;

        const dayMap = {};
        const saveMap = {};
        pkgs.forEach(pkg => {
          const days = DURATIONS_DAYS[pkg.identifier] || 30;
          const daily = pkg.product.price / days;
          dayMap[pkg.identifier] = daily < 1
            ? `$${daily.toFixed(2)}/day`
            : null;
          if (weeklyDaily && pkg.identifier !== '$rc_weekly') {
            const pct = Math.round((1 - daily / weeklyDaily) * 100);
            if (pct > 0) saveMap[pkg.identifier] = `Save ${pct}%`;
          }
        });
        setPerDay(dayMap);
        setSavings(saveMap);

        const threeMonth = pkgs.find(p => p.identifier === '$rc_three_month');
        setSelected(threeMonth ? threeMonth.identifier : pkgs[0].identifier);
      } else {
        setLoadError('No plans found. Make sure offerings are configured in the RevenueCat dashboard.');
      }
    } catch (e) {
      setLoadError(`RC Error: ${e.message || JSON.stringify(e)}`);
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

      {/* Close */}
      <SafeAreaView edges={['top']} style={styles.closeWrap}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Feather name="x" size={18} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </SafeAreaView>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Hero ── */}
          <View style={styles.hero}>
            <LinearGradient
              colors={['#e91e8c', '#ff6b35']}
              style={styles.crownWrap}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Ionicons name="star" size={32} color="#fff" />
            </LinearGradient>
            {/* Benefit-driven headline — tells users what they GET */}
            <Text style={styles.heroTitle}>Get More Matches Today</Text>
            <Text style={styles.heroSub}>
              Thousands of Albanians are already connecting.{`\n`}Don't miss out.
            </Text>
          </View>

          {/* ── Plans ── */}
          <Text style={styles.sectionLabel}>Choose your plan</Text>
          {loading ? (
            <ActivityIndicator color="#e91e8c" size="large" style={{ marginVertical: 24 }} />
          ) : loadError ? (
            <View style={styles.errorWrap}>
              <Ionicons name="alert-circle-outline" size={36} color="rgba(255,255,255,0.3)" />
              <Text style={styles.errorText}>{loadError}</Text>
              <TouchableOpacity onPress={loadOfferings} style={styles.retryBtn}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.plansWrap}>
              {packages.map((pkg) => {
                const meta      = PACKAGE_META[pkg.identifier] || { label: pkg.identifier, period: '' };
                const isSelected = selected === pkg.identifier;
                const isWeak    = pkg.identifier === '$rc_weekly'; // visually de-emphasise weekly
                return (
                  <TouchableOpacity
                    key={pkg.identifier}
                    style={[
                      styles.planCard,
                      isSelected && styles.planCardSelected,
                      isWeak && !isSelected && styles.planCardWeak,
                    ]}
                    onPress={() => setSelected(pkg.identifier)}
                    activeOpacity={0.85}
                  >
                    {/* Popular badge */}
                    {meta.popular && (
                      <LinearGradient
                        colors={['#e91e8c', '#ff6b35']}
                        style={styles.popularBadge}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      >
                        <Text style={styles.popularText}>MOST POPULAR</Text>
                      </LinearGradient>
                    )}

                    <View style={styles.planLeft}>
                      <View style={[styles.radio, isSelected && styles.radioSelected]}>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                      <View>
                        <Text style={[styles.planLabel, isSelected && styles.planLabelSelected]}>
                          {meta.label}
                        </Text>
                        {/* Per-day price — makes it feel cheap */}
                        {perDay[pkg.identifier] ? (
                          <Text style={styles.perDay}>{perDay[pkg.identifier]}</Text>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.planRight}>
                      {/* Savings badge */}
                      {savings[pkg.identifier] ? (
                        <View style={styles.savingsBadge}>
                          <Text style={styles.savingsText}>{savings[pkg.identifier]}</Text>
                        </View>
                      ) : null}
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

          <View style={styles.divider} />

          {/* ── Features ── */}
          <Text style={styles.sectionLabel}>Everything you get</Text>
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

          {/* ── Trust signals ── */}
          <View style={styles.trustRow}>
            <View style={styles.trustItem}>
              <Ionicons name="lock-closed" size={13} color="rgba(255,255,255,0.4)" />
              <Text style={styles.trustText}>Secure payment</Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="close-circle-outline" size={13} color="rgba(255,255,255,0.4)" />
              <Text style={styles.trustText}>Cancel anytime</Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="shield-checkmark-outline" size={13} color="rgba(255,255,255,0.4)" />
              <Text style={styles.trustText}>No commitment</Text>
            </View>
          </View>

          {/* Women note */}
          <Text style={styles.genderNote}>Women enjoy free access to all Dashni Premium features.</Text>

          {/* Restore + legal links */}
          <View style={styles.legalRow}>
            <TouchableOpacity onPress={handleRestore}>
              <Text style={styles.legalLink}>Restore purchases</Text>
            </TouchableOpacity>
            <Text style={styles.legalSep}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://dashni.app/privacy')}>
              <Text style={styles.legalLink}>Privacy</Text>
            </TouchableOpacity>
            <Text style={styles.legalSep}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://dashni.app/terms')}>
              <Text style={styles.legalLink}>Terms</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 140 }} />
        </ScrollView>

        {/* ── Fixed CTA ── */}
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          {/* Urgency line above button */}
          {!loadError && (
            <Text style={styles.urgency}>⚡ Limited offer — prices may increase soon</Text>
          )}
          <Animated.View style={[styles.ctaWrap, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity
              onPress={handleSubscribe}
              activeOpacity={0.9}
              disabled={purchasing || loading || !!loadError}
            >
              <LinearGradient
                colors={loadError ? ['#444', '#444'] : ['#e91e8c', '#ff5f40', '#ff9a3c']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.ctaBtn}
              >
                {purchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  // Outcome-driven CTA text
                  <Text style={styles.ctaText}>
                    {selectedPkg
                      ? `Start Getting Matches — ${selectedPkg.product.priceString}`
                      : 'Start Getting Matches'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {selectedPkg && (
            <Text style={styles.iapDisclosure}>
              {`${PACKAGE_META[selectedPkg.identifier]?.label || ''} subscription — ${selectedPkg.product.priceString}/${PACKAGE_META[selectedPkg.identifier]?.period || 'period'}. Charged to your Apple ID at confirmation. Renews automatically unless cancelled 24h before period end. Manage in App Store settings.`}
            </Text>
          )}
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content:   { flex: 1 },

  closeWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16, paddingTop: 8 },
  closeBtn:  { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  scroll:    { paddingTop: 80 },

  // Hero
  hero:      { alignItems: 'center', paddingVertical: 28, gap: 10, paddingHorizontal: 24 },
  crownWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4, shadowColor: '#e91e8c', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  heroTitle: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  heroSub:   { color: 'rgba(255,255,255,0.45)', fontSize: 15, textAlign: 'center', lineHeight: 22 },

  sectionLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginLeft: 20, marginBottom: 14 },

  // Error
  errorWrap: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20, gap: 12 },
  errorText: { color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  retryBtn:  { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Plans
  plansWrap:       { paddingHorizontal: 16, gap: 10, marginBottom: 4 },
  planCard:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', paddingVertical: 14, paddingHorizontal: 18, position: 'relative', overflow: 'hidden' },
  planCardSelected:{ backgroundColor: 'rgba(233,30,140,0.12)', borderColor: '#e91e8c' },
  planCardWeak:    { opacity: 0.6 }, // de-emphasise weekly when not selected
  popularBadge:    { position: 'absolute', top: 0, right: 0, paddingVertical: 4, paddingHorizontal: 10, borderBottomLeftRadius: 10 },
  popularText:     { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  planLeft:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planRight:       { alignItems: 'flex-end', gap: 3 },
  radio:           { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  radioSelected:   { borderColor: '#e91e8c' },
  radioDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e91e8c' },
  planLabel:       { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600' },
  planLabelSelected:{ color: '#fff' },
  perDay:          { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },
  savingsBadge:    { backgroundColor: '#22c55e22', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  savingsText:     { color: '#22c55e', fontSize: 11, fontWeight: '700' },
  planPrice:       { color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: '800' },
  planPriceSelected:{ color: '#e91e8c' },
  planPeriod:      { color: 'rgba(255,255,255,0.3)', fontSize: 11 },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 24, marginHorizontal: 20 },

  // Features
  featuresWrap:   { gap: 2, marginBottom: 20, paddingHorizontal: 20 },
  featureRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11 },
  featureIconWrap:{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  featureText:    { flex: 1 },
  featureLabel:   { color: '#fff', fontSize: 15, fontWeight: '600' },
  featureSub:     { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2, lineHeight: 17 },

  // Trust row
  trustRow:  { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 16, paddingHorizontal: 20 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },

  genderNote: { color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', paddingHorizontal: 24, marginBottom: 16 },

  // Legal row
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingBottom: 8 },
  legalLink: { color: 'rgba(255,255,255,0.25)', fontSize: 12, textDecorationLine: 'underline' },
  legalSep:  { color: 'rgba(255,255,255,0.15)', fontSize: 12 },

  // Bottom CTA
  bottomBar:     { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 10, backgroundColor: 'rgba(8,8,16,0.97)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  urgency:       { color: '#ff9a3c', fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 8, letterSpacing: 0.2 },
  ctaWrap:       { borderRadius: 16, overflow: 'hidden', shadowColor: '#e91e8c', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10 },
  ctaBtn:        { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  ctaText:       { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  iapDisclosure: { color: 'rgba(255,255,255,0.18)', fontSize: 10, textAlign: 'center', marginTop: 8, paddingHorizontal: 4, lineHeight: 15, marginBottom: 4 },
});
