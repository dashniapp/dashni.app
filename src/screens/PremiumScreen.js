import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme';

const PLANS = [
  { id: 'monthly', label: 'Monthly', price: '£9.99', period: '/month', popular: false },
  { id: '6month', label: '6 Months', price: '£5.99', period: '/month', popular: true, saving: 'Save 40%' },
  { id: 'yearly', label: 'Yearly', price: '£3.99', period: '/month', popular: false, saving: 'Save 60%' },
];

const FEATURES = [
  { icon: 'eye', label: 'See who liked you', sub: 'Know who wants to match with you' },
  { icon: 'zap', label: 'Unlimited swipes', sub: 'Never run out of likes' },
  { icon: 'star', label: '5 Super likes per day', sub: 'Stand out from the crowd' },
  { icon: 'trending-up', label: 'Profile boost', sub: 'Be seen by 10x more people' },
  { icon: 'rewind', label: 'Rewind last swipe', sub: 'Change your mind anytime' },
  { icon: 'message-circle', label: 'Message before matching', sub: 'Break the ice first' },
];

export default function PremiumScreen({ navigation }) {
  const [selected, setSelected] = useState('6month');

  const handleSubscribe = () => {
    Alert.alert('Coming soon!', 'Premium subscriptions will be available when Dashni launches publicly.');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="x" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient colors={['#e91e8c', '#ff6b6b', '#ff9a3c']} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.heroOverlay} />
          <Text style={styles.heroTitle}>Dashni Gold</Text>
          <Text style={styles.heroSub}>Find your match faster</Text>
        </LinearGradient>

        {/* Features */}
        <View style={styles.featuresSection}>
          {FEATURES.map((f) => (
            <View key={f.icon} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Feather name={f.icon} size={18} color={colors.accent} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureLabel}>{f.label}</Text>
                <Text style={styles.featureSub}>{f.sub}</Text>
              </View>
              <Feather name="check-circle" size={18} color="#4caf50" />
            </View>
          ))}
        </View>

        {/* Plans */}
        <View style={styles.plansSection}>
          {PLANS.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[styles.planCard, selected === plan.id && styles.planCardSelected]}
              onPress={() => setSelected(plan.id)}
              activeOpacity={0.8}
            >
              {plan.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>Most popular</Text>
                </View>
              )}
              {plan.saving && (
                <View style={styles.savingBadge}>
                  <Text style={styles.savingText}>{plan.saving}</Text>
                </View>
              )}
              <View style={styles.planLeft}>
                <View style={[styles.radio, selected === plan.id && styles.radioSelected]}>
                  {selected === plan.id && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.planLabel}>{plan.label}</Text>
              </View>
              <View style={styles.planRight}>
                <Text style={styles.planPrice}>{plan.price}</Text>
                <Text style={styles.planPeriod}>{plan.period}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Subscribe button */}
        <TouchableOpacity style={styles.subscribeBtn} onPress={handleSubscribe} activeOpacity={0.85}>
          <LinearGradient colors={['#e91e8c', '#ff6b6b']} style={styles.subscribeBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.subscribeBtnText}>Get Dashni Gold</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.terms}>Cancel anytime. Billed as one payment. No hidden fees.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 14, paddingVertical: 10 },
  backBtn: { padding: 4 },
  scroll: { paddingBottom: 40 },
  hero: { height: 160, marginHorizontal: 14, borderRadius: radius.xl, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  heroTitle: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 16, marginTop: 4 },
  featuresSection: { paddingHorizontal: 14, gap: 4, marginBottom: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  featureIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accentBorder, alignItems: 'center', justifyContent: 'center' },
  featureContent: { flex: 1 },
  featureLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  featureSub: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  plansSection: { paddingHorizontal: 14, gap: 10, marginBottom: 20 },
  planCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, position: 'relative' },
  planCardSelected: { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.accentDim },
  popularBadge: { position: 'absolute', top: -10, left: 16, backgroundColor: colors.accent, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  popularText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  savingBadge: { position: 'absolute', top: -10, right: 16, backgroundColor: '#4caf50', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  savingText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  planLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  planLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '500' },
  planRight: { alignItems: 'flex-end' },
  planPrice: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  planPeriod: { color: colors.textMuted, fontSize: 12 },
  subscribeBtn: { marginHorizontal: 14, borderRadius: radius.full, overflow: 'hidden', marginBottom: 12 },
  subscribeBtnInner: { paddingVertical: 16, alignItems: 'center' },
  subscribeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  terms: { color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingHorizontal: 14 },
});
