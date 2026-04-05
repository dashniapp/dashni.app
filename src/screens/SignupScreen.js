import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';
import { compressImage } from '../utils/compressImage';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const TOTAL_STEPS = 11; // 0-based: 0=email … 10=video

const GENDER_OPTIONS = [
  { key: 'Man',        emoji: '👨', label: 'Man' },
  { key: 'Woman',      emoji: '👩', label: 'Woman' },
  { key: 'Non-binary', emoji: '🌈', label: 'Non-binary' },
];

const LOOKING_FOR_OPTIONS = [
  { key: 'relationship', emoji: '💍', label: 'Long-term relationship' },
  { key: 'casual',       emoji: '☕', label: 'Something casual' },
  { key: 'friendship',   emoji: '👋', label: 'Friendship' },
  { key: 'unsure',       emoji: '🤔', label: 'Not sure yet' },
];

const SHOW_ME_OPTIONS = [
  { key: 'Men',   emoji: '👨', label: 'Men' },
  { key: 'Women', emoji: '👩', label: 'Women' },
];

const ALBANIAN_ORIGINS = [
  { key: 'Kosovë',            emoji: '🇽🇰' },
  { key: 'Shqipëri',          emoji: '🇦🇱' },
  { key: 'Maqedoni e Veriut', emoji: '🇲🇰' },
  { key: 'Mali i Zi',         emoji: '🇲🇪' },
  { key: 'Preshevë / Luginë', emoji: '🌍' },
  { key: 'Diaspora',          emoji: '✈️' },
];

const ALL_INTERESTS = [
  'Hiking', 'Coffee', 'Photography', 'Live Music', 'Travel', 'Cooking',
  'Reading', 'Fitness', 'Art', 'Gaming', 'Movies', 'Dogs', 'Yoga',
  'Dancing', 'Muzikë', 'Udhëtime', 'Gatim', 'Natyrë',
];

export default function SignupScreen({ navigation }) {
  const [step, setStep]               = useState(0);
  const [loading, setLoading]         = useState(false);

  // Form state
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [name, setName]               = useState('');
  const [dob, setDob]                 = useState(new Date(2000, 0, 1));
  const [gender, setGender]           = useState('');
  const [lookingFor, setLookingFor]   = useState('');
  const [showMeGender, setShowMeGender] = useState('');
  const [location, setLocation]       = useState('');
  const [hometown, setHometown]       = useState('');
  const [interests, setInterests]     = useState([]);
  const [photoUri, setPhotoUri]       = useState(null);   // local compressed URI
  const [videoUri, setVideoUri]       = useState(null);
  const [userId, setUserId]           = useState(null);

  const goNext = () => setStep(s => Math.min(s + 1, TOTAL_STEPS));
  const goBack = () => {
    if (step === 0) navigation.goBack();
    else setStep(s => s - 1);
  };

  const toggleInterest = (tag) => {
    if (interests.includes(tag)) {
      setInterests(interests.filter(t => t !== tag));
    } else if (interests.length < 6) {
      setInterests([...interests, tag]);
      Haptics.selectionAsync();
    } else {
      Alert.alert('Max 6 interests', 'Remove one before adding another.');
    }
  };

  // ── Step 0: Email ────────────────────────────────────────────
  // ── Step 1: Password ─────────────────────────────────────────
  // (Creates the auth user on step 1 completion)
  const createAuthUser = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      setUserId(data.user?.id);
      goNext();
    } catch (e) {
      Alert.alert('Sign up failed', e.message);
    }
    setLoading(false);
  };

  // ── Step 9: Pick + compress + upload avatar ──────────────────
  const pickAvatar = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to add a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 1,
    });
    if (result.canceled) return;

    setLoading(true);
    try {
      // Compress before setting — max 800px wide, 70% JPEG
      const compressed = await compressImage(result.assets[0].uri);
      setPhotoUri(compressed);
    } catch (e) {
      Alert.alert('Could not process image', e.message);
    }
    setLoading(false);
  }, []);

  const uploadAvatar = useCallback(async () => {
    if (!photoUri || !userId) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append('file', { uri: photoUri, name: 'avatar.jpg', type: 'image/jpeg' });

      const res = await fetch(
        `https://cpthnynbdrkesxfdlmdv.supabase.co/storage/v1/object/avatars/${userId}/avatar.jpg`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Cache-Control': '31536000',  // aggressive CDN caching
            'x-upsert': 'true',
          },
          body: formData,
        }
      );
      if (!res.ok) throw new Error(await res.text());
      goNext();
    } catch (e) {
      Alert.alert('Upload failed', e.message);
    }
    setLoading(false);
  }, [photoUri, userId]);

  // ── Step 10: Pick + upload video ─────────────────────────────
  const pickVideo = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 0.4,
      videoMaxDuration: 15,
    });
    if (result.canceled) return;
    if (result.assets[0].duration > 15000) {
      Alert.alert('Video too long', 'Please choose a video under 15 seconds.');
      return;
    }
    setVideoUri(result.assets[0].uri);
  }, []);

  // ── Final step: create profile row + upload video ────────────
  const finishSignup = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Upload video if provided
      if (videoUri) {
        const formData = new FormData();
        formData.append('file', { uri: videoUri, name: 'profile.mp4', type: 'video/mp4' });
        const res = await fetch(
          `https://cpthnynbdrkesxfdlmdv.supabase.co/storage/v1/object/videos/${userId}/profile.mp4`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Cache-Control': '31536000',
              'x-upsert': 'true',
            },
            body: formData,
          }
        );
        if (!res.ok) throw new Error(await res.text());
      }

      // Calculate age from dob
      const diff = Date.now() - dob.getTime();
      const age  = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));

      // Create profile row.
      // photo_count starts at 1 (just the avatar uploaded in step 9).
      await supabase.from('profiles').upsert({
        id: userId,
        name: name.trim(),
        age,
        dob: dob.toISOString().split('T')[0],
        gender,
        location: location.trim(),
        hometown: hometown || null,
        interests: interests.join(', '),
        looking_for: lookingFor,
        looking_for_gender: showMeGender,
        photo_count: 1,          // avatar.jpg was uploaded; extras added in ProfileScreen
        has_video: !!videoUri,
        signup_complete: true,
        age_confirmed: true,
        age_confirmed_at: new Date().toISOString(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigation handled by RootNavigator auth listener
    } catch (e) {
      Alert.alert('Could not complete signup', e.message);
    }
    setLoading(false);
  }, [userId, videoUri, name, dob, gender, location, hometown, interests, lookingFor, showMeGender]);

  // ─────────────────────────────────────────────────────────────
  // Render steps
  // ─────────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {

      // ── 0: Email ─────────────────────────────────────────────
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>What's your email?</Text>
            <View style={styles.inputWrap}>
              <Feather name="mail" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
            <TouchableOpacity
              style={[styles.btn, !email.trim() && styles.btnDisabled]}
              onPress={goNext}
              disabled={!email.trim()}
            >
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      // ── 1: Password ───────────────────────────────────────────
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Create a password</Text>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoComplete="new-password"
              />
            </View>
            <TouchableOpacity
              style={[styles.btn, (password.length < 8 || loading) && styles.btnDisabled]}
              onPress={createAuthUser}
              disabled={password.length < 8 || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Create account</Text>}
            </TouchableOpacity>
          </View>
        );

      // ── 2: Name ───────────────────────────────────────────────
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>What's your name?</Text>
            <View style={styles.inputWrap}>
              <Feather name="user" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="First name"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />
            </View>
            <TouchableOpacity
              style={[styles.btn, !name.trim() && styles.btnDisabled]}
              onPress={goNext}
              disabled={!name.trim()}
            >
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      // ── 3: Date of birth ──────────────────────────────────────
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>When's your birthday?</Text>
            <DateTimePicker
              value={dob}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, d) => d && setDob(d)}
              maximumDate={new Date(Date.now() - 18 * 365.25 * 24 * 3600 * 1000)}
              themeVariant="dark"
            />
            <TouchableOpacity style={styles.btn} onPress={goNext}>
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      // ── 4: Gender ─────────────────────────────────────────────
      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>I am a…</Text>
            {GENDER_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionRow, gender === opt.key && styles.optionRowActive]}
                onPress={() => { setGender(opt.key); Haptics.selectionAsync(); }}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <Text style={[styles.optionLabel, gender === opt.key && styles.optionLabelActive]}>
                  {opt.label}
                </Text>
                {gender === opt.key && <Feather name="check" size={16} color={colors.accent} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.btn, !gender && styles.btnDisabled]}
              onPress={goNext}
              disabled={!gender}
            >
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      // ── 5: Looking for ────────────────────────────────────────
      case 5:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Looking for…</Text>
            {LOOKING_FOR_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionRow, lookingFor === opt.key && styles.optionRowActive]}
                onPress={() => { setLookingFor(opt.key); Haptics.selectionAsync(); }}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <Text style={[styles.optionLabel, lookingFor === opt.key && styles.optionLabelActive]}>
                  {opt.label}
                </Text>
                {lookingFor === opt.key && <Feather name="check" size={16} color={colors.accent} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.btn, !lookingFor && styles.btnDisabled]}
              onPress={goNext}
              disabled={!lookingFor}
            >
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      // ── 6: Show me ────────────────────────────────────────────
      case 6:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Show me…</Text>
            {SHOW_ME_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionRow, showMeGender === opt.key && styles.optionRowActive]}
                onPress={() => { setShowMeGender(opt.key); Haptics.selectionAsync(); }}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <Text style={[styles.optionLabel, showMeGender === opt.key && styles.optionLabelActive]}>
                  {opt.label}
                </Text>
                {showMeGender === opt.key && <Feather name="check" size={16} color={colors.accent} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.btn, !showMeGender && styles.btnDisabled]}
              onPress={goNext}
              disabled={!showMeGender}
            >
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      // ── 7: Location + Albanian origin ─────────────────────────
      case 7:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Where are you?</Text>
            <View style={styles.inputWrap}>
              <Feather name="map-pin" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="City, Country"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <Text style={[styles.label, { marginTop: 16 }]}>Albanian origin</Text>
            <View style={styles.chipGrid}>
              {ALBANIAN_ORIGINS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.chip, hometown === opt.key && styles.chipActive]}
                  onPress={() => { setHometown(opt.key); Haptics.selectionAsync(); }}
                >
                  <Text>{opt.emoji}</Text>
                  <Text style={[styles.chipText, hometown === opt.key && styles.chipTextActive]}>
                    {opt.key}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.btn, !location.trim() && styles.btnDisabled]}
              onPress={goNext}
              disabled={!location.trim()}
            >
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      // ── 8: Interests ──────────────────────────────────────────
      case 8:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Your interests</Text>
            <Text style={styles.stepSub}>Pick up to 6</Text>
            <View style={styles.chipGrid}>
              {ALL_INTERESTS.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.chip, interests.includes(tag) && styles.chipActive]}
                  onPress={() => toggleInterest(tag)}
                >
                  <Text style={[styles.chipText, interests.includes(tag) && styles.chipTextActive]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.btn} onPress={goNext}>
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      // ── 9: Photo ──────────────────────────────────────────────
      case 9:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Add your best photo</Text>
            <Text style={styles.stepSub}>You can add more later</Text>

            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.avatarPreview}
                cachePolicy="memory"   // local compressed URI — memory cache is fine
                recyclingKey="signup_avatar_preview"
                contentFit="cover"
              />
            ) : (
              <TouchableOpacity style={styles.photoPlaceholder} onPress={pickAvatar}>
                <Feather name="camera" size={36} color={colors.textMuted} />
                <Text style={styles.photoPlaceholderText}>Tap to choose a photo</Text>
              </TouchableOpacity>
            )}

            {photoUri && (
              <TouchableOpacity style={styles.changePhoto} onPress={pickAvatar}>
                <Text style={styles.changePhotoText}>Change photo</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.btn, (!photoUri || loading) && styles.btnDisabled]}
              onPress={uploadAvatar}
              disabled={!photoUri || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Upload & continue</Text>}
            </TouchableOpacity>
          </View>
        );

      // ── 10: Video ─────────────────────────────────────────────
      case 10:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Add a short video</Text>
            <Text style={styles.stepSub}>Max 15 seconds — shows your personality</Text>

            {videoUri
              ? <Text style={styles.videoSelected}>✓ Video selected</Text>
              : (
                <TouchableOpacity style={styles.photoPlaceholder} onPress={pickVideo}>
                  <Feather name="video" size={36} color={colors.textMuted} />
                  <Text style={styles.photoPlaceholderText}>Tap to choose a video</Text>
                </TouchableOpacity>
              )}

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={finishSignup}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>{videoUri ? 'Finish' : 'Skip & finish'}</Text>}
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  // ── Progress bar ─────────────────────────────────────────────
  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: colors.bg },
  header:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  backBtn:            { padding: 4 },
  progressTrack:      { flex: 1, height: 4, backgroundColor: colors.bgSurface, borderRadius: 2, overflow: 'hidden' },
  progressFill:       { height: '100%', backgroundColor: colors.accent, borderRadius: 2 },
  scroll:             { padding: 24, paddingBottom: 48 },
  stepContent:        { gap: 16 },
  stepTitle:          { color: colors.textPrimary, fontSize: 26, fontWeight: '700', marginBottom: 4 },
  stepSub:            { color: colors.textMuted, fontSize: 14, marginTop: -8 },
  label:              { color: colors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  inputWrap:          { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14 },
  inputIcon:          { marginRight: 10 },
  input:              { flex: 1, color: colors.textPrimary, fontSize: 16, paddingVertical: 14 },
  optionRow:          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bgSurface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 16 },
  optionRowActive:    { borderColor: colors.accentBorder, backgroundColor: colors.accentDim },
  optionEmoji:        { fontSize: 22 },
  optionLabel:        { flex: 1, color: colors.textSecondary, fontSize: 16 },
  optionLabelActive:  { color: colors.accent, fontWeight: '600' },
  chipGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:               { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.bgSurface, flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipActive:         { backgroundColor: colors.accentDim, borderColor: colors.accentBorder },
  chipText:           { color: colors.textSecondary, fontSize: 13 },
  chipTextActive:     { color: colors.accent, fontWeight: '500' },
  btn:                { backgroundColor: colors.accent, borderRadius: radius.full, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled:        { opacity: 0.4 },
  btnText:            { color: '#fff', fontSize: 16, fontWeight: '700' },
  avatarPreview:      { width: '100%', height: 320, borderRadius: radius.lg, backgroundColor: colors.bgSurface },
  photoPlaceholder:   { width: '100%', height: 220, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bgSurface },
  photoPlaceholderText: { color: colors.textMuted, fontSize: 14 },
  changePhoto:        { alignSelf: 'center' },
  changePhotoText:    { color: colors.accent, fontSize: 14 },
  videoSelected:      { color: '#4CAF50', fontSize: 16, textAlign: 'center', paddingVertical: 20 },
});
