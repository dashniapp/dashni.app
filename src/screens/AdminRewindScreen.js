import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

const { width: W, height: H } = Dimensions.get('window');

export default function AdminRewindScreen({ navigation }) {
  const [profiles, setProfiles] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('passes')
        .select(`
          profile_id,
          created_at,
          profiles (id, name, age, gender, location, bio, has_video, verification_status, hometown)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);

      const enriched = (data || [])
        .filter(row => row.profiles)
        .map(row => {
          const p = row.profiles;
          const { data: ph } = supabase.storage.from('avatars').getPublicUrl(`${p.id}/avatar.jpg`);
          const { data: vi } = supabase.storage.from('videos').getPublicUrl(`${p.id}/profile.mp4`);
          const locationDisplay = p.hometown || p.location || '';

          return {
            ...p,
            photoUrl: ph?.publicUrl ? `${ph.publicUrl}?t=${p.id}` : null,
            videoUrl: p.has_video && vi?.publicUrl ? vi.publicUrl : null,
            locationDisplay,
            seenAt: row.created_at,
          };
        });

      setProfiles(enriched);
      setIndex(0);
    } catch (e) {
      Alert.alert('Error', 'Could not load swipe history.');
    }
    setLoading(false);
  };

  const current = profiles[index];

  const deleteUser = useCallback(() => {
    if (!current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      `Delete ${current.name}?`,
      'This permanently deletes their account and all data. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await supabase.storage.from('avatars').remove([
                `${current.id}/avatar.jpg`,
                `${current.id}/photo_1.jpg`, `${current.id}/photo_2.jpg`,
                `${current.id}/photo_3.jpg`, `${current.id}/photo_4.jpg`,
                `${current.id}/photo_5.jpg`,
              ]);
              await supabase.storage.from('videos').remove([`${current.id}/profile.mp4`]);

              const { error: rpcError } = await supabase.rpc('admin_delete_user', {
                target_user_id: current.id,
              });

              if (rpcError) {
                await supabase.from('messages').delete().or(`sender_id.eq.${current.id},receiver_id.eq.${current.id}`);
                await supabase.from('matches').delete().or(`user_1.eq.${current.id},user_2.eq.${current.id}`);
                await supabase.from('likes').delete().or(`liker_id.eq.${current.id},liked_id.eq.${current.id}`);
                await supabase.from('blocks').delete().or(`blocker_id.eq.${current.id},blocked_id.eq.${current.id}`);
                await supabase.from('passes').delete().or(`user_id.eq.${current.id},profile_id.eq.${current.id}`);
                await supabase.from('reports').delete().eq('reporter_id', current.id);
                await supabase.from('profiles').delete().eq('id', current.id);
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setProfiles(prev => {
                const next = prev.filter((_, i) => i !== index);
                setIndex(i => Math.min(i, next.length - 1));
                return next;
              });
            } catch (e) {
              Alert.alert('Error', 'Failed to delete user. Try again.');
            }
            setDeleting(false);
          },
        },
      ]
    );
  }, [current, index]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading swipe history...</Text>
      </View>
    );
  }

  if (!profiles.length) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Swipe History</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>🕊️</Text>
          <Text style={styles.emptyText}>No swipe history yet</Text>
        </View>
      </SafeAreaView>
    );
  }

  const seenDate = current?.seenAt
    ? new Date(current.seenAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <View style={styles.safe}>
      {current?.photoUrl
        ? <Image source={{ uri: current.photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        : (
          <LinearGradient colors={['#2a0a1e', '#0d0818']} style={StyleSheet.absoluteFill}>
            <View style={styles.initialWrap}>
              <Text style={styles.initial}>{current?.name?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          </LinearGradient>
        )
      }

      <LinearGradient colors={['rgba(0,0,0,0.65)', 'transparent']} style={styles.topGrad} pointerEvents="none" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.92)']} style={styles.bottomGrad} pointerEvents="none" />

      <SafeAreaView edges={['top']} style={styles.topBarWrap}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Feather name="x" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.counterWrap}>
            <Feather name="rotate-ccw" size={13} color="rgba(255,255,255,0.7)" />
            <Text style={styles.counter}>{index + 1} / {profiles.length}</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
        {seenDate ? <Text style={styles.seenAt}>Seen {seenDate}</Text> : null}
      </SafeAreaView>

      <View style={styles.bottom}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{current?.name}</Text>
          {current?.age ? <Text style={styles.age}>{current.age}</Text> : null}
          {current?.verification_status === 'verified' && (
            <Ionicons name="checkmark-circle" size={18} color="#3b82f6" />
          )}
        </View>
        {current?.locationDisplay ? (
          <View style={styles.locRow}>
            <Feather name="map-pin" size={12} color="rgba(255,255,255,0.55)" />
            <Text style={styles.location}>{current.locationDisplay}</Text>
          </View>
        ) : null}
        {current?.bio ? (
          <Text style={styles.bio} numberOfLines={2}>{current.bio}</Text>
        ) : null}

        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.navBtn, index === 0 && styles.navBtnDisabled]}
            onPress={() => { setIndex(i => i - 1); Haptics.selectionAsync(); }}
            disabled={index === 0}
          >
            <Feather name="chevron-left" size={22} color={index === 0 ? 'rgba(255,255,255,0.25)' : '#fff'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={deleteUser}
            disabled={deleting}
            activeOpacity={0.85}
          >
            {deleting
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <Feather name="trash-2" size={16} color="#fff" />
                  <Text style={styles.deleteBtnText}>Delete User</Text>
                </>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navBtn, index === profiles.length - 1 && styles.navBtnDisabled]}
            onPress={() => { setIndex(i => i + 1); Haptics.selectionAsync(); }}
            disabled={index === profiles.length - 1}
          >
            <Feather name="chevron-right" size={22} color={index === profiles.length - 1 ? 'rgba(255,255,255,0.25)' : '#fff'} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#000' },
  center:        { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText:   { color: colors.textSecondary, fontSize: 14 },
  emptyText:     { color: colors.textSecondary, fontSize: 16, fontWeight: '600' },
  initialWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  initial:       { fontSize: 100, fontWeight: '800', color: colors.accent, opacity: 0.15 },
  topGrad:       { position: 'absolute', top: 0, left: 0, right: 0, height: 160 },
  bottomGrad:    { position: 'absolute', bottom: 0, left: 0, right: 0, height: H * 0.6 },
  topBarWrap:    { position: 'absolute', top: 0, left: 0, right: 0 },
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  closeBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  topTitle:      { color: '#fff', fontSize: 15, fontWeight: '700' },
  counterWrap:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  counter:       { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  seenAt:        { color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'center', marginTop: -4 },
  bottom:        { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 48, gap: 8 },
  nameRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:          { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  age:           { color: 'rgba(255,255,255,0.8)', fontSize: 22 },
  locRow:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  location:      { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  bio:           { color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 19 },
  controls:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 12 },
  navBtn:        { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  navBtnDisabled:{ opacity: 0.4 },
  deleteBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#c0392b', borderRadius: radius.full, paddingVertical: 14 },
  deleteBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
