import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { colors, radius } from '../theme';

export const FILTER_KEY = 'dashni_filters';
export const DEFAULT_FILTERS = {
  ageMin: 18,
  ageMax: 50,
  showVideosOnly: false,
  interestedIn: 'Everyone',
};

export async function getFilters() {
  try {
    const raw = await AsyncStorage.getItem(FILTER_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_FILTERS;
  } catch {
    return DEFAULT_FILTERS;
  }
}

export default function FiltersScreen({ navigation }) {
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(50);
  const [showVideosOnly, setShowVideosOnly] = useState(false);
  const [interestedIn, setInterestedIn] = useState('Everyone');

  useEffect(() => {
    getFilters().then(f => {
      setAgeMin(f.ageMin);
      setAgeMax(f.ageMax);
      setShowVideosOnly(f.showVideosOnly);
      setInterestedIn(f.interestedIn);
    });
  }, []);

  const applyFilters = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await AsyncStorage.setItem(FILTER_KEY, JSON.stringify({
      ageMin, ageMax, showVideosOnly, interestedIn,
    }));
    navigation.navigate('App', {
      screen: 'Discover',
      params: { filtersApplied: Date.now() },
    });
  };

  const reset = async () => {
    Haptics.selectionAsync();
    setAgeMin(18); setAgeMax(50);
    setShowVideosOnly(false); setInterestedIn('Everyone');
    await AsyncStorage.setItem(FILTER_KEY, JSON.stringify(DEFAULT_FILTERS));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="x" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Filters</Text>
        <TouchableOpacity onPress={reset}>
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Age range */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Age range</Text>
            <Text style={styles.cardValue}>{ageMin} – {ageMax}</Text>
          </View>
          <Text style={styles.subLabel}>Minimum age</Text>
          <View style={styles.row}>
            {[18, 21, 25, 30, 35].map(v => (
              <TouchableOpacity key={v}
                style={[styles.chip, ageMin === v && styles.chipOn]}
                onPress={() => { setAgeMin(v); Haptics.selectionAsync(); }}>
                <Text style={[styles.chipText, ageMin === v && styles.chipTextOn]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.subLabel, { marginTop: 12 }]}>Maximum age</Text>
          <View style={styles.row}>
            {[25, 30, 35, 40, 50].map(v => (
              <TouchableOpacity key={v}
                style={[styles.chip, ageMax === v && styles.chipOn]}
                onPress={() => { setAgeMax(v); Haptics.selectionAsync(); }}>
                <Text style={[styles.chipText, ageMax === v && styles.chipTextOn]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Show me */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Show me</Text>
          <View style={styles.row}>
            {['Women', 'Men', 'Everyone'].map(opt => (
              <TouchableOpacity key={opt}
                style={[styles.chip, { flex: 1 }, interestedIn === opt && styles.chipOn]}
                onPress={() => { setInterestedIn(opt); Haptics.selectionAsync(); }}>
                <Text style={[styles.chipText, interestedIn === opt && styles.chipTextOn]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Videos only */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.cardTitle}>Videos only</Text>
              <Text style={styles.cardSub}>Only show profiles with a video</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, showVideosOnly && styles.toggleOn]}
              onPress={() => { setShowVideosOnly(!showVideosOnly); Haptics.selectionAsync(); }}>
              <View style={[styles.thumb, showVideosOnly && styles.thumbOn]} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.applyBtn} onPress={applyFilters} activeOpacity={0.85}>
          <Text style={styles.applyBtnText}>Apply filters</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  resetText: { color: colors.accent, fontSize: 15 },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  card: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  cardValue: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  cardSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  subLabel: { color: colors.textMuted, fontSize: 12 },
  row: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, paddingVertical: 9, borderRadius: radius.md, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  chipOn: { backgroundColor: colors.accentDim, borderColor: colors.accentBorder },
  chipText: { color: colors.textSecondary, fontSize: 13 },
  chipTextOn: { color: colors.accent, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggle: { width: 50, height: 28, borderRadius: 14, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', paddingHorizontal: 3 },
  toggleOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textMuted },
  thumbOn: { backgroundColor: '#fff', alignSelf: 'flex-end' },
  applyBtn: { backgroundColor: colors.accent, borderRadius: radius.full, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  applyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
