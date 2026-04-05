import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { Image } from 'expo-image';                          // disk-cached image
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Feather, Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';
import { compressImage } from '../utils/compressImage';
import { getCachedProfile, setCachedProfile } from '../utils/profileCache';
import { clearMediaCache } from '../utils/mediaCache';

const MAX_PHOTOS = 6; // avatar + photo_1 … photo_5

export default function ProfileScreen({ navigation }) {
  const [profile, setProfile]       = useState(null);
  const [photoUrls, setPhotoUrls]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);

  useEffect(() => { loadProfile(); }, []);

  // ── Load own profile (cache-first) ──────────────────────────
  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check profile cache first
      let data = await getCachedProfile(user.id);
      if (!data) {
        const { data: fetched } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        data = fetched;
        if (data) await setCachedProfile(user.id, data);
      }

      if (data) {
        setProfile(data);
        setPhotoUrls(buildPhotoUrls(user.id, data.photo_count));
      }
    } catch {}
    setLoading(false);
  };

  // ── Deterministic URL construction from photo_count ─────────
  // No storage.list() call — same convention as DiscoverScreen.
  const buildPhotoUrls = (userId, photoCount) => {
    const count = Math.max(1, photoCount ?? 1);
    return Array.from({ length: count }, (_, i) => {
      const filename = i === 0 ? 'avatar.jpg' : `photo_${i}.jpg`;
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(`${userId}/${filename}`);
      return data?.publicUrl ?? null;
    }).filter(Boolean);
  };

  // ── Pick, compress, and upload a new photo ──────────────────
  const pickAndUploadPhoto = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const currentCount = profile?.photo_count ?? 1;
    if (currentCount >= MAX_PHOTOS) {
      Alert.alert('Max photos reached', `You can have at most ${MAX_PHOTOS} photos.`);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 1, // we compress manually below
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      // Compress before upload — max 800px wide, 70% JPEG quality
      const compressed = await compressImage(result.assets[0].uri);

      // Determine filename: first upload is avatar.jpg, extras are photo_N.jpg
      const newIndex = currentCount; // 0-based: currentCount is next index
      const filename = newIndex === 0 ? 'avatar.jpg' : `photo_${newIndex}.jpg`;
      const path     = `${user.id}/${filename}`;

      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append('file', { uri: compressed, name: filename, type: 'image/jpeg' });

      const res = await fetch(
        `https://cpthnynbdrkesxfdlmdv.supabase.co/storage/v1/object/avatars/${path}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            // Long-lived CDN cache — 1 year. Photos don't change at the same filename.
            'Cache-Control': '31536000',
            'x-upsert': 'true',
          },
          body: formData,
        }
      );
      if (!res.ok) throw new Error(await res.text());

      // Increment photo_count in DB
      const newCount = currentCount + 1;
      const { error } = await supabase
        .from('profiles')
        .update({ photo_count: newCount })
        .eq('id', user.id);
      if (error) throw error;

      // Bust profileCache so next load picks up the new count
      await setCachedProfile(user.id, { ...profile, photo_count: newCount });

      setProfile(prev => ({ ...prev, photo_count: newCount }));
      setPhotoUrls(buildPhotoUrls(user.id, newCount));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Upload failed', e.message);
    }
    setUploading(false);
  }, [profile]);

  // ── Delete the last photo ────────────────────────────────────
  const deleteLastPhoto = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const currentCount = profile?.photo_count ?? 1;
    if (currentCount <= 1) {
      Alert.alert('Cannot delete', 'Your main photo (avatar) cannot be removed.');
      return;
    }

    Alert.alert('Delete photo?', 'This will remove your last photo.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const indexToRemove = currentCount - 1;
            const filename = `photo_${indexToRemove}.jpg`;
            await supabase.storage.from('avatars').remove([`${user.id}/${filename}`]);

            const newCount = currentCount - 1;
            await supabase.from('profiles').update({ photo_count: newCount }).eq('id', user.id);
            await setCachedProfile(user.id, { ...profile, photo_count: newCount });

            setProfile(prev => ({ ...prev, photo_count: newCount }));
            setPhotoUrls(buildPhotoUrls(user.id, newCount));
          } catch (e) {
            Alert.alert('Delete failed', e.message);
          }
        },
      },
    ]);
  }, [profile]);

  // ── Logout ──────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    Alert.alert('Log out?', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive',
        onPress: async () => {
          // Clear all on-device caches before signing out
          await clearMediaCache();
          await supabase.auth.signOut();
        },
      },
    ]);
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('EditProfile')}
          style={styles.editBtn}
        >
          <Feather name="edit-2" size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Photo grid */}
        <View style={styles.photoGrid}>
          {photoUrls.map((url, i) => (
            <Image
              key={url}
              source={{ uri: url }}
              style={styles.photo}
              cachePolicy="disk"
              recyclingKey={`${profile?.id}_photo_${i}`}
              transition={200}
              contentFit="cover"
            />
          ))}

          {/* Add photo slot */}
          {(profile?.photo_count ?? 1) < MAX_PHOTOS && (
            <TouchableOpacity
              style={styles.addPhoto}
              onPress={pickAndUploadPhoto}
              disabled={uploading}
            >
              {uploading
                ? <ActivityIndicator color={colors.accent} />
                : <Feather name="plus" size={28} color={colors.accent} />}
            </TouchableOpacity>
          )}
        </View>

        {/* Photo controls */}
        {(profile?.photo_count ?? 1) > 1 && (
          <TouchableOpacity style={styles.deleteBtn} onPress={deleteLastPhoto}>
            <Feather name="trash-2" size={15} color="#FF4458" />
            <Text style={styles.deleteBtnText}>Remove last photo</Text>
          </TouchableOpacity>
        )}

        {/* Profile info */}
        <View style={styles.infoCard}>
          <Text style={styles.name}>
            {profile?.name}{profile?.age ? `, ${profile.age}` : ''}
            {profile?.verification_status === 'verified' && (
              <Text style={styles.verified}> ✓</Text>
            )}
          </Text>
          {profile?.location ? (
            <View style={styles.row}>
              <Feather name="map-pin" size={13} color={colors.textMuted} />
              <Text style={styles.meta}>{profile.location}</Text>
            </View>
          ) : null}
          {profile?.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : null}
        </View>

        {/* Settings / logout */}
        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => navigation.navigate('Settings')}
        >
          <Feather name="settings" size={18} color={colors.textSecondary} />
          <Text style={styles.menuText}>Settings</Text>
          <Feather name="chevron-right" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuRow, styles.logoutRow]} onPress={handleLogout}>
          <Feather name="log-out" size={18} color="#FF4458" />
          <Text style={[styles.menuText, { color: '#FF4458' }]}>Log out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const PHOTO_SIZE = 108;

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.bg },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:        {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle:   { flex: 1, color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  editBtn:       { padding: 4 },
  scroll:        { padding: 18, gap: 16 },
  photoGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo:         { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: radius.md, backgroundColor: colors.bgSurface },
  addPhoto:      {
    width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.accentBorder, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentDim,
  },
  deleteBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  deleteBtnText: { color: '#FF4458', fontSize: 13 },
  infoCard:      {
    backgroundColor: colors.bgSurface, borderRadius: radius.lg,
    padding: 16, gap: 6, borderWidth: 1, borderColor: colors.border,
  },
  name:          { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  verified:      { color: '#4FC3F7' },
  row:           { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta:          { color: colors.textMuted, fontSize: 13 },
  bio:           { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  menuRow:       {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bgSurface, borderRadius: radius.md,
    padding: 16, borderWidth: 1, borderColor: colors.border,
  },
  menuText:      { flex: 1, color: colors.textSecondary, fontSize: 15 },
  logoutRow:     { borderColor: '#FF445820' },
});
