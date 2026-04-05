import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';                         // disk-cached image
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';
import { getCachedProfile, setCachedProfile } from '../utils/profileCache';

const { width: SCREEN_W } = Dimensions.get('window');
const SLIDE_H = SCREEN_W * 1.2;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function buildPhotoUrls(profileId, photoCount) {
  const count = Math.max(1, photoCount ?? 1);
  return Array.from({ length: count }, (_, i) => {
    const filename = i === 0 ? 'avatar.jpg' : `photo_${i}.jpg`;
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(`${profileId}/${filename}`);
    return data?.publicUrl ?? null;
  }).filter(Boolean);
}

function buildVideoUrl(profileId, hasVideo) {
  if (!hasVideo) return null;
  const { data } = supabase.storage
    .from('videos')
    .getPublicUrl(`${profileId}/profile.mp4`);
  return data?.publicUrl ?? null;
}

// ─────────────────────────────────────────────────────────────
// ViewProfileScreen
// ─────────────────────────────────────────────────────────────
export default function ViewProfileScreen({ navigation, route }) {
  // `profile` can be passed directly via route params (from swipe card)
  // or we load it by userId — always wraps with profileCache.
  const { profile: initialProfile, userId: paramUserId } = route.params ?? {};

  const [profile,      setProfile]      = useState(initialProfile ?? null);
  const [mediaSlides,  setMediaSlides]  = useState([]);
  const [slideIndex,   setSlideIndex]   = useState(0);
  const [loading,      setLoading]      = useState(!initialProfile);
  const [reporting,    setReporting]    = useState(false);

  const videoUrl = profile?.has_video ? buildVideoUrl(profile.id, true) : null;
  const player   = useVideoPlayer(videoUrl ?? '', p => { p.loop = true; });

  useEffect(() => { initProfile(); }, []);

  const initProfile = async () => {
    let p = initialProfile;

    if (!p && paramUserId) {
      // Cache-first fetch
      p = await getCachedProfile(paramUserId);
      if (!p) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', paramUserId)
          .single();
        p = data;
        if (p) await setCachedProfile(paramUserId, p);
      }
      setProfile(p);
    }

    if (p) {
      const photoUrls = buildPhotoUrls(p.id, p.photo_count);
      const slides = [
        ...photoUrls.map((url, i) => ({ type: 'photo', url, key: `photo_${i}` })),
        ...(p.has_video ? [{ type: 'video', url: buildVideoUrl(p.id, true), key: 'video' }] : []),
      ];
      setMediaSlides(slides);
    }

    setLoading(false);
  };

  const handleBlock = () => {
    Alert.alert('Block or Report', 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block',  style: 'destructive', onPress: () => blockUser() },
      { text: 'Report', style: 'destructive', onPress: () => reportUser() },
    ]);
  };

  const blockUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('blocks').upsert(
        { blocker_id: user.id, blocked_id: profile.id },
        { onConflict: 'blocker_id,blocked_id' }
      );
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const reportUser = async () => {
    setReporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('reports').insert({
        reporter_id: user.id,
        reported_id: profile.id,
        created_at: new Date().toISOString(),
      });
      Alert.alert('Report submitted', 'Thank you. Our team will review this profile.');
    } catch {}
    setReporting(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Profile not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentSlide = mediaSlides[slideIndex];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerName} numberOfLines={1}>{profile.name}</Text>
        <TouchableOpacity onPress={handleBlock} style={styles.moreBtn}>
          <Feather name="more-horizontal" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Media viewer */}
        <View style={styles.mediaContainer}>
          {currentSlide?.type === 'photo' && (
            <Image
              source={{ uri: currentSlide.url }}
              style={styles.mediaSlide}
              // cachePolicy="disk" — expo-image stores this on-disk so it's never
              // re-downloaded on repeat views of the same profile.
              cachePolicy="disk"
              recyclingKey={`${profile.id}_${currentSlide.key}`}
              transition={200}
              contentFit="cover"
            />
          )}
          {currentSlide?.type === 'video' && videoUrl && (
            <VideoView
              player={player}
              style={styles.mediaSlide}
              contentFit="cover"
              nativeControls={false}
            />
          )}

          {/* Slide dots */}
          {mediaSlides.length > 1 && (
            <View style={styles.dots}>
              {mediaSlides.map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSlideIndex(i)}
                  style={[styles.dot, i === slideIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}

          {/* Tap zones for slide navigation */}
          <View style={styles.tapZones}>
            <TouchableOpacity
              style={styles.tapLeft}
              onPress={() => setSlideIndex(i => Math.max(0, i - 1))}
            />
            <TouchableOpacity
              style={styles.tapRight}
              onPress={() => setSlideIndex(i => Math.min(mediaSlides.length - 1, i + 1))}
            />
          </View>
        </View>

        {/* Profile info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {profile.name}{profile.age ? `, ${profile.age}` : ''}
            </Text>
            {profile.verification_status === 'verified' && (
              <Ionicons name="checkmark-circle" size={20} color="#4FC3F7" />
            )}
          </View>

          {profile.location ? (
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={13} color={colors.textMuted} />
              <Text style={styles.meta}>{profile.location}</Text>
            </View>
          ) : null}

          {profile.hometown ? (
            <View style={styles.metaRow}>
              <Feather name="home" size={13} color={colors.textMuted} />
              <Text style={styles.meta}>From {profile.hometown}</Text>
            </View>
          ) : null}

          {profile.looking_for ? (
            <View style={styles.metaRow}>
              <Feather name="heart" size={13} color={colors.textMuted} />
              <Text style={styles.meta}>
                {{
                  relationship: 'Long-term relationship',
                  casual:       'Something casual',
                  friendship:   'Friendship',
                  unsure:       'Not sure yet',
                }[profile.looking_for] ?? profile.looking_for}
              </Text>
            </View>
          ) : null}

          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : null}

          {/* Interests */}
          {profile.interests ? (
            <View style={styles.tags}>
              {profile.interests.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: colors.bg },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText:      { color: colors.textMuted, fontSize: 16 },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:        { padding: 4 },
  headerName:     { flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '600', textAlign: 'center', marginHorizontal: 8 },
  moreBtn:        { padding: 4 },
  mediaContainer: { width: SCREEN_W, height: SLIDE_H, backgroundColor: colors.bgSurface, position: 'relative' },
  mediaSlide:     { width: SCREEN_W, height: SLIDE_H },
  dots:           { position: 'absolute', top: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot:            { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive:      { backgroundColor: '#fff', width: 18 },
  tapZones:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  tapLeft:        { flex: 1 },
  tapRight:       { flex: 1 },
  info:           { padding: 20, gap: 10 },
  nameRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:           { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
  metaRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta:           { color: colors.textMuted, fontSize: 14 },
  bio:            { color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 4 },
  tags:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tag:            { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.bgSurface },
  tagText:        { color: colors.textSecondary, fontSize: 13 },
});
