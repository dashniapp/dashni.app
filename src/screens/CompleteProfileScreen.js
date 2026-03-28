import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';
import { useFocusEffect } from '@react-navigation/native';

export default function CompleteProfileScreen({ navigation, route }) {
  const { onComplete } = route.params || {};
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles').select('has_video').eq('id', user.id).single();
      setHasVideo(!!profile?.has_video);

      const { data: files } = await supabase.storage
        .from('avatars').list(user.id, { limit: 5 });
      const photoExists = (files || []).some(f => f.name === 'avatar.jpg');
      setHasPhoto(photoExists);

      if (profile?.has_video && photoExists) {
        onComplete?.();
      }
    } catch (e) {}
    setLoading(false);
  }, [onComplete]);

  useFocusEffect(check);

  const done = hasPhoto && hasVideo;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.inner}>
        <View style={styles.logoRow}>
          <Image source={require('../../assets/icon.png')} style={styles.logoImg} />
          <Text style={styles.logoText}>Dashni</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.emoji}>👤</Text>
          <Text style={styles.title}>Complete your profile</Text>
          <Text style={styles.sub}>
            You need a photo and a video before you can start swiping and connecting with people.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 32 }} />
        ) : (
          <View style={styles.cards}>
            {/* Photo card */}
            <TouchableOpacity
              style={[styles.card, hasPhoto && styles.cardDone]}
              onPress={() => { Haptics.selectionAsync(); navigation.navigate('EditProfile'); }}
              activeOpacity={0.85}
            >
              <View style={[styles.cardIcon, hasPhoto && styles.cardIconDone]}>
                {hasPhoto
                  ? <Ionicons name="checkmark" size={26} color="#fff" />
                  : <Feather name="camera" size={26} color={colors.accent} />
                }
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, hasPhoto && styles.cardTitleDone]}>
                  {hasPhoto ? 'Photo added ✓' : 'Add your photo'}
                </Text>
                <Text style={styles.cardSub}>
                  {hasPhoto ? 'Looking great!' : 'Show your best self'}
                </Text>
              </View>
              {!hasPhoto && <Feather name="chevron-right" size={18} color={colors.textMuted} />}
            </TouchableOpacity>

            {/* Video card */}
            <TouchableOpacity
              style={[styles.card, hasVideo && styles.cardDone]}
              onPress={() => { Haptics.selectionAsync(); navigation.navigate('VideoUpload'); }}
              activeOpacity={0.85}
            >
              <View style={[styles.cardIcon, hasVideo && styles.cardIconDone]}>
                {hasVideo
                  ? <Ionicons name="checkmark" size={26} color="#fff" />
                  : <Feather name="video" size={26} color={colors.accent} />
                }
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, hasVideo && styles.cardTitleDone]}>
                  {hasVideo ? 'Video added ✓' : 'Add your video'}
                </Text>
                <Text style={styles.cardSub}>
                  {hasVideo ? 'Profile looks amazing!' : '15 sec • what makes Dashni unique'}
                </Text>
              </View>
              {!hasVideo && <Feather name="chevron-right" size={18} color={colors.textMuted} />}
            </TouchableOpacity>
          </View>
        )}

        {done && (
          <TouchableOpacity style={styles.continueBtn} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onComplete?.(); }} activeOpacity={0.85}>
            <Text style={styles.continueBtnText}>Start swiping →</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, padding: 24, gap: 28 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoImg: { width: 32, height: 32, borderRadius: 9 },
  logoText: { fontSize: 20, fontWeight: '800', color: colors.accent },
  hero: { gap: 10, alignItems: 'center', paddingTop: 16 },
  emoji: { fontSize: 56 },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  sub: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  cards: { gap: 14 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 18 },
  cardDone: { borderColor: 'rgba(76,175,80,0.4)', backgroundColor: 'rgba(76,175,80,0.06)' },
  cardIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accentBorder, alignItems: 'center', justifyContent: 'center' },
  cardIconDone: { backgroundColor: 'rgba(76,175,80,0.2)', borderColor: 'rgba(76,175,80,0.5)' },
  cardText: { flex: 1, gap: 3 },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  cardTitleDone: { color: '#4caf50' },
  cardSub: { color: colors.textMuted, fontSize: 13 },
  continueBtn: { backgroundColor: colors.accent, borderRadius: radius.full, paddingVertical: 16, alignItems: 'center' },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  signOutBtn: { alignItems: 'center', paddingVertical: 8 },
  signOutText: { color: colors.textMuted, fontSize: 14 },
});
