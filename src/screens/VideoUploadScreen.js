import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

const { width: W, height: H } = Dimensions.get('window');

export default function VideoUploadScreen({ navigation }) {
  const [videoUri, setVideoUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [alreadyHasVideo, setAlreadyHasVideo] = useState(false);
  const [loading, setLoading] = useState(true);

  const player = useVideoPlayer(videoUri, p => {
    if (p) { p.loop = true; }
  });

  useEffect(() => {
    checkExistingVideo();
  }, []);

  const checkExistingVideo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from('profiles').select('has_video').eq('id', user.id).single();
      if (data?.has_video) setAlreadyHasVideo(true);
    } catch (e) {}
    setLoading(false);
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your videos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 0.3,
      videoMaxDuration: 15,
    });
    if (!result.canceled) {
      setVideoUri(result.assets[0].uri);
      setUploaded(false);
    }
  };

  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow camera access.'); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 0.3,
      videoMaxDuration: 15,
    });
    if (!result.canceled) {
      setVideoUri(result.assets[0].uri);
      setUploaded(false);
    }
  };

  const uploadVideo = async () => {
    if (!videoUri) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();

      const formData = new FormData();
      formData.append('file', {
        uri: videoUri,
        name: 'profile.mp4',
        type: 'video/mp4',
      });

      const uploadUrl = `https://cpthnynbdrkesxfdlmdv.supabase.co/storage/v1/object/videos/${user.id}/profile.mp4`;
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'x-upsert': 'true',
        },
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      await supabase.from('profiles').update({ has_video: true }).eq('id', user.id);
      setUploaded(true);
      setAlreadyHasVideo(true);
      Alert.alert('Video uploaded!', 'Your profile video is now live!');
    } catch (e) {
      Alert.alert('Upload failed', e.message);
    }
    setUploading(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile video</Text>
        <View style={{ width: 30 }} />
      </View>

      {alreadyHasVideo && !videoUri ? (
        <View style={styles.content}>
          <View style={styles.lockedCard}>
            <Ionicons name="videocam" size={40} color={colors.accent} />
            <Text style={styles.lockedTitle}>Video uploaded</Text>
            <Text style={styles.lockedSub}>You already have a profile video. Each account can only have one video to keep Dashni authentic.</Text>
            <View style={styles.lockedBadge}>
              <Feather name="lock" size={13} color={colors.accent} />
              <Text style={styles.lockedBadgeText}>1 video per account</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.backBtn2} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn2Text}>Back to profile</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {videoUri ? (
            <View style={styles.previewWrap}>
              <VideoView
                player={player}
                style={styles.video}
                contentFit="cover"
                nativeControls={false}
              />
              <View style={styles.durationBadge}>
                <Feather name="clock" size={11} color="#fff" />
                <Text style={styles.durationText}>Max 15 sec</Text>
              </View>
              <TouchableOpacity style={styles.playBtn} onPress={() => player.playing ? player.pause() : player.play()}>
                <Ionicons name={player.playing ? 'pause' : 'play'} size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyPreview}>
              <Ionicons name="videocam-outline" size={60} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No video yet</Text>
              <Text style={styles.emptySub}>Add a 15 second video — you only get one, make it count!</Text>
            </View>
          )}

          <View style={styles.bottomSection}>
            <View style={styles.limitBanner}>
              <Feather name="info" size={14} color="#3b82f6" />
              <Text style={styles.limitText}>One video per account · Max 15 seconds · Cannot be changed</Text>
            </View>

            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>Tips for a great video</Text>
              <View style={styles.tip}><Feather name="sun" size={13} color={colors.accent} /><Text style={styles.tipText}>Good lighting makes a big difference</Text></View>
              <View style={styles.tip}><Feather name="mic" size={13} color={colors.accent} /><Text style={styles.tipText}>Say a few words about yourself</Text></View>
              <View style={styles.tip}><Feather name="clock" size={13} color={colors.accent} /><Text style={styles.tipText}>Keep it under 15 seconds</Text></View>
              <View style={styles.tip}><Feather name="smile" size={13} color={colors.accent} /><Text style={styles.tipText}>Smile and be yourself!</Text></View>
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.btnSecondary} onPress={pickVideo}>
                <Feather name="image" size={18} color={colors.textPrimary} />
                <Text style={styles.btnSecondaryText}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSecondary} onPress={recordVideo}>
                <Feather name="video" size={18} color={colors.textPrimary} />
                <Text style={styles.btnSecondaryText}>Record now</Text>
              </TouchableOpacity>
            </View>

            {videoUri && (
              <TouchableOpacity
                style={[styles.uploadBtn, uploading && { opacity: 0.7 }]}
                onPress={() => Alert.alert('Upload this video?', 'You can only upload one video and it cannot be changed later.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Upload', onPress: uploadVideo },
                ])}
                disabled={uploading}
              >
                {uploading
                  ? <ActivityIndicator color="#fff" />
                  : <><Feather name="upload-cloud" size={18} color="#fff" /><Text style={styles.uploadBtnText}>Upload video</Text></>
                }
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  content: { flex: 1, padding: 16, gap: 14 },
  lockedCard: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accentBorder, padding: 24, alignItems: 'center', gap: 12 },
  lockedTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  lockedSub: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accentDim, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 12 },
  lockedBadgeText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  previewWrap: { width: W - 28, height: H * 0.4, marginHorizontal: 14, borderRadius: radius.lg, overflow: 'hidden', position: 'relative' },
  video: { width: '100%', height: '100%' },
  durationBadge: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.full, paddingVertical: 5, paddingHorizontal: 10 },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  playBtn: { position: 'absolute', bottom: 16, right: 16, width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  emptyPreview: { height: H * 0.35, marginHorizontal: 14, borderRadius: radius.lg, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  emptySub: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  bottomSection: { flex: 1, padding: 14, gap: 12 },
  limitBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)', borderRadius: radius.md, padding: 12 },
  limitText: { color: '#3b82f6', fontSize: 12, flex: 1 },
  tipsCard: { backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  tipsTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipText: { color: colors.textPrimary, fontSize: 13 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btnSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 13 },
  btnSecondaryText: { color: colors.textPrimary, fontSize: 13, fontWeight: '500' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: radius.full, paddingVertical: 15 },
  uploadBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  backBtn2: { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingVertical: 14, alignItems: 'center' },
  backBtn2Text: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
});
