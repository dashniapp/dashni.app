import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Dimensions, Alert, Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

const { width: W, height: H } = Dimensions.get('window');

function VideoThumb({ uri }) {
  const player = useVideoPlayer(uri, () => {}); // no play() = stays on first frame
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

const LOOKING_FOR_LABELS = {
  relationship: '💍 Long-term relationship',
  casual: '☕ Casual dating',
  friendship: '👋 New friendships',
  unsure: '🤔 Not sure yet',
};

function VideoPlayerModal({ uri, visible, onClose }) {
  const [playing, setPlaying] = useState(true);
  const player = useVideoPlayer(visible && uri ? uri : null, p => {
    if (p) { p.loop = true; p.play(); }
  });

  useEffect(() => { if (visible) setPlaying(true); }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {visible && uri && (
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1}
            onPress={() => {
              if (playing) { player.pause(); setPlaying(false); }
              else { player.play(); setPlaying(true); }
            }}
          >
            <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
            {!playing && (
              <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="play" size={28} color="#fff" />
                </View>
              </View>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={{ position: 'absolute', top: 60, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}
          onPress={onClose}
        >
          <Feather name="x" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export default function ViewProfileScreen({ route, navigation }) {
  const { profile } = route.params || {};
  const [liked, setLiked] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [videoUrl, setVideoUrl] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    if (profile?.id) loadPhotos();
  }, [profile?.id]);

  const loadPhotos = async () => {
    try {
      const { data: fileList } = await supabase.storage
        .from('avatars')
        .list(profile.id, { limit: 20 });

      const existingFiles = new Set((fileList || []).map(f => f.name));
      const loaded = [];

      if (existingFiles.has('avatar.jpg')) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(`${profile.id}/avatar.jpg`);
        if (data?.publicUrl) loaded.push(data.publicUrl + '?t=1');
      }
      for (let i = 1; i <= 5; i++) {
        if (existingFiles.has(`photo_${i}.jpg`)) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(`${profile.id}/photo_${i}.jpg`);
          if (data?.publicUrl) loaded.push(data.publicUrl + '?t=1');
        }
      }
      setPhotos(loaded);

      // Load video if profile has one
      if (profile.has_video || profile.hasVideo || profile.videoUrl) {
        const { data: vd } = supabase.storage.from('videos').getPublicUrl(`${profile.id}/profile.mp4`);
        if (vd?.publicUrl) setVideoUrl(vd.publicUrl + '?t=1');
      }
    } catch (e) {
      if (profile.photoUrl) setPhotos([profile.photoUrl]);
    }
  };

  if (!profile) return <View style={styles.safe} />;

  const mainPhoto = photos[0] || profile.photoUrl || null;
  const tags = profile.tags || (profile.interests ? profile.interests.split(',').map(t => t.trim()).filter(Boolean) : []);
  const age = profile.age;
  const lookingForLabel = LOOKING_FOR_LABELS[profile.looking_for] || null;
  const isVerified = profile.verified || profile.verification_status === 'verified';

  const handleLike = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLiked(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('likes').upsert({ liker_id: user.id, liked_id: profile.id, is_super: false });
      const { data: mutual } = await supabase.from('likes').select('id').eq('liker_id', profile.id).eq('liked_id', user.id);
      if (mutual?.length) {
        await supabase.from('matches').upsert({
          user_1: user.id < profile.id ? user.id : profile.id,
          user_2: user.id < profile.id ? profile.id : user.id,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("It's a Match! 🎉", `You and ${profile.name} liked each other!`, [
          { text: 'Keep browsing', style: 'cancel' },
          { text: 'Message', onPress: () => navigation.navigate('Chat', {
            name: profile.name, initials: profile.name?.[0]?.toUpperCase() || '?',
            bgColor: '#14102a', accentColor: '#ff6b6b', userId: profile.id, photoUrl: mainPhoto,
          })},
        ]);
      }
    } catch (e) {}
  };

  const handleMessage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Chat', {
      name: profile.name, initials: profile.name?.[0]?.toUpperCase() || '?',
      bgColor: '#14102a', accentColor: '#ff6b6b', userId: profile.id, photoUrl: mainPhoto,
    });
  };

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />

      {/* Fullscreen photo viewer */}
      <Modal visible={!!selectedPhoto} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
        <View style={styles.fullscreenWrap}>
          {selectedPhoto && <Image source={{ uri: selectedPhoto }} style={styles.fullscreenImg} resizeMode="contain" />}
          <TouchableOpacity style={styles.fullscreenClose} onPress={() => setSelectedPhoto(null)}>
            <Feather name="x" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

        {/* ── Hero ── */}
        <View style={styles.hero}>
          {mainPhoto ? (
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSelectedPhoto(mainPhoto)} activeOpacity={0.95}>
              <Image source={{ uri: mainPhoto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            </TouchableOpacity>
          ) : (
            <LinearGradient colors={['#1a0a1e', '#080810']} style={StyleSheet.absoluteFill}>
              <View style={styles.initialWrap}>
                <Text style={styles.initial}>{profile.name?.[0]?.toUpperCase() || '?'}</Text>
              </View>
            </LinearGradient>
          )}

          <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFill} />

          <SafeAreaView edges={['top']} style={styles.topBar}>
            <TouchableOpacity style={styles.backCircle} onPress={() => navigation.goBack()}>
              <Feather name="arrow-left" size={20} color="#fff" />
            </TouchableOpacity>
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={13} color="#3b82f6" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.backCircle}
              onPress={() => { Haptics.selectionAsync(); navigation.navigate('BlockReport', { profile }); }}
            >
              <Feather name="more-vertical" size={20} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>

          <View style={styles.heroBottom}>
            <View style={styles.nameRow}>
              <Text style={styles.heroName}>{profile.name}</Text>
              {age ? <Text style={styles.heroAge}>{age}</Text> : null}
              {isVerified && <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />}
            </View>
            {profile.location ? (
              <View style={styles.locRow}>
                <Feather name="map-pin" size={12} color="rgba(255,255,255,0.65)" />
                <Text style={styles.heroLoc}>{profile.location}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Action buttons ── */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.passBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Feather name="x" size={24} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.msgBtn} onPress={handleMessage} activeOpacity={0.85}>
            <Ionicons name="chatbubble" size={17} color="#fff" />
            <Text style={styles.msgBtnText}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.likeBtn, liked && styles.likeBtnActive]} onPress={handleLike} activeOpacity={0.8}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>

          {/* ── Photos & Video strip ── */}
          {(photos.length > 0 || videoUrl) && (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="images-outline" size={15} color={colors.accent} />
                <Text style={styles.cardTitle}>Photos & Video</Text>
                <Text style={styles.cardCount}>{photos.length}{videoUrl ? ' · 1 video' : ''}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }} contentContainerStyle={{ paddingHorizontal: 4, gap: 8, flexDirection: 'row' }}>
                {photos.map((url, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.photoThumb, i === 0 && styles.photoThumbMain]}
                    onPress={() => { Haptics.selectionAsync(); setSelectedPhoto(url); }}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => {}} />
                    {i === 0 && (
                      <View style={styles.mainLabel}>
                        <Text style={styles.mainLabelText}>Main</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
                {/* Video thumbnail */}
                {videoUrl && (
                  <TouchableOpacity
                    style={styles.photoThumb}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowVideo(true); }}
                    activeOpacity={0.85}
                  >
                    <VideoThumb uri={videoUrl} />
                    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', padding: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 8 }}>
                          <Ionicons name="play" size={10} color="#fff" />
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>VIDEO</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}

          {/* Video fullscreen modal */}
          <VideoPlayerModal uri={videoUrl} visible={showVideo} onClose={() => setShowVideo(false)} />

          {/* ── About ── */}
          {profile.bio ? (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Feather name="user" size={15} color={colors.accent} />
                <Text style={styles.cardTitle}>About</Text>
              </View>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          ) : null}

          {/* ── Interests ── */}
          {tags.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="sparkles" size={15} color={colors.accent} />
                <Text style={styles.cardTitle}>Interests</Text>
              </View>
              <View style={styles.tagsWrap}>
                {tags.map((tag, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Looking for ── */}
          {(lookingForLabel || profile.looking_for_gender) && (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="heart-outline" size={15} color={colors.accent} />
                <Text style={styles.cardTitle}>Looking for</Text>
              </View>
              {lookingForLabel && (
                <View style={styles.lookingChip}>
                  <Text style={styles.lookingChipText}>{lookingForLabel}</Text>
                </View>
              )}
              {profile.looking_for_gender && (
                <View style={styles.infoRow}>
                  <Feather name="users" size={13} color={colors.textMuted} />
                  <Text style={styles.infoText}>Interested in {profile.looking_for_gender}</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Basics ── */}
          {(age || profile.gender || profile.location) && (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Feather name="info" size={15} color={colors.accent} />
                <Text style={styles.cardTitle}>Basics</Text>
              </View>
              <View style={styles.basicsPills}>
                {age ? <View style={styles.pill}><Feather name="calendar" size={13} color={colors.textMuted} /><Text style={styles.pillText}>{age} years old</Text></View> : null}
                {profile.gender ? <View style={styles.pill}><Ionicons name="person-outline" size={13} color={colors.textMuted} /><Text style={styles.pillText}>{profile.gender}</Text></View> : null}
                {profile.location ? <View style={styles.pill}><Feather name="map-pin" size={13} color={colors.textMuted} /><Text style={styles.pillText}>{profile.location}</Text></View> : null}
              </View>
            </View>
          )}

          <View style={{ height: 50 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  // Fullscreen
  fullscreenWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)', alignItems: 'center', justifyContent: 'center' },
  fullscreenImg: { width: W, height: H * 0.88 },
  fullscreenClose: { position: 'absolute', top: 60, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  // Hero
  hero: { width: W, height: H * 0.58, backgroundColor: '#111' },
  initialWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 90, fontWeight: '800', color: colors.accent, opacity: 0.2 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4 },
  backCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: radius.full, paddingVertical: 4, paddingHorizontal: 10 },
  verifiedText: { color: '#3b82f6', fontSize: 11, fontWeight: '600' },
  heroBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, gap: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroName: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  heroAge: { color: 'rgba(255,255,255,0.75)', fontSize: 24, fontWeight: '300' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroLoc: { color: 'rgba(255,255,255,0.65)', fontSize: 13 },

  // Actions
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 18, paddingHorizontal: 20 },
  passBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.bgSurface, borderWidth: 1.5, borderColor: 'rgba(255,107,107,0.25)', alignItems: 'center', justifyContent: 'center' },
  msgBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: radius.full, paddingVertical: 15 },
  msgBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  likeBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  likeBtnActive: { backgroundColor: '#4caf50' },

  // Body
  body: { paddingHorizontal: 16, gap: 10 },
  card: { backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cardTitle: { flex: 1, color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  cardCount: { color: colors.textMuted, fontSize: 12 },

  // Photo thumbnails
  photoThumb: { width: 90, height: 120, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.bgSurface, flexShrink: 0 },
  photoThumbMain: { width: 110, height: 146 },
  mainLabel: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.full, paddingVertical: 2, paddingHorizontal: 7 },
  mainLabelText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  bioText: { color: colors.textPrimary, fontSize: 15, lineHeight: 23 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 13 },
  tagText: { color: colors.textPrimary, fontSize: 13 },

  lookingChip: { backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 14, alignSelf: 'flex-start' },
  lookingChipText: { color: colors.accent, fontSize: 14, fontWeight: '500' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { color: colors.textSecondary, fontSize: 14 },

  basicsPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgSurface, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border },
  pillText: { color: colors.textSecondary, fontSize: 13 },

  reportBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'center', paddingVertical: 10 },
  reportText: { color: colors.textMuted, fontSize: 13 },
});
