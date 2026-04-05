import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Alert, ActivityIndicator, Dimensions, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

const { width: W, height: H } = Dimensions.get('window');

function VideoThumb({ uri }) {
  const player = useVideoPlayer(uri, () => {});
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

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
            onPress={() => { if (playing) { player.pause(); setPlaying(false); } else { player.play(); setPlaying(true); } }}>
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
          onPress={onClose}>
          <Feather name="x" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [extraPhotos, setExtraPhotos] = useState([null, null, null, null, null]);
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
    const unsub = navigation.addListener('focus', loadProfile);
    return unsub;
  }, [navigation]);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setProfile(data);
        if (data.has_video) {
          const { data: vd } = supabase.storage.from('videos').getPublicUrl(`${user.id}/profile.mp4`);
          if (vd?.publicUrl) setVideoUrl(vd.publicUrl + '?t=' + Date.now());
        }
      }

      let fileList = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: files } = await supabase.storage.from('avatars').list(user.id, { limit: 20 });
        if (files) { fileList = files; break; }
        await new Promise(r => setTimeout(r, 600));
      }

      const existingFiles = new Set((fileList || []).filter(f => !f.name.startsWith('chat_')).map(f => f.name));

      if (existingFiles.has('avatar.jpg')) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(`${user.id}/avatar.jpg`);
        if (urlData?.publicUrl) setPhotoUrl(urlData.publicUrl + '?t=' + Date.now());
      } else {
        setPhotoUrl(null);
      }

      const extras = [];
      for (let i = 1; i <= 5; i++) {
        const fileName = `photo_${i}.jpg`;
        if (existingFiles.has(fileName)) {
          const { data: extraData } = supabase.storage.from('avatars').getPublicUrl(`${user.id}/${fileName}`);
          extras.push(extraData?.publicUrl ? extraData.publicUrl + '?t=' + Date.now() : null);
        } else {
          extras.push(null);
        }
      }
      setExtraPhotos(extras);
    } catch (e) {
      Alert.alert('Could not load profile', 'Please check your connection and try again.');
    }
    setLoading(false);
  };

  const pickAndUploadPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: false, quality: 0.5, base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append('file', { uri: result.assets[0].uri, name: 'avatar.jpg', type: 'image/jpeg' });
      const uploadUrl = `https://cpthnynbdrkesxfdlmdv.supabase.co/storage/v1/object/avatars/${user.id}/avatar.jpg`;
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'x-upsert': 'true' },
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(`${user.id}/avatar.jpg`);
      setPhotoUrl(urlData.publicUrl + '?t=' + Date.now());
      Alert.alert('✅ Photo updated!', 'Your profile photo is live.');
    } catch (e) {
      Alert.alert('Upload failed', e.message);
    }
    setUploading(false);
  };

  const pickAndUploadVideo = async () => {
    setShowVideoMenu(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'], allowsEditing: false, quality: 0.4, videoMaxDuration: 15,
    });
    if (result.canceled) return;
    if (result.assets[0].duration && result.assets[0].duration > 15000) {
      Alert.alert('Video too long', 'Please choose a video under 15 seconds.');
      return;
    }
    setUploadingVideo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append('file', { uri: result.assets[0].uri, name: 'profile.mp4', type: 'video/mp4' });
      const res = await fetch(
        `https://cpthnynbdrkesxfdlmdv.supabase.co/storage/v1/object/videos/${user.id}/profile.mp4`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${session.access_token}`, 'x-upsert': 'true' }, body: formData }
      );
      if (!res.ok) throw new Error(await res.text());
      await supabase.from('profiles').update({ has_video: true }).eq('id', user.id);
      const { data: vd } = supabase.storage.from('videos').getPublicUrl(`${user.id}/profile.mp4`);
      setVideoUrl(vd.publicUrl + '?t=' + Date.now());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✅ Video updated!', 'Your new video is live.');
    } catch (e) { Alert.alert('Upload failed', e.message); }
    setUploadingVideo(false);
  };

  const pickAndUploadExtraPhoto = async (slot) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: false, quality: 0.5,
    });
    if (result.canceled) return;
    setUploadingSlot(slot);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append('file', { uri: result.assets[0].uri, name: `photo_${slot + 1}.jpg`, type: 'image/jpeg' });
      const res = await fetch(
        `https://cpthnynbdrkesxfdlmdv.supabase.co/storage/v1/object/avatars/${user.id}/photo_${slot + 1}.jpg`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${session.access_token}`, 'x-upsert': 'true' }, body: formData }
      );
      if (!res.ok) throw new Error(await res.text());
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(`${user.id}/photo_${slot + 1}.jpg`);
      const newExtras = [...extraPhotos];
      newExtras[slot] = urlData.publicUrl + '?t=' + Date.now();
      setExtraPhotos(newExtras);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) { Alert.alert('Upload failed', e.message); }
    setUploadingSlot(null);
  };

  const deleteExtraPhoto = async (slot) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Remove photo', 'Remove this photo from your profile?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          const { error } = await supabase.storage.from('avatars').remove([`${user.id}/photo_${slot + 1}.jpg`]);
          if (error) { Alert.alert('Delete failed', error.message); return; }
          const newExtras = [...extraPhotos];
          newExtras[slot] = null;
          setExtraPhotos(newExtras);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const name = profile?.name || 'Your Name';
  const age = profile?.age ? `, ${profile.age}` : '';
  const location = profile?.location || 'Add your city';
  const bio = profile?.bio || 'Add a bio to tell people about yourself';
  const isVerified = profile?.verification_status === 'verified';
  const hasVideo = profile?.has_video;
  const tags = profile?.interests ? profile.interests.split(',').map(t => t.trim()).filter(Boolean) : [];
  const completeness = [profile?.name, profile?.bio, profile?.location, photoUrl, hasVideo].filter(Boolean).length * 20;

  return (
    <View style={[styles.safe, { paddingTop: insets.top + 40 }]}>
      <TouchableOpacity
        style={[styles.settingsBtn, { top: insets.top + 46 }]}
        onPress={() => navigation.navigate('Settings')}
        activeOpacity={0.8}
      >
        <Feather name="settings" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero photo */}
        <TouchableOpacity style={styles.heroWrap} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); pickAndUploadPhoto(); }} activeOpacity={0.9}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#1a0a1e', '#0a0a1a']} style={StyleSheet.absoluteFill}>
              <View style={styles.emptyPhotoWrap}>
                <Feather name="camera" size={40} color="rgba(255,107,107,0.4)" />
                <Text style={styles.emptyPhotoText}>Tap to add photo</Text>
                <Text style={styles.emptyPhotoSub}>Required to get matches</Text>
              </View>
            </LinearGradient>
          )}
          <LinearGradient
            colors={['rgba(8,8,16,0)', 'rgba(8,8,16,0.3)', 'rgba(8,8,16,0.95)']}
            style={styles.heroGradient}
          />
          <View style={styles.cameraBtn}>
            {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="camera" size={16} color="#fff" />}
          </View>
          <View style={styles.heroInfo}>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroName}>{name}{age}</Text>
              {isVerified && <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />}
            </View>
            <View style={styles.heroLocRow}>
              <Feather name="map-pin" size={12} color="rgba(255,255,255,0.5)" />
              <Text style={styles.heroLoc}>{location}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {!photoUrl && (
          <TouchableOpacity style={styles.photoBanner} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); pickAndUploadPhoto(); }}>
            <Feather name="alert-circle" size={16} color="#ff9800" />
            <Text style={styles.photoBannerText}>Add a profile photo to get more matches</Text>
            <Text style={styles.photoBannerBtn}>Add now</Text>
          </TouchableOpacity>
        )}

        {/* Photos & Video */}
        <View style={styles.photosSection}>
          <View style={styles.photosSectionHeader}>
            <Text style={styles.photosSectionTitle}>My Photos & Video</Text>
            <Text style={styles.photosSectionSub}>{[photoUrl, ...extraPhotos].filter(Boolean).length} photos{videoUrl ? ' · 1 video' : ''}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -14 }} contentContainerStyle={{ paddingHorizontal: 14, gap: 10, flexDirection: 'row' }}>
            <TouchableOpacity
              style={styles.photoCell}
              onPress={() => photoUrl ? setSelectedPhoto(photoUrl) : pickAndUploadPhoto()}
              onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); pickAndUploadPhoto(); }}
              activeOpacity={0.85}
            >
              {photoUrl ? (
                <>
                  <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <View style={styles.mainBadge}><Text style={styles.mainBadgeText}>Main</Text></View>
                  <View style={styles.editPhotoBtn}><Feather name="edit-2" size={11} color="#fff" /></View>
                </>
              ) : (
                <View style={styles.photoAddWrap}>
                  <View style={styles.photoAddCircle}><Feather name="camera" size={22} color={colors.accent} /></View>
                  <Text style={styles.photoAddLabel}>Main photo</Text>
                </View>
              )}
            </TouchableOpacity>

            {videoUrl ? (
              <TouchableOpacity
                style={styles.photoCell}
                onPress={() => setShowVideoPlayer(true)}
                onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowVideoMenu(true); }}
                activeOpacity={0.85}
              >
                {uploadingVideo ? (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0d0818', alignItems: 'center', justifyContent: 'center' }]}>
                    <ActivityIndicator color={colors.accent} />
                  </View>
                ) : (
                  <VideoThumb uri={videoUrl} />
                )}
                <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', padding: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 8 }}>
                      <Ionicons name="play" size={10} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>TAP · HOLD ···</Text>
                    </View>
                  </View>
                  <View style={styles.videoThumbDots}><Feather name="more-horizontal" size={16} color="#fff" /></View>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.photoCell} onPress={pickAndUploadVideo} activeOpacity={0.85}>
                <View style={styles.photoAddWrap}>
                  <View style={styles.photoAddCircleSm}><Ionicons name="videocam-outline" size={20} color={colors.textMuted} /></View>
                  <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4 }}>Add video</Text>
                </View>
              </TouchableOpacity>
            )}

            {extraPhotos.map((url, i) => {
              if (!url && uploadingSlot !== i) return null;
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.photoCell}
                  onPress={() => url ? setSelectedPhoto(url) : null}
                  onLongPress={() => url ? deleteExtraPhoto(i) : null}
                  activeOpacity={0.85}
                >
                  {uploadingSlot === i ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : url ? (
                    <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : null}
                </TouchableOpacity>
              );
            })}

            {extraPhotos.filter(Boolean).length < 5 && (
              <TouchableOpacity
                style={styles.photoCell}
                onPress={() => {
                  const nextSlot = extraPhotos.findIndex(p => !p);
                  if (nextSlot !== -1) pickAndUploadExtraPhoto(nextSlot);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.photoAddWrap}>
                  <View style={styles.photoAddCircleSm}><Feather name="plus" size={20} color={colors.textMuted} /></View>
                </View>
              </TouchableOpacity>
            )}
          </ScrollView>
          <Text style={styles.photosHint}>Tap to view fullscreen · Long press to delete · Tap + to add</Text>
        </View>

        <VideoPlayerModal uri={videoUrl} visible={showVideoPlayer} onClose={() => setShowVideoPlayer(false)} />

        <Modal visible={showVideoMenu} transparent animationType="slide" onRequestClose={() => setShowVideoMenu(false)}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setShowVideoMenu(false)} />
          <View style={styles.videoMenuSheet}>
            <View style={styles.videoMenuHandle} />
            <Text style={styles.videoMenuTitle}>Video profile</Text>
            <TouchableOpacity style={styles.videoMenuItem} onPress={pickAndUploadVideo}>
              <Ionicons name="videocam-outline" size={20} color={colors.textPrimary} />
              <Text style={styles.videoMenuItemText}>Change video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.videoMenuItem} onPress={() => {
              setShowVideoMenu(false);
              Alert.alert('Delete video', 'Remove your video profile?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  await supabase.storage.from('videos').remove([`${user.id}/profile.mp4`]);
                  await supabase.from('profiles').update({ has_video: false }).eq('id', user.id);
                  setVideoUrl(null);
                }},
              ]);
            }}>
              <Feather name="trash-2" size={20} color="#ff3b30" />
              <Text style={[styles.videoMenuItemText, { color: '#ff3b30' }]}>Delete video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.videoMenuItem, { marginTop: 8, backgroundColor: colors.bgSurface, borderRadius: radius.md }]} onPress={() => setShowVideoMenu(false)}>
              <Text style={[styles.videoMenuItemText, { textAlign: 'center', width: '100%' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        <Modal visible={!!selectedPhoto} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.97)', alignItems: 'center', justifyContent: 'center' }}>
            {selectedPhoto && <Image source={{ uri: selectedPhoto }} style={{ width: W, height: H * 0.85 }} resizeMode="contain" />}
            <TouchableOpacity
              onPress={() => setSelectedPhoto(null)}
              style={{ position: 'absolute', top: 60, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Feather name="x" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Profile strength */}
        <View style={styles.completenessCard}>
          <View style={styles.completenessTop}>
            <Text style={styles.completenessLabel}>Profile strength</Text>
            <Text style={[styles.completenessPct, { color: completeness >= 80 ? '#4caf50' : colors.accent }]}>{completeness}%</Text>
          </View>
          <View style={styles.completenessBar}>
            <LinearGradient
              colors={completeness >= 80 ? ['#4caf50', '#81c784'] : ['#ff6b6b', '#e91e8c']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.completenessBarFill, { width: `${completeness}%` }]}
            />
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('LikedYou')}>
            <Text style={styles.statNum}>❤️</Text>
            <Text style={styles.statLabel}>Likes</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Matches')}>
            <Text style={styles.statNum}>💘</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Boost')}>
            <Text style={styles.statNum}>⚡</Text>
            <Text style={styles.statLabel}>Boost</Text>
          </TouchableOpacity>
        </View>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); pickAndUploadPhoto(); }}>
            <LinearGradient colors={['#e91e8c', '#ff6b6b']} style={styles.quickActionIcon}>
              <Feather name="camera" size={18} color="#fff" />
            </LinearGradient>
            <Text style={styles.quickActionLabel}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Paywall')}>
            <LinearGradient colors={['#d97706', '#f59e0b']} style={styles.quickActionIcon}>
              <Ionicons name="star" size={18} color="#fff" />
            </LinearGradient>
            <Text style={styles.quickActionLabel}>Gold</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Verification')}>
            <LinearGradient colors={['#1d4ed8', '#3b82f6']} style={styles.quickActionIcon}>
              <Ionicons name="shield-checkmark" size={18} color="#fff" />
            </LinearGradient>
            <Text style={styles.quickActionLabel}>Verify</Text>
          </TouchableOpacity>
        </View>

        {/* About */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>About me</Text>
            <TouchableOpacity style={styles.editChip} onPress={() => navigation.navigate('EditProfile')}>
              <Feather name="edit-2" size={12} color={colors.accent} />
              <Text style={styles.editChipText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.bioText}>{bio}</Text>
        </View>

        {tags.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <TouchableOpacity style={styles.editChip} onPress={() => navigation.navigate('EditProfile')}>
                <Feather name="edit-2" size={12} color={colors.accent} />
                <Text style={styles.editChipText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.tagsWrap}>
              {tags.map((tag, i) => (
                <View key={i} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.editProfileBtn} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.85}>
          <Feather name="edit" size={16} color={colors.textPrimary} />
          <Text style={styles.editProfileBtnText}>Edit full profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.editProfileBtn, { marginTop: 10, borderColor: 'rgba(255,255,255,0.05)' }]} onPress={() => navigation.navigate('Settings')} activeOpacity={0.85}>
          <Feather name="settings" size={16} color={colors.textSecondary} />
          <Text style={[styles.editProfileBtnText, { color: colors.textSecondary }]}>Settings</Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  settingsBtn: { position: 'absolute', top: 10, right: 18, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  scroll: { paddingBottom: 20 },
  heroWrap: { width: W, height: H * 0.52, position: 'relative', overflow: 'hidden', backgroundColor: '#111' },
  emptyPhotoWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyPhotoText: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  emptyPhotoSub: { color: colors.textMuted, fontSize: 13 },
  heroGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%' },
  cameraBtn: { position: 'absolute', bottom: 80, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  heroInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20 },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  heroName: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heroLocRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroLoc: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  photoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,152,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,152,0,0.3)', margin: 14, borderRadius: radius.md, padding: 12 },
  photoBannerText: { color: '#ff9800', fontSize: 13, flex: 1 },
  photoBannerBtn: { color: '#fff', fontSize: 12, fontWeight: '700', backgroundColor: '#ff9800', borderRadius: radius.full, paddingVertical: 4, paddingHorizontal: 10 },
  completenessCard: { margin: 14, backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  completenessTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  completenessLabel: { color: colors.textSecondary, fontSize: 13 },
  completenessPct: { fontSize: 15, fontWeight: '700' },
  completenessBar: { height: 6, backgroundColor: colors.bgSurface, borderRadius: 3, overflow: 'hidden' },
  completenessBarFill: { height: '100%', borderRadius: 3 },
  statsRow: { flexDirection: 'row', marginHorizontal: 14, backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: 18, marginBottom: 14 },
  statCard: { flex: 1, alignItems: 'center', gap: 6 },
  statNum: { fontSize: 22 },
  statLabel: { color: colors.textMuted, fontSize: 11 },
  statDivider: { width: 1, backgroundColor: colors.border },
  quickActions: { flexDirection: 'row', marginHorizontal: 14, gap: 10, marginBottom: 14 },
  quickAction: { flex: 1, alignItems: 'center', gap: 8 },
  quickActionIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '500' },
  section: { marginHorizontal: 14, backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12, gap: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  editChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: radius.full, paddingVertical: 5, paddingHorizontal: 10 },
  editChipText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  bioText: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 14 },
  tagText: { color: colors.textPrimary, fontSize: 13 },
  editProfileBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginHorizontal: 14, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.full, paddingVertical: 15 },
  editProfileBtnText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  photosSection: { marginHorizontal: 14, marginBottom: 14 },
  photosSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  photosSectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  photosSectionSub: { color: colors.textMuted, fontSize: 13 },
  photoCell: { width: 120, height: 160, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  mainBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 8 },
  mainBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  editPhotoBtn: { position: 'absolute', bottom: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  photoAddWrap: { alignItems: 'center', gap: 6 },
  photoAddCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentDim, borderWidth: 1.5, borderColor: colors.accentBorder, alignItems: 'center', justifyContent: 'center' },
  photoAddCircleSm: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  photoAddLabel: { color: colors.accent, fontSize: 11, fontWeight: '600' },
  photosHint: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 10 },
  videoThumbDots: { position: 'absolute', top: 6, right: 6 },
  videoMenuSheet: { backgroundColor: colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 4, paddingBottom: 40 },
  videoMenuHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 },
  videoMenuTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  videoMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  videoMenuItemText: { color: colors.textPrimary, fontSize: 16 },
});
