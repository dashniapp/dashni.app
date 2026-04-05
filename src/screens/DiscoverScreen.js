import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Alert,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { getCachedProfile, setCachedProfile } from '../utils/profileCache';

const { width: SCREEN_W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const BATCH_SIZE   = 15;   // profiles fetched per load (was 50)
const EAGER_ENRICH = 5;    // profiles enriched with media up-front
const FEED_CACHE_KEY = 'feed:cache';
const FEED_TTL_MS    = 1000 * 60 * 5; // 5 minutes

// Module-level in-memory media cache (lives for the whole app session).
// Key = profileId, Value = { photoUrls, photoUrl, videoUrl, mediaSlides }
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

/**
 * buildPhotoUrls — construct photo URLs deterministically from photo_count.
 *
 * Replaces every storage.list() call in the codebase.
 *
 * Schema convention:
 *   index 0  → avatar.jpg          (required; always the main card photo)
 *   index 1  → photo_1.jpg
 *   index 2  → photo_2.jpg
 *   …
 *   index N  → photo_{N}.jpg       where N = photo_count - 1
 *
 * No network request is made — getPublicUrl() is a pure URL construction.
 */
function buildPhotoUrls(profileId, photoCount) {
  const count = Math.max(1, photoCount ?? 1); // always at least avatar
  return Array.from({ length: count }, (_, i) => {
    const filename = i === 0 ? 'avatar.jpg' : `photo_${i}.jpg`;
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(`${profileId}/${filename}`);
    return data?.publicUrl ?? null;
  }).filter(Boolean);
}

/**
 * Resolve media for one profile.
 * Checks the module-level mediaCache first — zero egress for seen profiles.
 * Uses photo_count for deterministic URL construction — zero storage.list() calls.
 */
function resolveMedia(profileId, photoCount, hasVideo) {
  if (mediaCache.has(profileId)) return mediaCache.get(profileId);

  const photoUrls = buildPhotoUrls(profileId, photoCount);

  // getPublicUrl = pure URL construction, no network call
  const { data: vi } = supabase.storage
    .from('videos')
    .getPublicUrl(`${profileId}/profile.mp4`);
  const videoUrl = hasVideo && vi?.publicUrl ? vi.publicUrl : null;

  const mediaSlides = [
    ...photoUrls.map(url => ({ type: 'photo', url })),
    ...(videoUrl ? [{ type: 'video', url: videoUrl }] : []),
  ];
  if (mediaSlides.length === 0) mediaSlides.push({ type: 'empty' });

  const resolved = {
    photoUrls,
    photoUrl: photoUrls[0] ?? null,
    videoUrl,
    mediaSlides,
  };
  mediaCache.set(profileId, resolved);
  return resolved;
}

// ─────────────────────────────────────────────────────────────
// Feed AsyncStorage cache helpers (stale-while-revalidate)
// ─────────────────────────────────────────────────────────────
async function loadFeedCache() {
  try {
    const raw = await AsyncStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return null;
    const { profiles, ts } = JSON.parse(raw);
    if (Date.now() - ts > FEED_TTL_MS) return null;
    return profiles;
  } catch {
    return null;
  }
}

async function saveFeedCache(profiles) {
  try {
    // Strip _needsEnrich shells before persisting — only save enriched rows
    const toSave = profiles.filter(p => !p._isEnd && !p._needsEnrich);
    await AsyncStorage.setItem(
      FEED_CACHE_KEY,
      JSON.stringify({ profiles: toSave, ts: Date.now() })
    );
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// DiscoverScreen
// ─────────────────────────────────────────────────────────────
export default function DiscoverScreen({ navigation, route }) {
  const [profiles, setProfiles]     = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [isAdmin, setIsAdmin]       = useState(false);
  const [myPhotoUrl, setMyPhotoUrl] = useState(null);

  const profilesRef      = useRef([]);
  const currentIndexRef  = useRef(0);
  const userIdRef        = useRef(null);
  const loadingRef       = useRef(false); // prevents duplicate concurrent fetches

  useEffect(() => { loadProfiles(); }, []);

  useEffect(() => {
    if (route.params?.filtersApplied) loadProfiles(true);
  }, [route.params?.filtersApplied]);

  useEffect(() => {
    if (route.params?.reloadFeed) loadProfiles(false);
  }, [route.params?.reloadFeed]);

  // ── Enrich one raw DB row with media (sync — no network) ────
  const enrichOne = useCallback((p) => {
    const media = resolveMedia(p.id, p.photo_count, p.has_video);
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
    if (loadingRef.current) return;
    loadingRef.current = true;

    // ── Stale-while-revalidate: show cached feed instantly ─────
    const cached = await loadFeedCache();
    if (cached?.length) {
      const withEnd = [...cached, { id: '__end__', _isEnd: true }];
      profilesRef.current = withEnd;
      setProfiles(withEnd);
      setCurrentIndex(0);
      setLoading(false);
      // Continue fetching fresh data in the background (no spinner)
      showSpinner = false;
    }

    if (showSpinner) setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); loadingRef.current = false; return; }

      userIdRef.current = user.id;

      // Own avatar: pure URL construction, no network call
      if (!myPhotoUrl) {
        const { data: myPhoto } = supabase.storage
          .from('avatars')
          .getPublicUrl(`${user.id}/avatar.jpg`);
        if (myPhoto?.publicUrl) setMyPhotoUrl(myPhoto.publicUrl);
      }

      // ── Own profile — check profileCache first ───────────────
      let me = await getCachedProfile(user.id);
      if (!me) {
        const { data } = await supabase
          .from('profiles')
          .select('gender, looking_for_gender, is_admin')
          .eq('id', user.id)
          .single();
        me = data;
        if (me) await setCachedProfile(user.id, me);
      }

      const adminUser = me?.is_admin === true;
      setIsAdmin(adminUser);

      // ── Exclusion lists — run in parallel ───────────────────
      const [{ data: blockData }, { data: likedData }, { data: passData }] =
        await Promise.all([
          supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id),
          supabase.from('likes').select('liked_id').eq('liker_id', user.id),
          supabase.from('passes').select('profile_id').eq('user_id', user.id),
        ]);

      const blockedIds = (blockData || []).map(b => b.blocked_id);
      const likedIds   = (likedData || []).map(l => l.liked_id);
      const passedIds  = (passData  || []).map(p => p.profile_id);

      const filters = await getFilters();

      // ── Profile query — includes photo_count ────────────────
      // photo_count replaces storage.list() entirely.
      let q = supabase
        .from('profiles')
        .select('id,name,age,dob,gender,location,bio,interests,photo_count,has_video,verification_status,looking_for,looking_for_gender')
        .neq('id', user.id)
        .eq('signup_complete', true);

      // Filter A: whom does the current user want to see?
      const genderFilter = me?.looking_for_gender;
      if (genderFilter === 'Men'   || genderFilter === 'Man')
        q = q.eq('gender', 'Man');
      if (genderFilter === 'Women' || genderFilter === 'Woman')
        q = q.eq('gender', 'Woman');

      // Filter B: mutual — do candidates also want to see the viewer?
      const myGender = me?.gender;
      if (myGender === 'Man')
        q = q.or('looking_for_gender.eq.Men,looking_for_gender.eq.Man');
      if (myGender === 'Woman')
        q = q.or('looking_for_gender.eq.Women,looking_for_gender.eq.Woman');

      if (filters.ageMin > 18) q = q.gte('age', filters.ageMin);
      if (filters.ageMax < 99) q = q.lte('age', filters.ageMax);

      const excludeIds = [
        ...new Set([...blockedIds, ...likedIds, ...(adminUser ? [] : passedIds)]),
      ];
      if (excludeIds.length > 0)
        q = q.not('id', 'in', `(${excludeIds.join(',')})`);

      const { data } = await q.limit(BATCH_SIZE);

      if (data?.length) {
        const shuffled = [...data].sort(() => Math.random() - 0.5);

        // Eagerly enrich first EAGER_ENRICH profiles (sync — no network).
        // resolveMedia() uses photo_count + getPublicUrl (pure), so this
        // costs zero egress. The rest stay as shells until swiped toward.
        const enrichedEager = shuffled.slice(0, EAGER_ENRICH).map(enrichOne);
        const lazyShells    = shuffled.slice(EAGER_ENRICH).map(p => ({
          ...p, _needsEnrich: true,
        }));

        const withEnd = [...enrichedEager, ...lazyShells, { id: '__end__', _isEnd: true }];
        profilesRef.current = withEnd;
        setProfiles(withEnd);
        setCurrentIndex(0);

        // Persist enriched profiles for stale-while-revalidate on next open
        await saveFeedCache(enrichedEager);
      } else if (!cached?.length) {
        setProfiles([]);
      }
    } catch (e) {
      if (!cached?.length)
        Alert.alert('Could not load profiles', 'Please check your connection and try again.');
    }

    setLoading(false);
    loadingRef.current = false;
  };

  // ── Lazy enrich: enrich the next shell in the background ────
  // enrichOne is sync (photo_count + getPublicUrl) — no network call.
  const enrichNext = useCallback(() => {
    const list = profilesRef.current;
    const idx  = list.findIndex(p => p._needsEnrich);
    if (idx === -1) return;

    const enriched = enrichOne(list[idx]);
    const updated  = [...profilesRef.current];
    updated[idx]   = enriched;
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
    enrichNext(); // enrich next shell synchronously
  }, [enrichNext]);

  // ── Pass ─────────────────────────────────────────────────────
  const handlePass = useCallback((passedProfile) => {
    if (userIdRef.current && passedProfile && !passedProfile._isEnd) {
      supabase.from('passes').upsert(
        { user_id: userIdRef.current, profile_id: passedProfile.id },
        { onConflict: 'user_id,profile_id' }
      ).then(() => {});
    }
    if (!isAdmin) advanceNonAdmin();
  }, [isAdmin, advanceNonAdmin]);

  // ── Like ─────────────────────────────────────────────────────
  const handleLike = useCallback(async (likedProfile, isSuper = false) => {
    if (!userIdRef.current || !likedProfile || likedProfile._isEnd) return;
    try {
      await supabase.from('likes').upsert(
        { liker_id: userIdRef.current, liked_id: likedProfile.id, is_super: isSuper },
        { onConflict: 'liker_id,liked_id' }
      );

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
    } catch {}
    if (!isAdmin) advanceNonAdmin();
  }, [isAdmin, advanceNonAdmin]);

  // ── Render ───────────────────────────────────────────────────
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
      {/* SwipeCard wired to current profile, handleLike, handlePass */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#0D0D0D' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D0D0D' },
  emptyText:      { color: '#888', fontSize: 16, marginBottom: 20 },
  refreshBtn:     { backgroundColor: '#FF4458', borderRadius: 24, paddingVertical: 13, paddingHorizontal: 36 },
  refreshBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
