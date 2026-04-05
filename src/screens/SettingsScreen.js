import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';
import { clearMediaCache } from '../utils/mediaCache';

export default function SettingsScreen({ navigation }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  // ── Logout ───────────────────────────────────────────────────
  // clearMediaCache() wipes:
  //   1. expo-file-system cached media files
  //   2. All profile:* keys in AsyncStorage (profileCache)
  //   3. feed:cache in AsyncStorage (stale-while-revalidate store)
  const handleLogout = useCallback(async () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await clearMediaCache();        // clear all on-device caches
            await supabase.auth.signOut();  // then sign out
          } catch (e) {
            Alert.alert('Logout failed', e.message);
          }
          setLoggingOut(false);
        },
      },
    ]);
  }, []);

  // ── Delete account ───────────────────────────────────────────
  const handleDeleteAccount = useCallback(async () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your profile, photos, and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase.from('profiles').delete().eq('id', user.id);
              }
              await clearMediaCache();
              await supabase.auth.signOut();
            } catch (e) {
              Alert.alert('Delete failed', e.message);
            }
            setDeleting(false);
          },
        },
      ]
    );
  }, []);

  const Row = ({ icon, label, onPress, destructive = false, right }) => (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Feather name={icon} size={18} color={destructive ? '#FF4458' : colors.textSecondary} />
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      {right ?? <Feather name="chevron-right" size={16} color={colors.textMuted} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
          <Row icon="edit-2"  label="Edit profile"   onPress={() => navigation.navigate('EditProfile')} />
          <Row icon="filter"  label="Discovery filters" onPress={() => navigation.navigate('Filters')} />
          <Row icon="shield"  label="Blocked users"  onPress={() => navigation.navigate('BlockedUsers')} />
        </View>

        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.section}>
          <Row icon="file-text" label="Privacy policy" onPress={() => navigation.navigate('Legal', { type: 'privacy' })} />
          <Row icon="file-text" label="Terms of service" onPress={() => navigation.navigate('Legal', { type: 'terms' })} />
        </View>

        <Text style={styles.sectionTitle}>Session</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.row} onPress={handleLogout} disabled={loggingOut} activeOpacity={0.7}>
            <Feather name="log-out" size={18} color="#FF4458" />
            <Text style={[styles.rowLabel, styles.rowLabelDestructive]}>Log out</Text>
            {loggingOut
              ? <ActivityIndicator size="small" color="#FF4458" />
              : <Feather name="chevron-right" size={16} color={colors.textMuted} />}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.row} onPress={handleDeleteAccount} disabled={deleting} activeOpacity={0.7}>
            <Feather name="trash-2" size={18} color="#FF4458" />
            <Text style={[styles.rowLabel, styles.rowLabelDestructive]}>Delete account</Text>
            {deleting
              ? <ActivityIndicator size="small" color="#FF4458" />
              : <Feather name="chevron-right" size={16} color={colors.textMuted} />}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:                   { flex: 1, backgroundColor: colors.bg },
  header:                 { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:                { padding: 4 },
  headerTitle:            { flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  scroll:                 { padding: 20, gap: 8 },
  sectionTitle:           { color: colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 4, marginLeft: 4 },
  section:                { backgroundColor: colors.bgSurface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row:                    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel:               { flex: 1, color: colors.textSecondary, fontSize: 15 },
  rowLabelDestructive:    { color: '#FF4458' },
});
