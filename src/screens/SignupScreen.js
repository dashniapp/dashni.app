import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  Image, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import { colors, radius } from '../theme';
import { ignoreAuthChangeRef, onProfileCompleteRef } from '../navigation/RootNavigator';

const { width: W, height: H } = Dimensions.get('window');

const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = Array.from({ length: 31 }, (_, i) => i + 1);
const CUR_YEAR = new Date().getFullYear();
const YEARS  = Array.from({ length: 100 }, (_, i) => CUR_YEAR - 18 - i); // 18 to 118 years ago

const TOTAL_STEPS = 12; // 0..11

// ── Vertical spinning wheel column ───────────────────────────────────────────
const ITEM_H = 52;
const VISIBLE = 5; // must be odd
const PAD = ITEM_H * Math.floor(VISIBLE / 2);

function WheelColumn({ data, initialIndex = 0, onChange, formatLabel, width = 90 }) {
  const scrollRef   = useRef(null);
  const [activeIdx, setActiveIdx] = useState(initialIndex);
  const activeRef   = useRef(initialIndex); // sync ref to avoid stale closure

  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: initialIndex * ITEM_H, animated: false });
    }, 120);
    return () => clearTimeout(t);
  }, []); // only on mount

  const handleScrollEnd = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, data.length - 1));
    // Snap to exact row instantly (animated:false won't re-trigger scroll events)
    scrollRef.current?.scrollTo({ y: clamped * ITEM_H, animated: false });
    if (clamped !== activeRef.current) {
      activeRef.current = clamped;
      setActiveIdx(clamped);
      onChange(clamped);
      Haptics.selectionAsync();
    }
  };

  return (
    <View style={{ width, height: ITEM_H * VISIBLE, overflow: 'hidden' }}>
      <View pointerEvents="none" style={[wheel.highlight, { top: PAD }]} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingTop: PAD, paddingBottom: PAD }}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        nestedScrollEnabled
        scrollEventThrottle={16}
      >
        {data.map((item, i) => (
          <View key={i} style={wheel.item}>
            <Text style={[wheel.itemText, i === activeIdx && wheel.itemTextSelected]}>
              {formatLabel ? formatLabel(item) : String(item)}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View pointerEvents="none" style={[wheel.fade, wheel.fadeTop]} />
      <View pointerEvents="none" style={[wheel.fade, wheel.fadeBottom]} />
    </View>
  );
}

const wheel = StyleSheet.create({
  highlight: {
    position: 'absolute', left: 4, right: 4, height: ITEM_H,
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: 'rgba(255,107,107,0.5)',
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,107,0.07)',
  },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText: { color: 'rgba(255,255,255,0.3)', fontSize: 17 },
  itemTextSelected: { color: '#fff', fontSize: 22, fontWeight: '700' },
  fade: { position: 'absolute', left: 0, right: 0, height: PAD * 0.85, pointerEvents: 'none' },
  fadeTop: { top: 0, background: 'transparent' },
  fadeBottom: { bottom: 0 },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SignupScreen({ navigation }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 0 — email
  const [email, setEmail] = useState('');
  // Step 1 — password
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  // Step 2 — name
  const [name, setName] = useState('');
  // Step 3 — birthday (wheel indices)
  const [dayIdx,   setDayIdx]   = useState(0);
  const [monthIdx, setMonthIdx] = useState(0);
  const [yearIdx,  setYearIdx]  = useState(0);
  // Step 4 — gender
  const [gender, setGender] = useState('');
  // Step 5 — looking for
  const [lookingFor, setLookingFor] = useState('');
  // Step 6 — who to meet
  const [lookingForGender, setLookingForGender] = useState('');
  // Step 7 — city
  const [location, setLocation] = useState('');
  const [hometown, setHometown] = useState('');
  // Step 8 — interests
  const [hobbies, setHobbies] = useState([]);
  // Step 9 — photo
  const [photoUri, setPhotoUri] = useState(null);
  // Step 10 — video
  const [videoUri, setVideoUri] = useState(null);

  const ALL_HOBBIES = [
    'Muzikë 🎵', 'Udhëtime ✈️', 'Fitness 💪', 'Gatim 🍳', 'Art 🎨',
    'Lexim 📚', 'Gaming 🎮', 'Fotografi 📸', 'Valle 💃', 'Natyrë 🏔️',
    'Filma 🎬', 'Kafja ☕', 'Futboll ⚽', 'Plazh 🏖️', 'Familje 👨‍👩‍👧',
    'Teknologji 💻', 'Muzikë Shqip 🎤', 'Kuzhina Shqipe 🥘', 'Historia 🏛️', 'Mode 👗',
  ];

  const progress = step / (TOTAL_STEPS - 1);

  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(s => s - 1);
  };

  const advance = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(s => s + 1);
  };

  const validate = () => {
    switch (step) {
      case 0:
        if (!email.trim() || !email.includes('@')) { Alert.alert('Required', 'Enter a valid email.'); return false; }
        break;
      case 1:
        if (password.length < 6) { Alert.alert('Required', 'Password must be at least 6 characters.'); return false; }
        break;
      case 2:
        if (!name.trim()) { Alert.alert('Required', 'Enter your first name.'); return false; }
        break;
      case 3: {
        const age = CUR_YEAR - YEARS[yearIdx];
        if (age < 18) { Alert.alert('Must be 18+', 'You must be at least 18 to use Dashni.'); return false; }
        break;
      }
      case 4:
        if (!gender) { Alert.alert('Required', 'Select your gender.'); return false; }
        break;
      case 5:
        if (!lookingFor) { Alert.alert('Required', 'Select what you are looking for.'); return false; }
        break;
      case 6:
        if (!lookingForGender) { Alert.alert('Required', 'Select who you want to meet.'); return false; }
        break;
      case 7:
        if (!location.trim()) { Alert.alert('Required', 'Enter your city.'); return false; }
        break;
      case 8:
        if (hobbies.length === 0) { Alert.alert('Required', 'Pick at least one interest.'); return false; }
        break;
      case 9:
        if (!photoUri) { Alert.alert('Required', 'Add your profile photo.'); return false; }
        break;
      case 10:
        if (!videoUri) { Alert.alert('Required', 'Add your profile video.'); return false; }
        break;
    }
    return true;
  };

  const handleContinue = async () => {
    if (!validate()) return;
    if (step === 10) {
      await createAccount();
    } else {
      advance();
    }
  };

  const createAccount = async () => {
    setLoading(true);
    ignoreAuthChangeRef.current = true; // block RootNavigator while uploads run
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(), password,
      });
      if (authError) throw authError;
      const user = authData.user;
      if (!user) throw new Error('Account creation failed');

      const age = CUR_YEAR - YEARS[yearIdx];
      const dob = `${YEARS[yearIdx]}-${String(monthIdx + 1).padStart(2, '0')}-${String(DAYS[dayIdx]).padStart(2, '0')}`;

      await supabase.from('profiles').upsert({
        id: user.id,
        name: name.trim(),
        age,
        gender,
        location: location.trim(),
        hometown: hometown.trim() || null,
        interests: hobbies.map(h => h.split(' ')[0]).join(', '),
        looking_for: lookingFor,
        looking_for_gender: lookingForGender,
        age_confirmed: true,
        age_confirmed_at: new Date().toISOString(),
      });

      // Upload photo
      const { data: { session } } = await supabase.auth.getSession();
      const photoForm = new FormData();
      photoForm.append('file', { uri: photoUri, name: 'avatar.jpg', type: 'image/jpeg' });
      await fetch(
        `${SUPABASE_URL}/storage/v1/object/avatars/${user.id}/avatar.jpg`,
        { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'x-upsert': 'true' }, body: photoForm }
      );

      // Upload video
      const videoForm = new FormData();
      videoForm.append('file', { uri: videoUri, name: 'profile.mp4', type: 'video/mp4' });
      const vRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/videos/${user.id}/profile.mp4`,
        { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'x-upsert': 'true' }, body: videoForm }
      );
      if (vRes.ok) await supabase.from('profiles').update({ has_video: true }).eq('id', user.id);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      ignoreAuthChangeRef.current = false;
      setStep(11);
    } catch (e) {
      ignoreAuthChangeRef.current = false;
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  };

  const pickPhoto = async (fromCamera = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return Alert.alert('Permission needed');
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [3, 4], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.7 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const pickVideo = async (fromCamera = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return Alert.alert('Permission needed');
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], allowsEditing: true, quality: 0.5, videoMaxDuration: 30 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: true, quality: 0.5, videoMaxDuration: 30 });
    if (!result.canceled) setVideoUri(result.assets[0].uri);
  };

  // ── Computed birthday age ──
  const age = CUR_YEAR - YEARS[yearIdx];

  // ── Render ────────────────────────────────────────────────────────────────
  const isDone = step === 11;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Progress dots */}
      {!isDone && (
        <View style={s.dotsBar}>
          {Array.from({ length: TOTAL_STEPS - 1 }).map((_, i) => (
            <View key={i} style={[s.dot, i < step && s.dotDone, i === step && s.dotActive]} />
          ))}
        </View>
      )}

      {/* Back button */}
      {step > 0 && !isDone && (
        <TouchableOpacity style={s.backBtn} onPress={goBack}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={step !== 3}
        >
          {/* ── Step 0: Email ── */}
          {step === 0 && (
            <StepShell title="What's your email?" sub="You'll use this to log in">
              <View style={s.inputWrap}>
                <Feather name="mail" size={18} color={colors.textMuted} />
                <TextInput
                  style={s.input} value={email} onChangeText={setEmail}
                  placeholder="your@email.com" placeholderTextColor={colors.textMuted}
                  keyboardType="email-address" autoCapitalize="none" autoFocus
                />
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ alignSelf: 'center', marginTop: 8 }}>
                <Text style={s.link}>Already have an account? Log in</Text>
              </TouchableOpacity>
            </StepShell>
          )}

          {/* ── Step 1: Password ── */}
          {step === 1 && (
            <StepShell title="Create a password" sub="At least 6 characters">
              <View style={s.inputWrap}>
                <Feather name="lock" size={18} color={colors.textMuted} />
                <TextInput
                  style={[s.input, { flex: 1 }]} value={password} onChangeText={setPassword}
                  placeholder="Min. 6 characters" placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPw} autoCapitalize="none" autoFocus
                />
                <TouchableOpacity onPress={() => setShowPw(v => !v)}>
                  <Feather name={showPw ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </StepShell>
          )}

          {/* ── Step 2: Name ── */}
          {step === 2 && (
            <StepShell title="What's your first name?" sub="This is how you'll appear to others">
              <View style={s.inputWrap}>
                <Feather name="user" size={18} color={colors.textMuted} />
                <TextInput
                  style={s.input} value={name} onChangeText={setName}
                  placeholder="First name" placeholderTextColor={colors.textMuted}
                  autoCapitalize="words" autoFocus
                />
              </View>
            </StepShell>
          )}

          {/* ── Step 3: Birthday (wheel) ── */}
          {step === 3 && (
            <StepShell title="When's your birthday?" sub="You must be 18 or older">
              <View style={s.wheelRow}>
                {/* Day */}
                <View style={s.wheelCol}>
                  <Text style={s.wheelLabel}>Day</Text>
                  <WheelColumn
                    data={DAYS}
                    initialIndex={dayIdx}
                    onChange={setDayIdx}
                    formatLabel={d => String(d)}
                    width={70}
                  />
                </View>
                {/* Month */}
                <View style={[s.wheelCol, { flex: 1 }]}>
                  <Text style={s.wheelLabel}>Month</Text>
                  <WheelColumn
                    data={MONTHS_FULL}
                    initialIndex={monthIdx}
                    onChange={setMonthIdx}
                    formatLabel={m => m}
                    width={W * 0.38}
                  />
                </View>
                {/* Year */}
                <View style={s.wheelCol}>
                  <Text style={s.wheelLabel}>Year</Text>
                  <WheelColumn
                    data={YEARS}
                    initialIndex={yearIdx}
                    onChange={setYearIdx}
                    formatLabel={y => String(y)}
                    width={80}
                  />
                </View>
              </View>
              <View style={s.agePill}>
                <Ionicons name="checkmark-circle" size={16} color={age >= 18 ? colors.accent : '#ff9800'} />
                <Text style={[s.agePillText, age < 18 && { color: '#ff9800' }]}>
                  {age >= 18 ? `You're ${age} years old` : `Must be 18+ · Currently ${age}`}
                </Text>
              </View>
            </StepShell>
          )}

          {/* ── Step 4: Gender ── */}
          {step === 4 && (
            <StepShell title="I am a..." sub="">
              <View style={s.bigCards}>
                {[
                  { key: 'Man',       emoji: '👨', label: 'Man' },
                  { key: 'Woman',     emoji: '👩', label: 'Woman' },
                  { key: 'Non-binary',emoji: '🌈', label: 'Non-binary' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[s.bigCard, gender === opt.key && s.bigCardOn]}
                    onPress={() => { setGender(opt.key); Haptics.selectionAsync(); }}
                    activeOpacity={0.8}
                  >
                    <Text style={s.bigCardEmoji}>{opt.emoji}</Text>
                    <Text style={[s.bigCardText, gender === opt.key && s.bigCardTextOn]}>{opt.label}</Text>
                    {gender === opt.key && (
                      <View style={s.bigCardCheck}>
                        <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </StepShell>
          )}

          {/* ── Step 5: Looking for ── */}
          {step === 5 && (
            <StepShell title="What are you looking for?" sub="Be honest — it helps find your best match">
              <View style={s.optionCards}>
                {[
                  { key: 'relationship', emoji: '💍', label: 'Long-term relationship' },
                  { key: 'casual',       emoji: '☕', label: 'Something casual' },
                  { key: 'friendship',   emoji: '👋', label: 'Friendship' },
                  { key: 'unsure',       emoji: '🤔', label: 'Not sure yet' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[s.optionCard, lookingFor === opt.key && s.optionCardOn]}
                    onPress={() => { setLookingFor(opt.key); Haptics.selectionAsync(); }}
                    activeOpacity={0.8}
                  >
                    <Text style={s.optionEmoji}>{opt.emoji}</Text>
                    <Text style={[s.optionLabel, lookingFor === opt.key && s.optionLabelOn]}>{opt.label}</Text>
                    {lookingFor === opt.key && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                  </TouchableOpacity>
                ))}
              </View>
            </StepShell>
          )}

          {/* ── Step 6: Who to meet ── */}
          {step === 6 && (
            <StepShell title="Who do you want to meet?" sub="">
              <View style={s.bigCards}>
                {[
                  { key: 'Men',   emoji: '👨', label: 'Men' },
                  { key: 'Women', emoji: '👩', label: 'Women' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[s.bigCard, lookingForGender === opt.key && s.bigCardOn]}
                    onPress={() => { setLookingForGender(opt.key); Haptics.selectionAsync(); }}
                    activeOpacity={0.8}
                  >
                    <Text style={s.bigCardEmoji}>{opt.emoji}</Text>
                    <Text style={[s.bigCardText, lookingForGender === opt.key && s.bigCardTextOn]}>{opt.label}</Text>
                    {lookingForGender === opt.key && (
                      <View style={s.bigCardCheck}>
                        <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </StepShell>
          )}

          {/* ── Step 7: City ── */}
          {step === 7 && (
            <StepShell title="What city are you in?" sub="This helps us show you nearby people">
              <View style={s.inputWrap}>
                <Feather name="map-pin" size={18} color={colors.textMuted} />
                <TextInput
                  style={s.input} value={location} onChangeText={setLocation}
                  placeholder="e.g. London, New York, Berlin" placeholderTextColor={colors.textMuted}
                  autoCapitalize="words" autoFocus
                />
              </View>
              <View style={s.inputWrap}>
                <Feather name="home" size={18} color={colors.textMuted} />
                <TextInput
                  style={s.input} value={hometown} onChangeText={setHometown}
                  placeholder="Hometown (optional) — e.g. Shkodër" placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                />
              </View>
            </StepShell>
          )}

          {/* ── Step 8: Interests ── */}
          {step === 8 && (
            <StepShell title="What are your interests?" sub={`Pick up to 6  ·  ${hobbies.length}/6 selected`}>
              <View style={s.hobbiesGrid}>
                {ALL_HOBBIES.map(h => {
                  const on = hobbies.includes(h);
                  return (
                    <TouchableOpacity
                      key={h}
                      style={[s.chip, on && s.chipOn]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        if (on) setHobbies(hobbies.filter(x => x !== h));
                        else if (hobbies.length < 6) setHobbies([...hobbies, h]);
                        else Alert.alert('Max 6', 'Remove one before adding another.');
                      }}
                    >
                      <Text style={[s.chipText, on && s.chipTextOn]}>{h}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </StepShell>
          )}

          {/* ── Step 9: Photo ── */}
          {step === 9 && (
            <StepShell title="Add your photo" sub="Required — show your best self">
              <TouchableOpacity style={s.photoBox} onPress={() => pickPhoto(false)} activeOpacity={0.9}>
                {photoUri
                  ? <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  : <View style={s.photoEmpty}>
                      <Feather name="camera" size={48} color={colors.textMuted} />
                      <Text style={s.photoEmptyText}>Tap to add photo</Text>
                    </View>
                }
              </TouchableOpacity>
              <View style={s.mediaBtns}>
                <TouchableOpacity style={s.mediaBtn} onPress={() => pickPhoto(false)}>
                  <Feather name="image" size={18} color={colors.textPrimary} />
                  <Text style={s.mediaBtnText}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.mediaBtn} onPress={() => pickPhoto(true)}>
                  <Feather name="camera" size={18} color={colors.textPrimary} />
                  <Text style={s.mediaBtnText}>Camera</Text>
                </TouchableOpacity>
              </View>
            </StepShell>
          )}

          {/* ── Step 10: Video ── */}
          {step === 10 && (
            <StepShell title="Add your video 🎥" sub="Show the real you in 15–30 seconds. Required — keeps Dashni fake-free.">
              {videoUri ? (
                <View style={s.videoReady}>
                  <Ionicons name="checkmark-circle" size={52} color={colors.accent} />
                  <Text style={s.videoReadyText}>Video ready!</Text>
                  <TouchableOpacity onPress={() => setVideoUri(null)}>
                    <Text style={s.link}>Choose a different video</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.mediaBtns}>
                  <TouchableOpacity style={[s.mediaBtn, { flex: 1, paddingVertical: 18 }]} onPress={() => pickVideo(true)}>
                    <Feather name="video" size={22} color={colors.textPrimary} />
                    <Text style={s.mediaBtnText}>Record</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.mediaBtn, { flex: 1, paddingVertical: 18 }]} onPress={() => pickVideo(false)}>
                    <Feather name="film" size={22} color={colors.textPrimary} />
                    <Text style={s.mediaBtnText}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={s.tipsBox}>
                <Text style={s.tipsTitle}>Tips for a great video</Text>
                <Text style={s.tip}>💡 Good lighting makes a huge difference</Text>
                <Text style={s.tip}>🎤 Say a few words about yourself</Text>
                <Text style={s.tip}>😊 Be natural and smile!</Text>
              </View>
            </StepShell>
          )}

          {/* ── Step 11: Done ── */}
          {step === 11 && (
            <View style={s.doneWrap}>
              <View style={s.doneCircle}><Text style={{ fontSize: 64 }}>🎉</Text></View>
              <Text style={s.doneTitle}>Welcome to Dashni, {name}!</Text>
              <Text style={s.doneSub}>Your profile is live. Start swiping and find your match!</Text>
              <TouchableOpacity
                style={s.nextBtn}
                onPress={() => onProfileCompleteRef.current?.()}
                activeOpacity={0.85}
              >
                <Text style={s.nextBtnText}>Start swiping →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Continue / Create button */}
          {step < 11 && (
            <TouchableOpacity
              style={[s.nextBtn, loading && { opacity: 0.6 }]}
              onPress={handleContinue}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.nextBtnText}>
                    {step === 10 ? 'Create my account →' : 'Continue →'}
                  </Text>
              }
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Step shell: title + children ─────────────────────────────────────────────
function StepShell({ title, sub, children }) {
  return (
    <View style={s.stepShell}>
      <Text style={s.title}>{title}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
      {children}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: colors.bg },
  scroll:   { paddingHorizontal: 24, paddingBottom: 40, flexGrow: 1 },
  stepShell:{ gap: 20, paddingTop: 16 },

  // Progress dots
  dotsBar:  { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingTop: 12, paddingHorizontal: 24 },
  dot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotDone:  { backgroundColor: colors.accentBorder },
  dotActive:{ width: 18, backgroundColor: colors.accent },

  // Back button
  backBtn:  { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },

  // Text
  title:    { color: colors.textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: 8 },
  sub:      { color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: -8 },
  link:     { color: colors.accent, fontWeight: '600', fontSize: 14 },

  // Text input
  inputWrap:{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14 },
  input:    { flex: 1, color: colors.textPrimary, fontSize: 16, paddingVertical: 15 },

  // Wheel picker
  wheelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, justifyContent: 'center', backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: colors.border },
  wheelCol: { alignItems: 'center', gap: 8 },
  wheelLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  agePill:  { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', backgroundColor: colors.bgCard, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border },
  agePillText: { color: colors.accent, fontSize: 14, fontWeight: '600' },

  // Big tappable cards (gender / who to meet)
  bigCards: { gap: 12 },
  bigCard:  { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.bgCard, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, padding: 20 },
  bigCardOn:{ borderColor: colors.accent, backgroundColor: colors.accentDim },
  bigCardEmoji: { fontSize: 28 },
  bigCardText:  { color: colors.textSecondary, fontSize: 17, fontWeight: '600', flex: 1 },
  bigCardTextOn:{ color: colors.textPrimary },
  bigCardCheck: { marginLeft: 'auto' },

  // Option cards (looking for)
  optionCards: { gap: 10 },
  optionCard:  { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.bgCard, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, padding: 18 },
  optionCardOn:{ borderColor: colors.accent, backgroundColor: colors.accentDim },
  optionEmoji: { fontSize: 24 },
  optionLabel: { color: colors.textSecondary, fontSize: 16, flex: 1 },
  optionLabelOn:{ color: colors.textPrimary, fontWeight: '600' },

  // Hobbies
  hobbiesGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip:         { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingVertical: 9, paddingHorizontal: 16, backgroundColor: colors.bgSurface },
  chipOn:       { backgroundColor: colors.accentDim, borderColor: colors.accentBorder },
  chipText:     { color: colors.textSecondary, fontSize: 13 },
  chipTextOn:   { color: colors.accent, fontWeight: '500' },

  // Photo
  photoBox:     { height: 300, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.bgCard, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  photoEmpty:   { alignItems: 'center', gap: 12 },
  photoEmptyText:{ color: colors.textMuted, fontSize: 15 },

  // Media buttons (photo / video)
  mediaBtns:    { flexDirection: 'row', gap: 12 },
  mediaBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 14 },
  mediaBtnText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },

  // Video ready state
  videoReady:   { alignItems: 'center', gap: 10, paddingVertical: 20, backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accentBorder },
  videoReadyText:{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' },

  // Tips
  tipsBox:   { backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 6 },
  tipsTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  tip:       { color: colors.textSecondary, fontSize: 13 },

  // Done
  doneWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingTop: 60 },
  doneCircle:{ width: 110, height: 110, borderRadius: 55, backgroundColor: colors.accentDim, borderWidth: 2, borderColor: colors.accentBorder, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  doneSub:   { color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },

  // Continue button
  nextBtn:     { backgroundColor: colors.accent, borderRadius: radius.full, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
