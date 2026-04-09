import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

const ROW = ({ icon, label, onPress, danger }) => (
  <TouchableOpacity style={styles.row} onPress={() => { Haptics.selectionAsync(); onPress(); }} activeOpacity={0.7}>
    <View style={[styles.rowIcon, danger && { backgroundColor: 'rgba(255,59,48,0.1)' }]}>
      <Feather name={icon} size={18} color={danger ? '#ff3b30' : colors.textSecondary} />
    </View>
    <Text style={[styles.rowLabel, danger && { color: '#ff3b30' }]}>{label}</Text>
    {!danger && <Feather name="chevron-right" size={16} color={colors.textMuted} />}
  </TouchableOpacity>
);

export default function SettingsScreen({ navigation }) {
  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Delete account',
      'This permanently deletes your profile, photos, matches and messages. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete permanently', style: 'destructive', onPress: confirmDelete },
      ]
    );
  };

  const confirmDelete = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Delete all storage files (photos + video)
      await supabase.storage.from('avatars').remove([
        `${user.id}/avatar.jpg`,
        `${user.id}/photo_1.jpg`,
        `${user.id}/photo_2.jpg`,
        `${user.id}/photo_3.jpg`,
        `${user.id}/photo_4.jpg`,
        `${user.id}/photo_5.jpg`,
      ]);
      await supabase.storage.from('videos').remove([`${user.id}/profile.mp4`]);

      // Try RPC (also removes auth.users row). Fall back to manual deletion if not set up yet.
      const { error: rpcError } = await supabase.rpc('delete_user');
      if (rpcError) {
        await supabase.from('messages').delete().or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
        await supabase.from('matches').delete().or(`user_1.eq.${user.id},user_2.eq.${user.id}`);
        await supabase.from('likes').delete().or(`liker_id.eq.${user.id},liked_id.eq.${user.id}`);
        await supabase.from('blocks').delete().or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
        await supabase.from('reports').delete().eq('reporter_id', user.id);
        await supabase.from('profiles').delete().eq('id', user.id);
      }

      await supabase.auth.signOut();
    } catch (e) {
      Alert.alert('Error', 'Failed to delete account. Please contact support@dashni.app');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <ROW icon="edit" label="Edit profile" onPress={() => navigation.navigate('EditProfile')} />
          <ROW icon="video" label="Change video" onPress={() => navigation.navigate('VideoUpload')} />
          <ROW icon="shield" label="Get verified" onPress={() => navigation.navigate('Verification')} />
          <ROW icon="slash" label="Blocked users" onPress={() => navigation.navigate('BlockedUsers')} />
        </View>

        <Text style={styles.sectionLabel}>Premium</Text>
        <View style={styles.card}>
          <ROW icon="star" label="Dashni Premium" onPress={() => navigation.navigate('Paywall')} />
          <ROW icon="zap" label="Boost profile" onPress={() => navigation.navigate('Boost')} />
        </View>

        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.card}>
          <ROW icon="file-text" label="Terms of Service" onPress={() => navigation.navigate('Legal', { type: 'terms' })} />
          <ROW icon="lock" label="Privacy Policy" onPress={() => navigation.navigate('Legal', { type: 'privacy' })} />
        </View>

        <Text style={styles.sectionLabel}>Account actions</Text>
        <View style={styles.card}>
          <ROW icon="log-out" label="Log out" onPress={handleLogout} />
          <ROW icon="trash-2" label="Delete account" onPress={handleDelete} danger />
        </View>

        <View style={styles.footer}>
          <View style={styles.footerLogo}>
            <Image source={require('../../assets/icon.png')} style={styles.footerLogoImg} />
            <Text style={styles.footerLogoText}>Dashni</Text>
          </View>
          <Text style={styles.footerVersion}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  sectionLabel: { color: colors.textMuted, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 8 },
  card: { marginHorizontal: 14, backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  footer: { alignItems: 'center', gap: 8, padding: 40 },
  footerLogo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerLogoImg: { width: 24, height: 24, borderRadius: 6 },
  footerLogoText: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  footerVersion: { color: colors.textMuted, fontSize: 12 },
});
