import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

const ALL_TAGS = [
  'Hiking', 'Coffee', 'Photography', 'Live Music', 'Travel', 'Cooking',
  'Reading', 'Fitness', 'Art', 'Gaming', 'Movies', 'Dogs', 'Yoga',
  'Dancing', 'Muzikë', 'Udhëtime', 'Gatim', 'Natyrë',
];

const ALBANIAN_ORIGINS = [
  { key: 'Kosovë',               emoji: '🇽🇰' },
  { key: 'Shqipëri',             emoji: '🇦🇱' },
  { key: 'Maqedoni e Veriut',    emoji: '🇲🇰' },
  { key: 'Mali i Zi',            emoji: '🇲🇪' },
  { key: 'Preshevë / Luginë',    emoji: '🌍' },
  { key: 'Diaspora',             emoji: '✈️' },
];

// Gender options — must match values stored during SignupScreen (steps 4 & 6)
const GENDER_OPTIONS       = ['Man', 'Woman', 'Non-binary'];
const SHOW_ME_OPTIONS      = ['Men', 'Women'];

export default function EditProfileScreen({ navigation }) {
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [name, setName]                     = useState('');
  const [age, setAge]                       = useState('');
  const [location, setLocation]             = useState('');
  const [bio, setBio]                       = useState('');
  const [gender, setGender]                 = useState('');
  // ↓ exposed so users can update their preference post-signup
  const [lookingForGender, setLookingForGender] = useState('');
  const [selectedTags, setSelectedTags]     = useState([]);
  const [hometown, setHometown]             = useState('');

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setName(data.name || '');
        setAge(data.age ? String(data.age) : '');
        setLocation(data.location || '');
        setBio(data.bio || '');
        setGender(data.gender || '');
        setLookingForGender(data.looking_for_gender || '');
        setHometown(data.hometown || '');
        if (data.interests) {
          setSelectedTags(data.interests.split(',').map(t => t.trim()).filter(Boolean));
        }
      }
    } catch {
      // profile load failed silently
    }
    setLoading(false);
  };

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else if (selectedTags.length < 6) {
      setSelectedTags([...selectedTags, tag]);
    } else {
      Alert.alert('Max 6 interests', 'Remove one before adding another.');
    }
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter your name.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        name: name.trim(),
        age: age ? parseInt(age, 10) : null,
        location: location.trim(),
        hometown: hometown.trim(),
        bio: bio.trim(),
        gender,
        looking_for_gender: lookingForGender,   // ← persisted so DiscoverScreen filter stays correct
        interests: selectedTags.join(', '),
      });
      if (error) throw error;
      Alert.alert('Saved!', 'Your profile has been updated.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Save failed', e.message);
    }
    setSaving(false);
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit profile</Text>
          <TouchableOpacity onPress={save} style={styles.saveBtn} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color={colors.accent} />
              : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>First name</Text>
            <View style={styles.inputWrap}>
              <Feather name="user" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your first name"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          {/* Age */}
          <View style={styles.field}>
            <Text style={styles.label}>Age</Text>
            <View style={styles.inputWrap}>
              <Feather name="calendar" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                placeholder="Your age"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                maxLength={2}
              />
            </View>
          </View>

          {/* City */}
          <View style={styles.field}>
            <Text style={styles.label}>City</Text>
            <View style={styles.inputWrap}>
              <Feather name="map-pin" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="City, Country — e.g. London, UK"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          {/* Albanian origin */}
          <View style={styles.field}>
            <Text style={styles.label}>Albanian origin</Text>
            <View style={styles.originGrid}>
              {ALBANIAN_ORIGINS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.originChip, hometown === opt.key && styles.originChipOn]}
                  onPress={() => { setHometown(opt.key); Haptics.selectionAsync(); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.originEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.tagText, hometown === opt.key && styles.tagTextSelected]}>
                    {opt.key}
                  </Text>
                  {hometown === opt.key && (
                    <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Gender — "Other" changed to "Non-binary" to match SignupScreen values */}
          <View style={styles.field}>
            <Text style={styles.label}>I am a</Text>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderBtn, gender === g && styles.genderBtnActive]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Show me (looking_for_gender) ────────────────────────────
               This drives the mutual-preference filter in DiscoverScreen.
               Changing it here takes effect immediately on next feed load. */}
          <View style={styles.field}>
            <Text style={styles.label}>Show me</Text>
            <View style={styles.genderRow}>
              {SHOW_ME_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.genderBtn, lookingForGender === opt && styles.genderBtnActive]}
                  onPress={() => { setLookingForGender(opt); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.genderText, lookingForGender === opt && styles.genderTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Bio */}
          <View style={styles.field}>
            <Text style={styles.label}>About me</Text>
            <TextInput
              style={[styles.inputWrap, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell people about yourself..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={200}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{bio.length}/200</Text>
          </View>

          {/* Interests */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Interests <Text style={styles.labelSub}>(max 6)</Text>
            </Text>
            <View style={styles.tagsGrid}>
              {ALL_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tag, selectedTags.includes(tag) && styles.tagSelected]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextSelected]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.saveFullBtn} onPress={save} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveFullBtnText}>Save changes</Text>}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1, color: colors.textPrimary, fontSize: 17,
    fontWeight: '600', textAlign: 'center',
  },
  saveBtn: { padding: 4, minWidth: 40, alignItems: 'flex-end' },
  saveBtnText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  scroll: { padding: 20, gap: 18 },
  field: { gap: 8 },
  label: {
    color: colors.textSecondary, fontSize: 13, fontWeight: '600',
    letterSpacing: 0.3, textTransform: 'uppercase',
  },
  labelSub: {
    color: colors.textMuted, fontWeight: '400',
    textTransform: 'none', letterSpacing: 0, fontSize: 12,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgSurface, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: colors.textPrimary, fontSize: 15, paddingVertical: 13 },
  bioInput: {
    height: 110, paddingTop: 13, paddingBottom: 13,
    alignItems: 'flex-start', color: colors.textPrimary, fontSize: 15,
  },
  charCount: { color: colors.textMuted, fontSize: 11, textAlign: 'right' },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderBtn: {
    flex: 1, paddingVertical: 12, borderRadius: radius.md,
    backgroundColor: colors.bgSurface, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center',
  },
  genderBtnActive: { backgroundColor: colors.accentDim, borderColor: colors.accentBorder },
  genderText: { color: colors.textSecondary, fontSize: 14 },
  genderTextActive: { color: colors.accent, fontWeight: '600' },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    paddingVertical: 7, paddingHorizontal: 14, backgroundColor: colors.bgSurface,
  },
  tagSelected: { backgroundColor: colors.accentDim, borderColor: colors.accentBorder },
  tagText: { color: colors.textSecondary, fontSize: 13 },
  tagTextSelected: { color: colors.accent, fontWeight: '500' },
  saveFullBtn: {
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingVertical: 15, alignItems: 'center', marginTop: 8,
  },
  saveFullBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  originGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  originChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.bgSurface, borderWidth: 1.5,
    borderColor: colors.border, borderRadius: radius.full,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  originChipOn: { borderColor: colors.accentBorder, backgroundColor: colors.accentDim },
  originEmoji: { fontSize: 15 },
});
