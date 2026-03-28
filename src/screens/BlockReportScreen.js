import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { supabase } from '../lib/supabase';

const REPORT_REASONS = [
  'Fake profile',
  'Inappropriate photos',
  'Harassment or abuse',
  'Spam or scam',
  'Underage user',
  'Other',
];

export default function BlockReportScreen({ navigation, route }) {
  const { profile, name: nameParam, userId: userIdParam } = route.params || {};
  const name = profile?.name || nameParam || 'this user';
  const userId = profile?.id || userIdParam || null;
  const [selectedReason, setSelectedReason] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleBlock = () => {
    Alert.alert(
      `Block ${name}?`,
      `${name} won't be able to see your profile or message you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
              await supabase.from('blocks').upsert({
                blocker_id: user.id,
                blocked_id: userId,
              });
              Alert.alert(
                'Blocked',
                `${name} has been blocked and will no longer appear in your feed.`,
                [{ text: 'OK', onPress: () => navigation.navigate('App', {
                  screen: 'Discover',
                  params: { reloadFeed: Date.now() },
                }) }]
              );
            } catch (e) {
              Alert.alert('Error', 'Could not block user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleReport = async () => {
    if (!selectedReason) {
      Alert.alert('Select a reason', 'Please select a reason for reporting.');
      return;
    }
    setSubmitted(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('reports').insert({
        reporter_id: user.id,
        reported_id: userId,
        reason: selectedReason,
      });
      Alert.alert('Report submitted', 'Thank you for keeping Dashni safe. Our team will review this report within 24 hours.');
      navigation.goBack();
    } catch (e) {
      setSubmitted(false);
      Alert.alert('Error', 'Could not submit report. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Block or report</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.content}>
        {/* Block section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <Feather name="slash" size={20} color="#ff6b6b" />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Block {name}</Text>
              <Text style={styles.cardSub}>They won't see your profile or messages</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.blockBtn} onPress={handleBlock}>
            <Text style={styles.blockBtnText}>Block {name}</Text>
          </TouchableOpacity>
        </View>

        {/* Report section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(255,152,0,0.1)' }]}>
              <Feather name="flag" size={20} color="#ff9800" />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Report {name}</Text>
              <Text style={styles.cardSub}>Help us keep Dashni safe</Text>
            </View>
          </View>

          <Text style={styles.reasonLabel}>Select a reason</Text>
          <View style={styles.reasons}>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[styles.reasonBtn, selectedReason === reason && styles.reasonBtnSelected]}
                onPress={() => setSelectedReason(reason)}
              >
                <Text style={[styles.reasonText, selectedReason === reason && styles.reasonTextSelected]}>
                  {reason}
                </Text>
                {selectedReason === reason && <Feather name="check" size={14} color={colors.accent} />}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.reportBtn, submitted && { opacity: 0.7 }]}
            onPress={handleReport}
            disabled={submitted}
          >
            <Text style={styles.reportBtnText}>{submitted ? 'Submitting...' : 'Submit report'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  content: { flex: 1, padding: 14, gap: 14 },
  card: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,107,107,0.1)', alignItems: 'center', justifyContent: 'center' },
  cardHeaderText: { flex: 1 },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  cardSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  blockBtn: { backgroundColor: 'rgba(255,107,107,0.1)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)', borderRadius: radius.full, paddingVertical: 12, alignItems: 'center' },
  blockBtnText: { color: '#ff6b6b', fontSize: 14, fontWeight: '600' },
  reasonLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  reasons: { gap: 8 },
  reasonBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14 },
  reasonBtnSelected: { backgroundColor: colors.accentDim, borderColor: colors.accentBorder },
  reasonText: { color: colors.textSecondary, fontSize: 14 },
  reasonTextSelected: { color: colors.accent, fontWeight: '500' },
  reportBtn: { backgroundColor: '#ff9800', borderRadius: radius.full, paddingVertical: 12, alignItems: 'center' },
  reportBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
