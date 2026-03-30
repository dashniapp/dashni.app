import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme';

export default function BoostScreen({ navigation }) {
  const [boosting, setBoosting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    if (boosting) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setBoosting(false);
            pulseAnim.stopAnimation();
            Alert.alert('Boost ended!', 'Your profile boost has finished. You got 10x more views!');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [boosting]);

  const startBoost = () => {
    setBoosting(true);
    setTimeLeft(30 * 60);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Boost profile</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.content}>
        {/* Animated icon */}
        <Animated.View style={[styles.boostIconWrap, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient colors={['#e91e8c', '#ff6b6b']} style={styles.boostIcon}>
            <Feather name="zap" size={40} color="#fff" />
          </LinearGradient>
        </Animated.View>

        {boosting ? (
          <>
            <Text style={styles.title}>Boost active</Text>
            <Text style={styles.sub}>Your profile is featured in discovery for the next 30 minutes</Text>
            <View style={styles.timerCard}>
              <Text style={styles.timerLabel}>Time remaining</Text>
              <Text style={styles.timer}>{formatTime(timeLeft)}</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title}>Boost your profile</Text>
            <Text style={styles.sub}>Feature your profile in discovery for 30 minutes — free during our beta</Text>
          </>
        )}

        {/* Info */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>30m</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>1×</Text>
            <Text style={styles.statLabel}>Per day</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>Free</Text>
            <Text style={styles.statLabel}>Beta</Text>
          </View>
        </View>

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Best times to boost</Text>
          <View style={styles.tip}><Feather name="sun" size={14} color={colors.accent} /><Text style={styles.tipText}>Sunday evenings 7–10pm</Text></View>
          <View style={styles.tip}><Feather name="moon" size={14} color={colors.accent} /><Text style={styles.tipText}>Weekday nights after 8pm</Text></View>
          <View style={styles.tip}><Feather name="calendar" size={14} color={colors.accent} /><Text style={styles.tipText}>Friday and Saturday nights</Text></View>
        </View>

        {!boosting && (
          <TouchableOpacity style={styles.boostBtn} onPress={startBoost} activeOpacity={0.85}>
            <LinearGradient colors={['#e91e8c', '#ff6b6b']} style={styles.boostBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Feather name="zap" size={18} color="#fff" />
              <Text style={styles.boostBtnText}>Boost now</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  content: { flex: 1, padding: 24, alignItems: 'center', gap: 20 },
  boostIconWrap: { marginBottom: 8 },
  boostIcon: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  sub: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  timerCard: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accentBorder, padding: 20, alignItems: 'center', width: '100%' },
  timerLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 6 },
  timer: { color: colors.accent, fontSize: 48, fontWeight: '800', letterSpacing: -2 },
  statsRow: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 16, width: '100%' },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { color: colors.accent, fontSize: 22, fontWeight: '700' },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },
  tipsCard: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, width: '100%', gap: 10 },
  tipsTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipText: { color: colors.textPrimary, fontSize: 14 },
  boostBtn: { width: '100%', borderRadius: radius.full, overflow: 'hidden' },
  boostBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  boostBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
