import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Alert,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const { width: SCREEN_W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// Egress optimisation constants
// ─────────────────────────────────────────────────────────────

// How many profiles to fetch from the DB per load.
// Was 50 — reduced to 15 to cut storage.list() calls by 70 %.
const BATCH_SIZE = 15;

// How many profiles to fully enrich (storage.list) up-front.
// The rest are enriched one-at-a-time as the user swipes toward them.
const EAGER_ENRICH = 5;

// Module-level cache: survives re-renders and screen re-mounts for the
// entire app session.  Key = profileId, value = resolved media payload.
// This means a profile whose media was fetched once is NEVER re-fetched,
// even if loadProfiles() runs again (filter change, preference update, etc.)
const mediaCache = new Map();

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const calcAge = (dob) => {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
};

const getFilters = async () => {
  try {
    const raw = await AsyncStorage.getItem('dashni_filters');
    const f = raw ? JSON.parse(raw) : {};
    return { ageMin: f.ageMin ?? 18, ageMax: f.ageMax ?? 99 };
  } catch {
    return { ageMin: 18, ageMax: 99 };
  }
};

// Fetches and caches media URLs for one profile.
// If the profile is already in the module-level cache, returns immediately
// without making any network request — zero egress for repeat views.
const resolveMedia = async (profileId, hasVideo) => {
  if (mediaCache.has(profileId)) return mediaCache.get(profileId);

  // ONE storage.list() call per profile (was firing for all 50 at once)
  const { data: photoFiles } = await supabase.storage
    .from('avatars').list(profileId, { limit: 10 });

  const photoUrls = (photoFiles || [])
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f.name))
    .sort((a, b) => {
      if (a.name === 'avatar.jpg') return -1;
      if (b.name === 'avatar.jpg') return 1;
      return a.name.localeCompare(b.name);
    })
    .map(f => {
      const { data: u } = supabase.storage
        .from('avatars').getPublicUrl(`${profileId}/${f.name}`);
      return u?.publicUrl || null;
    })
    .filter(Boolean);

  // getPublicUrl is a pure URL construction — no network call, no egress
  const { data: vi } = supabase.storage
    .from('videos').getPublicUrl(`${profileId}/profile.mp4`);
  const videoUrl = hasVideo && vi?.publicUrl ? vi.publicUrl : null;

  const mediaSlides = [
    ...photoUrls.map(url => ({ type: 'photo', url })),
    ...(videoUrl ? [{ type: 'video', url: videoUrl }] : []),
  ];
  if (mediaSlides.length === 0) mediaSlides.push({ type: 'empty' });

  const resolved = { photoUrls, photoUrl: photoUrls[0] || null, videoUrl, mediaSlides };
  mediaCache.set(profileId, resolved);
  return resolved;
};

// ─────────────────────────────────────────────────────────────
// DiscoverScreen
// ─────────────────────────────────────────────────────────────
export default function DiscoverScreen({ navigation, route }) {
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myPhotoUrl, setMyPhotoUrl] = useState(null);

  const profilesRef = useRef([]);
  const currentIndexRef = useRef(0);
  const userIdRef = useRef(null);
  // Guard: prevents a second loadProfiles() from firing while one is in flight
  const loadingRef = useRef(false);

  useEffect(() => { loadProfiles(); }, []);

  useEffect(() => {
    if (route.params?.filtersApplied) loadProfiles(true);
  }, [route.params?.filtersApplied]);

  useEffect(() => {
    if (route.params?.reloadFeed) loadProfiles(false);
  }, [route.params?.reloadFeed]);

  // ── Enrich a single raw profile row with media ───────────────
  // Uses the module-level cache so each profile is only ever fetched once.
  const enrichOne = useCallback(async (p) => {
    const media = await resolveMedia(p.id, p.has_video);
    return {
      ...p,
      ...media,
      age: calcAge(p.dob) ?? p.age,
      initials: p.name?.[0]?.toUpperCase() ?? '?',
      tags: p.interests
        ? p.interests.split(',').map(t => t.trim()).filter(Boolean)
        : [],
      verified: p.verification_status === 'verified',
    };
  }, []);

  // ── Core profile loader ──────────────────────────────────────
  const loadProfiles = async (showSpinner = true) => {
    // Prevent duplicate concurrent fetches (e.g. two useEffects firing)
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (showSpinner) setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); loadingRef.current = false; return; }

      userIdRef.current = user.id;

      // Own avatar: getPublicUrl is pure URL construction — no network call
      if (!myPhotoUrl) {
        const { data: myPhoto } = supabase.storage
          .from('avatars').getPublicUrl(`${user.id}/avatar.jpg`);
        if (myPhoto?.publicUrl) setMyPhotoUrl(myPhoto.publicUrl);
      }

      // ── Fetch current user's preferences (1 DB call) ─────────
      const { data: me } = await supabase
        .from('profiles')
        .select('gender, looking_for_gender, is_admin')
        .eq('id', user.id)
        .single();

      const adminUser = me?.is_admin === true;
      setIsAdmin(adminUser);

      // ── Exclusion lists (3 parallel DB calls) ────────────────
      const [{ data: blockData }, { data: likedData }, { data: passData }] =
        await Promise.all([
          supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id),
          supabase.from('likes').select('liked_id').eq('liker_id', user.id),
          supabase.from('passes').select('profile_id').eq('user_id', user.id),
        ]);

      const blockedIds = (blockData  || []).map(b => b.blocked_id);
      const likedIds   = (likedData  || []).map(l => l.liked_id);
      const passedIds  = (passData   || []).map(p => p.profile_id);

      const filters = await getFilters();

      // ── Base query ───────────────────────────────────────────
      let q = supabase
        .from('profiles')
        .select('id,name,age,dob,gender,location,bio,interests,has_video,verification_status,looking_for,looking_for_gender')
        .neq('id', user.id)
        .eq('signup_complete', true);

      // ── Gender preference filtering (mutual) ─────────────────
      // Filter A: whom does the current user want to see?
      const genderFilter = me?.looking_for_gender;
      if (genderFilter === 'Men'   || genderFilter === 'Man')
        q = q.eq('gender', 'Man');
      if (genderFilter === 'Women' || genderFilter === 'Woman')
        q = q.eq('gender', 'Woman');

      // Filter B: do the candidates also want to see the current user?
      const myGender = me?.gender;
      if (myGender === 'Man')
        q = q.or('looking_for_gender.eq.Men,looking_for_gender.eq.Man');
      if (myGender === 'Woman')
        q = q.or('looking_for_gender.eq.Women,looking_for_gender.eq.Woman');

      // ── Age range ────────────────────────────────────────────
      if (filters.ageMin > 18) q = q.gte('age', filters.ageMin);
      if (filters.ageMax < 99) q = q.lte('age', filters.ageMax);

      // ── Exclude blocked / liked / (passed for non-admins) ────
      const excludeIds = [
        ...new Set([...blockedIds, ...likedIds, ...(adminUser ? [] : passedIds)]),
      ];
      if (excludeIds.length > 0)
        q = q.not('id', 'in', `(${excludeIds.join(',')})`);

      // BATCH_SIZE = 15 (was 50) — 70 % fewer storage.list() calls per load
      const { data } = await q.limit(BATCH_SIZE);

      if (data?.length) {
        const shuffled = [...data].sort(() => Math.random() - 0.5);

        // ── Eager enrich: only first EAGER_ENRICH profiles ──────
        // The user will see these immediately. The rest stay as raw
        // DB rows (_needsEnrich: true) until the user swipes near them.
        const eagerSlice = shuffled.slice(0, EAGER_ENRICH);
        const lazySlice  = shuffled.slice(EAGER_ENRICH);

        const enrichedEager = await Promise.all(eagerSlice.map(enrichOne));
        const lazyShells    = lazySlice.map(p => ({ ...p, _needsEnrich: true }));

        const withEnd = [...enrichedEager, ...lazyShells, { id: '__end__', _isEnd: true }];
        profilesRef.current = withEnd;
        setProfiles(withEnd);
        setCurrentIndex(0);
      } else {
        setProfiles([]);
      }
    } catch (e) {
      Alert.alert('Could not load profiles', 'Please check your connection and try again.');
    }

    setLoading(false);
    loadingRef.current = false;
  };

  // ── Lazy enrich: enrich the next un-enriched profile in the background ──
  // Called every time the feed advances so the upcoming card is ready
  // before the user swipes to it.
  const enrichNext = useCallback(async () => {
    const list = profilesRef.current;
    const nextRawIdx = list.findIndex(p => p._needsEnrich);
    if (nextRawIdx === -1) return;

    const raw = list[nextRawIdx];
    const enriched = await enrichOne(raw);

    // Splice the enriched version into the ref + state without re-sorting
    const updated = [...profilesRef.current];
    updated[nextRawIdx] = enriched;
    profilesRef.current = updated;
    setProfiles([...updated]);
  }, [enrichOne]);

  // ── Feed advance (non-admin) ─────────────────────────────────
  const advanceNonAdmin = useCallback(() => {
    const trimmed = profilesRef.current.slice(1);
    profilesRef.current = trimmed;
    currentIndexRef.current = 0;
    setCurrentIndex(0);
    setProfiles(trimmed);
    // Kick off background enrich for the next pending card
    enrichNext();
  }, [enrichNext]);

  // ── Pass ────────────────────────────────────────────────────
  const handlePass = useCallback((passedProfile) => {
    if (userIdRef.current && passedProfile && !passedProfile._isEnd) {
      supabase.from('passes').upsert(
        { user_id: userIdRef.current, profile_id: passedProfile.id },
        { onConflict: 'user_id,profile_id' }
      ).then(() => {});
    }
    if (!isAdmin) advanceNonAdmin();
  }, [isAdmin, advanceNonAdmin]);

  // ── Like ────────────────────────────────────────────────────
  const handleLike = useCallback(async (likedProfile, isSuper = false) => {
    if (!userIdRef.current || !likedProfile || likedProfile._isEnd) return;
    try {
      await supabase.from('likes').upsert(
        { liker_id: userIdRef.current, liked_id: likedProfile.id, is_super: isSuper },
        { onConflict: 'liker_id,liked_id' }
      );

      // Check for mutual match
      const { data: theirLike } = await supabase
        .from('likes')
        .select('id')
        .eq('liker_id', likedProfile.id)
        .eq('liked_id', userIdRef.current)
        .maybeSingle();

      if (theirLike) {
        await supabase.from('matches').upsert(
          { user_1: userIdRef.current, user_2: likedProfile.id },
          { onConflict: 'user_1,user_2' }
        );
      }
    } catch (e) {
      // like failed silently
    }
    if (!isAdmin) advanceNonAdmin();
  }, [isAdmin, advanceNonAdmin]);

  // ── Render ──────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#FF4458" />
      </SafeAreaView>
    );
  }

  const current = profiles[currentIndex];

  if (!current || (current._isEnd && profiles.length <= 1)) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyText}>No more profiles right now</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => loadProfiles()}>
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* SwipeCard and UI go here — wired to handleLike / handlePass */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D0D0D' },
  emptyText: { color: '#888', fontSize: 16, marginBottom: 20 },
  refreshBtn: { backgroundColor: '#FF4458', borderRadius: 24, paddingVertical: 13, paddingHorizontal: 36 },
  refreshBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
