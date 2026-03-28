import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 60 }, (_, i) => currentYear - 18 - i);

const STEPS = ['Account', 'Birthday', 'About you', 'Looking for', 'Your photo', 'Your video', 'Done'];

export default function SignupScreen({ navigation }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const [birthDay, setBirthDay] = useState(null);
  const [birthMonth, setBirthMonth] = useState(null);
  const [birthYear, setBirthYear] = useState(null);

  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [location, setLocation] = useState('');
  const [hometown, setHometown] = useState('');
  const [country, setCountry] = useState('');
  const [diasporaMode, setDiasporaMode] = useState(false);

  const [lookingFor, setLookingFor] = useState('');
  const [lookingForGender, setLookingForGender] = useState('');
  const [hobbies, setHobbies] = useState([]);

  const [photoUri, setPhotoUri] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [videoUri, setVideoUri] = useState(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const ALL_HOBBIES = [
    'Muzikë 🎵', 'Udhëtime ✈️', 'Fitness 💪', 'Gatim 🍳', 'Art 🎨',
    'Lexim 📚', 'Gaming 🎮', 'Fotografi 📸', 'Valle 💃', 'Natyrë 🏔️',
    'Filma 🎬', 'Kafja ☕', 'Futboll ⚽', 'Plazh 🏖️', 'Familje 👨‍👩‍👧',
    'Teknologji 💻', 'Muzikë Shqip 🎤', 'Kuzhina Shqipe 🥘', 'Historia 🏛️', 'Mode 👗',
  ];

  const toggleHobby = (h) => {
    Haptics.selectionAsync();
    if (hobbies.includes(h)) setHobbies(hobbies.filter(x => x !== h));
    else if (hobbies.length < 6) setHobbies([...hobbies, h]);
    else Alert.alert('Max 6', 'Remove one before adding another.');
  };

  const progress = (step / (STEPS.length - 1)) * 100;

  const goNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (step === 0) {
      if (!email.trim()) return Alert.alert('Required', 'Please enter your email.');
      if (!password.trim() || password.length < 6) return Alert.alert('Required', 'Password must be at least 6 characters.');
      if (!agreed) return Alert.alert('Required', 'Please agree to the Terms and Privacy Policy.');
    }
    if (step === 1) {
      if (!birthDay || !birthMonth || !birthYear) return Alert.alert('Required', 'Please select your full date of birth.');
      const age = currentYear - birthYear;
      if (age < 18) return Alert.alert('Must be 18+', 'You must be at least 18 to use Dashni.');
    }
    if (step === 2) {
      if (!name.trim()) return Alert.alert('Required', 'Please enter your name.');
      if (!gender) return Alert.alert('Required', 'Please select your gender.');
      if (!location.trim()) return Alert.alert('Required', 'Please enter your city.');
    }
    if (step === 3) {
      if (!lookingFor) return Alert.alert('Required', 'Please select what you are looking for.');
      if (!lookingForGender) return Alert.alert('Required', 'Please select who you want to meet.');
      if (hobbies.length === 0) return Alert.alert('Required', 'Please select at least one interest.');
    }
    if (step === 4) {
      if (!photoUri) return Alert.alert('Required', 'Please add a profile photo.');
      setStep(5);
      return;
    }
    if (step === 5) {
      if (!videoUri) return Alert.alert('Video required', 'Please add a video profile — it helps people see the real you and prevents fake accounts.');
      await createAccount();
      return;
    }

    setStep(s => s + 1);
  };

  const createAccount = async () => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(), password,
      });
      if (authError) throw authError;
      const user = authData.user;
      if (!user) throw new Error('Account creation failed');

      const age = currentYear - birthYear;
      const dob = `${birthYear}-${String(birthMonth + 1).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;

      await supabase.from('profiles').upsert({
        id: user.id,
        name: name.trim(),
        age,
        gender,
        location: location.trim(),
        interests: hobbies.map(h => h.split(' ')[0]).join(', '),
        looking_for: lookingFor,
        looking_for_gender: lookingForGender,
        age_confirmed: true,
        age_confirmed_at: new Date().toISOString(),
        hometown: hometown.trim(),
        country: country.trim(),
        diaspora_mode: diasporaMode,
      });

      if (photoUri) {
        const { data: { session } } = await supabase.auth.getSession();
        const formData = new FormData();
        formData.append('file', { uri: photoUri, name: 'avatar.jpg', type: 'image/jpeg' });
        await fetch(
          `https://cpthnynbdrkesxfdlmdv.supabase.co/storage/v1/object/avatars/${user.id}/avatar.jpg`,
          { method: 'POST', headers: { 'Authorization': `Bearer ${session.access_token}`, 'x-upsert': 'true' }, body: formData }
        );
      }

      // Upload video if provided
      if (videoUri) {
        const { data: { session: vidSession } } = await supabase.auth.getSession();
        const vForm = new FormData();
        vForm.append('file', { uri: videoUri, name: 'profile.mp4', type: 'video/mp4' });
        const vRes = await fetch(
          `https://cpthnynbdrkesxfdlmdv.supabase.co/storage/v1/object/videos/${user.id}/profile.mp4`,
          { method: 'POST', headers: { 'Authorization': `Bearer ${vidSession.access_token}`, 'x-upsert': 'true' }, body: vForm }
        );
        if (vRes.ok) await supabase.from('profiles').update({ has_video: true }).eq('id', user.id);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep(6);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  };

  const pickPhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed', 'Allow photo library access.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.6,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed', 'Allow camera access.');
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [3, 4], quality: 0.6,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        {step > 0 && step < 6 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
            <Feather name="arrow-left" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        )}

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <View style={styles.logoRow}>
            <Image source={require('../../assets/icon.png')} style={styles.logoImg} />
            <Text style={styles.appName}>Dashni</Text>
          </View>

          {/* ── STEP 0: Account ── */}
          {step === 0 && <>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.sub}>Join Dashni — find your match</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <Feather name="mail" size={17} color={colors.textMuted} />
                <TextInput style={styles.input} value={email} onChangeText={setEmail}
                  placeholder="your@email.com" placeholderTextColor={colors.textMuted}
                  keyboardType="email-address" autoCapitalize="none" />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Feather name="lock" size={17} color={colors.textMuted} />
                <TextInput style={[styles.input, { flex: 1 }]} value={password} onChangeText={setPassword}
                  placeholder="Min. 6 characters" placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword} autoCapitalize="none" />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={17} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={styles.checkRow} onPress={() => setAgreed(!agreed)}>
              <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
                {agreed && <Feather name="check" size={12} color="#fff" />}
              </View>
              <Text style={styles.checkText}>
                I agree to the{' '}
                <Text style={styles.link} onPress={() => navigation.navigate('Legal', { type: 'terms' })}>Terms</Text>
                {' '}and{' '}
                <Text style={styles.link} onPress={() => navigation.navigate('Legal', { type: 'privacy' })}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginHint}>Already have an account? <Text style={styles.link}>Log in</Text></Text>
            </TouchableOpacity>
          </>}

          {/* ── STEP 1: Birthday ── */}
          {step === 1 && <>
            <Text style={styles.title}>Your birthday</Text>
            <Text style={styles.sub}>You must be 18 or older</Text>

            {/* Day picker */}
            <View style={styles.field}>
              <Text style={styles.label}>Day</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.pickerRow}>
                  {DAYS.map(d => (
                    <TouchableOpacity key={d}
                      style={[styles.pickerItem, birthDay === d && styles.pickerItemOn]}
                      onPress={() => { setBirthDay(d); Haptics.selectionAsync(); }}>
                      <Text style={[styles.pickerText, birthDay === d && styles.pickerTextOn]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Month picker */}
            <View style={styles.field}>
              <Text style={styles.label}>Month</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.pickerRow}>
                  {MONTHS.map((m, i) => (
                    <TouchableOpacity key={m}
                      style={[styles.pickerItem, styles.pickerItemWide, birthMonth === i && styles.pickerItemOn]}
                      onPress={() => { setBirthMonth(i); Haptics.selectionAsync(); }}>
                      <Text style={[styles.pickerText, birthMonth === i && styles.pickerTextOn]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Year picker */}
            <View style={styles.field}>
              <Text style={styles.label}>Year</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.pickerRow}>
                  {YEARS.map(y => (
                    <TouchableOpacity key={y}
                      style={[styles.pickerItem, styles.pickerItemWide, birthYear === y && styles.pickerItemOn]}
                      onPress={() => { setBirthYear(y); Haptics.selectionAsync(); }}>
                      <Text style={[styles.pickerText, birthYear === y && styles.pickerTextOn]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {birthDay && birthMonth !== null && birthYear && (
              <View style={styles.dobPreview}>
                <Ionicons name="checkmark-circle" size={18} color="#4caf50" />
                <Text style={styles.dobPreviewText}>
                  {MONTHS[birthMonth]} {birthDay}, {birthYear} · Age {currentYear - birthYear}
                </Text>
              </View>
            )}
          </>}

          {/* ── STEP 2: About you ── */}
          {step === 2 && <>
            <Text style={styles.title}>About you</Text>
            <Text style={styles.sub}>This is what people will see on your profile</Text>
            <View style={styles.field}>
              <Text style={styles.label}>First name <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputWrap}>
                <Feather name="user" size={17} color={colors.textMuted} />
                <TextInput style={styles.input} value={name} onChangeText={setName}
                  placeholder="Your first name" placeholderTextColor={colors.textMuted} />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>I am a <Text style={styles.required}>*</Text></Text>
              <View style={styles.genderRow}>
                {['Man', 'Woman', 'Other'].map(g => (
                  <TouchableOpacity key={g} style={[styles.optBtn, gender === g && styles.optBtnOn]}
                    onPress={() => { setGender(g); Haptics.selectionAsync(); }}>
                    <Text style={[styles.optBtnText, gender === g && styles.optBtnTextOn]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>City you live in <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputWrap}>
                <Feather name="map-pin" size={17} color={colors.textMuted} />
                <TextInput style={styles.input} value={location} onChangeText={setLocation}
                  placeholder="e.g. London, Berlin, New York" placeholderTextColor={colors.textMuted} />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Where are you originally from?</Text>
              <View style={styles.inputWrap}>
                <Feather name="home" size={17} color={colors.textMuted} />
                <TextInput style={styles.input} value={hometown} onChangeText={setHometown}
                  placeholder="e.g. Shkodër, Prishtinë, Vlorë" placeholderTextColor={colors.textMuted} />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Country you live in</Text>
              <View style={styles.inputWrap}>
                <Feather name="globe" size={17} color={colors.textMuted} />
                <TextInput style={styles.input} value={country} onChangeText={setCountry}
                  placeholder="e.g. United Kingdom, Germany, USA" placeholderTextColor={colors.textMuted} />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Are you in the diaspora?</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: -4 }}>
                Diaspora mode shows you Albanians worldwide, not just near you
              </Text>
              <View style={styles.diasporaRow}>
                <TouchableOpacity
                  style={[styles.diasporaBtn, !diasporaMode && styles.diasporaBtnOn]}
                  onPress={() => { setDiasporaMode(false); Haptics.selectionAsync(); }}
                >
                  <Text style={styles.diasporaFlag}>🇦🇱</Text>
                  <Text style={[styles.diasporaBtnText, !diasporaMode && styles.diasporaBtnTextOn]}>I'm in Albania/Kosovo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.diasporaBtn, diasporaMode && styles.diasporaBtnOn]}
                  onPress={() => { setDiasporaMode(true); Haptics.selectionAsync(); }}
                >
                  <Text style={styles.diasporaFlag}>✈️</Text>
                  <Text style={[styles.diasporaBtnText, diasporaMode && styles.diasporaBtnTextOn]}>I'm in the diaspora</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>}

          {/* ── STEP 3: Looking for ── */}
          {step === 3 && <>
            <Text style={styles.title}>What are you looking for?</Text>
            <Text style={styles.sub}>Be honest — it helps find your best match</Text>

            <View style={styles.field}>
              <Text style={styles.label}>I am looking for <Text style={styles.required}>*</Text></Text>
              {[
                { key: 'relationship', label: '💍 Long-term relationship' },
                { key: 'casual', label: '☕ Casual dating' },
                { key: 'friendship', label: '👋 New friendships' },
                { key: 'unsure', label: '🤔 Not sure yet' },
              ].map(opt => (
                <TouchableOpacity key={opt.key}
                  style={[styles.optionCard, lookingFor === opt.key && styles.optionCardOn]}
                  onPress={() => { setLookingFor(opt.key); Haptics.selectionAsync(); }}>
                  <Text style={[styles.optionLabel, lookingFor === opt.key && styles.optionLabelOn]}>{opt.label}</Text>
                  {lookingFor === opt.key && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>I want to meet <Text style={styles.required}>*</Text></Text>
              <View style={styles.genderRow}>
                {['Men', 'Women', 'Everyone'].map(g => (
                  <TouchableOpacity key={g} style={[styles.optBtn, lookingForGender === g && styles.optBtnOn]}
                    onPress={() => { setLookingForGender(g); Haptics.selectionAsync(); }}>
                    <Text style={[styles.optBtnText, lookingForGender === g && styles.optBtnTextOn]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Interests <Text style={styles.required}>*</Text> <Text style={styles.labelHint}>(pick at least 1, max 6)</Text></Text>
              <View style={styles.hobbiesGrid}>
                {ALL_HOBBIES.map(h => (
                  <TouchableOpacity key={h} style={[styles.hobbyChip, hobbies.includes(h) && styles.hobbyChipOn]}
                    onPress={() => toggleHobby(h)}>
                    <Text style={[styles.hobbyText, hobbies.includes(h) && styles.hobbyTextOn]}>{h}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>}

          {/* ── STEP 4: Photo ── */}
          {step === 4 && <>
            <Text style={styles.title}>Add your photo</Text>
            <Text style={styles.sub}>Required — show your best self</Text>

            <TouchableOpacity style={styles.photoBox} onPress={pickPhoto} activeOpacity={0.9}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={styles.photoEmpty}>
                  <Feather name="camera" size={44} color={colors.textMuted} />
                  <Text style={styles.photoEmptyText}>Tap to add photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.photoBtns}>
              <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
                <Feather name="image" size={18} color={colors.textPrimary} />
                <Text style={styles.photoBtnText}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                <Feather name="camera" size={18} color={colors.textPrimary} />
                <Text style={styles.photoBtnText}>Camera</Text>
              </TouchableOpacity>
            </View>
          </>}

          {/* ── STEP 5: Video (optional) ── */}
          {step === 5 && <>
            <Text style={styles.title}>Add your video 🎥</Text>
            <Text style={styles.sub}>Required — this is what makes Dashni different. Show the real you in 15 seconds.</Text>
            <View style={styles.requiredBadge}>
              <Feather name="alert-circle" size={14} color="#ff9800" />
              <Text style={styles.requiredText}>Required — no fake profiles allowed on Dashni</Text>
            </View>
            {videoUri ? (
              <View style={styles.videoPreviewBox}>
                <Ionicons name="checkmark-circle" size={40} color="#4caf50" />
                <Text style={styles.videoReadyText}>Video ready! ✅</Text>
                <TouchableOpacity onPress={() => setVideoUri(null)}>
                  <Text style={{ color: colors.accent, fontSize: 13 }}>Choose different video</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
              <View style={styles.contentWarning}>
                <Feather name="shield" size={15} color={colors.textMuted} />
                <Text style={styles.contentWarningText}>
                  By uploading you confirm this video contains no nudity, violence, or offensive content and complies with our Community Guidelines.
                </Text>
              </View>
              <View style={styles.videoBtns}>
                <TouchableOpacity style={styles.videoBtn} onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const { status } = await ImagePicker.requestCameraPermissionsAsync();
                  if (status !== 'granted') return Alert.alert('Permission needed');
                  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], allowsEditing: true, quality: 0.4, videoMaxDuration: 15 });
                  if (!r.canceled) setVideoUri(r.assets[0].uri);
                }}>
                  <Feather name="video" size={18} color={colors.textPrimary} />
                  <Text style={styles.videoBtnText}>Record</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.videoBtn} onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (status !== 'granted') return Alert.alert('Permission needed');
                  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: true, quality: 0.4, videoMaxDuration: 15 });
                  if (!r.canceled) setVideoUri(r.assets[0].uri);
                }}>
                  <Feather name="film" size={18} color={colors.textPrimary} />
                  <Text style={styles.videoBtnText}>Gallery</Text>
                </TouchableOpacity>
              </View>
              </>
            )}
            <View style={styles.tipsBox}>
              <Text style={styles.tipsTitle}>Tips for a great video</Text>
              <Text style={styles.tip}>💡 Good lighting makes a huge difference</Text>
              <Text style={styles.tip}>🎤 Say a few words about yourself</Text>
              <Text style={styles.tip}>😊 Be natural and smile!</Text>
            </View>
          </>}

          {/* ── STEP 6: Done ── */}
          {step === 6 && <>
            <View style={styles.doneWrap}>
              <View style={styles.doneCircle}><Text style={{ fontSize: 52 }}>🎉</Text></View>
              <Text style={styles.doneTitle}>Welcome, {name}!</Text>
              <Text style={styles.doneSub}>Your profile is live. Start swiping and find your match!</Text>
            </View>
          </>}

          {/* Continue button */}
          {step < 6 && (
            <TouchableOpacity
              style={[styles.nextBtn, loading && { opacity: 0.6 }]}
              onPress={goNext}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.nextBtnText}>
                    {step === 5 ? 'Create account →' : 'Continue →'}
                  </Text>
              }
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  progressBar: { height: 3, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  backBtn: { padding: 16, paddingBottom: 0 },
  scroll: { padding: 24, gap: 20, paddingBottom: 60 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoImg: { width: 34, height: 34, borderRadius: 10 },
  appName: { fontSize: 20, fontWeight: '800', color: colors.accent },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: -8 },
  required: { color: colors.accent },
  labelHint: { color: colors.textMuted, fontWeight: '400', fontSize: 12 },
  field: { gap: 10 },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14 },
  input: { flex: 1, color: colors.textPrimary, fontSize: 15, paddingVertical: 13 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, flex: 1 },
  link: { color: colors.accent, fontWeight: '600' },
  loginHint: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },

  // Birthday pickers
  pickerRow: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  pickerItem: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  pickerItemWide: { width: 64 },
  pickerItemOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  pickerText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
  pickerTextOn: { color: '#fff', fontWeight: '700' },
  dobPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(76,175,80,0.1)', borderWidth: 1, borderColor: 'rgba(76,175,80,0.3)', borderRadius: radius.md, padding: 12 },
  dobPreviewText: { color: '#4caf50', fontSize: 14, fontWeight: '500' },

  // Gender / option buttons
  genderRow: { flexDirection: 'row', gap: 10 },
  optBtn: { flex: 1, paddingVertical: 13, borderRadius: radius.md, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  optBtnOn: { backgroundColor: colors.accentDim, borderColor: colors.accentBorder },
  optBtnText: { color: colors.textSecondary, fontSize: 14 },
  optBtnTextOn: { color: colors.accent, fontWeight: '600' },

  // Looking for
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, gap: 12 },
  optionCardOn: { backgroundColor: colors.accentDim, borderColor: colors.accentBorder },
  optionLabel: { color: colors.textPrimary, fontSize: 15, flex: 1 },
  optionLabelOn: { color: colors.accent, fontWeight: '600' },

  // Hobbies
  hobbiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hobbyChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.bgSurface },
  hobbyChipOn: { backgroundColor: colors.accentDim, borderColor: colors.accentBorder },
  hobbyText: { color: colors.textSecondary, fontSize: 13 },
  hobbyTextOn: { color: colors.accent, fontWeight: '500' },

  // Photo
  photoBox: { height: 320, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.bgCard, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  photoEmpty: { alignItems: 'center', gap: 12 },
  photoEmptyText: { color: colors.textMuted, fontSize: 16 },
  photoBtns: { flexDirection: 'row', gap: 12 },
  photoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 13 },
  photoBtnText: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },

  // Done
  doneWrap: { alignItems: 'center', gap: 16, paddingVertical: 30 },
  doneCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accentBorder, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  doneSub: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },

  diasporaRow: { gap: 10 },
  diasporaBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14 },
  diasporaBtnOn: { backgroundColor: colors.accentDim, borderColor: colors.accentBorder },
  diasporaFlag: { fontSize: 22 },
  diasporaBtnText: { color: colors.textSecondary, fontSize: 14, flex: 1 },
  diasporaBtnTextOn: { color: colors.accent, fontWeight: '600' },
  requiredBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,152,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,152,0,0.3)', borderRadius: radius.md, padding: 12 },
  requiredText: { color: '#ff9800', fontSize: 13, flex: 1 },
  contentWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12 },
  contentWarningText: { color: colors.textMuted, fontSize: 12, lineHeight: 18, flex: 1 },
  videoPreviewBox: { height: 160, borderRadius: radius.lg, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  videoReadyText: { color: '#4caf50', fontSize: 16, fontWeight: '700' },
  tipsBox: { backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6 },
  tipsTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tip: { color: colors.textPrimary, fontSize: 13 },
  nextBtn: { backgroundColor: colors.accent, borderRadius: radius.full, paddingVertical: 16, alignItems: 'center' },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
