import React, {
  useState, useRef, useEffect, useCallback, memo
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator, Image,
  StatusBar, FlatList, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, AntDesign } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { getFilters } from './FiltersScreen';
import { colors, radius } from '../theme';

const { width: W, height: H } = Dimensions.get('window');

// ── Inline video (only renders when on video slide) ──────────────────────────
function InlineVideo({ uri }) {
  const [playing, setPlaying] = useState(true);
  const player = useVideoPlayer(uri, p => {
    if (p) { p.loop = true; p.play(); }
  });

  return (
    <TouchableOpacity
      style={StyleSheet.absoluteFill}
      onPress={() => {
        if (playing) { player.pause(); setPlaying(false); }
        else { player.play(); setPlaying(true); }
      }}
      activeOpacity={1}
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      {!playing && (
        <View style={styles.videoOverlay}>
          <View style={styles.videoPlayBtn}>
            <Ionicons name="play" size={30} color="#fff" />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Profile card ─────────────────────────────────────────────────────────────
const ProfileCard = memo(function ProfileCard({
  profile, isActive, onInfo, onLike, onPass, onSuper,
}) {
  const likeScale  = useRef(new Animated.Value(0)).current;
  const likeOpacity = useRef(new Animated.Value(0)).current;
  const [slideIndex, setSlideIndex] = useState(0);

  // Reset to first slide when card goes off screen
  useEffect(() => {
    if (!isActive) setSlideIndex(0);
  }, [isActive]);

  // Build slides array: photo first, then video, then nothing else for now
  // Keep it simple - extra photos caused bugs
  const slides = [];
  if (profile?.photoUrl)  slides.push({ type: 'photo', url: profile.photoUrl });
  if (profile?.videoUrl)  slides.push({ type: 'video', url: profile.videoUrl });
  if (slides.length === 0) slides.push({ type: 'empty' });

  const totalSlides = slides.length;
  const currentSlide = slides[slideIndex] || slides[0];

  const goNext = () => {
    if (slideIndex < totalSlides - 1) {
      setSlideIndex(s => s + 1);
      Haptics.selectionAsync();
    }
  };

  const goPrev = () => {
    if (slideIndex > 0) {
      setSlideIndex(s => s - 1);
      Haptics.selectionAsync();
    }
  };

  const animateLike = () => {
    likeScale.setValue(0.3);
    likeOpacity.setValue(1);
    Animated.parallel([
      Animated.spring(likeScale, { toValue: 1.2, friction: 3, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(likeOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  };

  if (!profile) return <View style={styles.card} />;

  return (
    <View style={styles.card}>

      {/* ── LAYER 1: Background content ── */}
      {currentSlide.type === 'empty' && (
        <LinearGradient colors={['#2a0a1e', '#0d0818']} style={StyleSheet.absoluteFill}>
          <View style={styles.initialWrap}>
            <Text style={styles.initial}>{profile.initials}</Text>
          </View>
        </LinearGradient>
      )}

      {currentSlide.type === 'photo' && (
        <Image
          source={{ uri: currentSlide.url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}

      {currentSlide.type === 'video' && isActive && (
        <InlineVideo uri={currentSlide.url} />
      )}

      {currentSlide.type === 'video' && !isActive && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0d0818', alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="play-circle" size={60} color={colors.accent} />
        </View>
      )}

      {/* ── LAYER 2: Gradients (MUST be before dots/UI) ── */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent']}
        style={styles.topGrad}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.bottomGrad}
        pointerEvents="none"
      />

      {/* ── LAYER 3: Dots (story bar style at top) ── */}
      {totalSlides > 1 && (
        <View style={styles.dotsRow} pointerEvents="none">
          {slides.map((s, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === slideIndex
                    ? (s.type === 'video' ? colors.accent : '#fff')
                    : 'rgba(255,255,255,0.35)',
                }
              ]}
            />
          ))}
        </View>
      )}

      {/* ── LAYER 4: VIDEO badge when on video slide ── */}
      {currentSlide.type === 'video' && (
        <View style={styles.videoBadge} pointerEvents="none">
          <View style={styles.videoBadgeDot} />
          <Text style={styles.videoBadgeText}>VIDEO</Text>
        </View>
      )}

      {/* ── LAYER 5: Tap zones for slide navigation ── */}
      {slideIndex > 0 && (
        <TouchableOpacity
          style={styles.tapLeft}
          onPress={goPrev}
          activeOpacity={1}
        />
      )}
      {slideIndex < totalSlides - 1 && (
        <TouchableOpacity
          style={styles.tapRight}
          onPress={goNext}
          activeOpacity={1}
        />
      )}

      {/* ── LAYER 6: Like animation ── */}
      <Animated.View
        style={[styles.likeHeart, {
          opacity: likeOpacity,
          transform: [{ scale: likeScale }],
        }]}
        pointerEvents="none"
      >
        <Text style={{ fontSize: 80 }}>❤️</Text>
      </Animated.View>

      {/* ── LAYER 7: Side action buttons ── */}
      <View style={styles.sideActions}>
        <TouchableOpacity style={styles.sideBtn} onPress={onInfo} activeOpacity={0.75}>
          {profile.photoUrl ? (
            <Image source={{ uri: profile.photoUrl }} style={styles.profileThumb} />
          ) : (
            <View style={[styles.profileThumb, styles.profileThumbFallback]}>
              <Text style={styles.profileThumbText}>{profile.initials}</Text>
            </View>
          )}
          <Text style={styles.sideBtnLabel}>Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sideBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            animateLike();
            onLike();
          }}
          activeOpacity={0.75}
        >
          <View style={[styles.sideBtnCircle, { backgroundColor: colors.accent }]}>
            <AntDesign name="heart" size={22} color="#fff" />
          </View>
          <Text style={styles.sideBtnLabel}>Like</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sideBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPass();
          }}
          activeOpacity={0.75}
        >
          <View style={styles.sideBtnCircle}>
            <AntDesign name="close" size={20} color="#fff" />
          </View>
          <Text style={styles.sideBtnLabel}>Pass</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sideBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            onSuper();
          }}
          activeOpacity={0.75}
        >
          <View style={[styles.sideBtnCircle, { borderColor: '#ffd166', borderWidth: 1.5 }]}>
            <AntDesign name="star" size={20} color="#ffd166" />
          </View>
          <Text style={styles.sideBtnLabel}>Super</Text>
        </TouchableOpacity>
      </View>

      {/* ── LAYER 8: Profile info ── */}
      <View style={styles.cardBottom}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile.name}</Text>
          {profile.age ? <Text style={styles.age}>{profile.age}</Text> : null}
          {profile.verified && (
            <Ionicons name="checkmark-circle" size={18} color="#3b82f6" />
          )}
        </View>
        {(profile.locationDisplay || profile.location) ? (
          <View style={styles.locRow}>
            <Feather
              name={profile.isDiaspora ? 'globe' : 'map-pin'}
              size={12}
              color="rgba(255,255,255,0.6)"
            />
            <Text style={styles.location}>
              {profile.locationDisplay || profile.location}
            </Text>
          </View>
        ) : null}
        {profile.bio ? (
          <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text>
        ) : null}
        {profile.tags?.length > 0 && (
          <View style={styles.tagsRow}>
            {profile.tags.slice(0, 3).map((tag, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.swipeHint}>
          <Feather name="chevron-up" size={13} color="rgba(255,255,255,0.3)" />
          <Text style={styles.swipeHintText}>
            {totalSlides > 1 ? 'Tap sides to browse · Swipe up for next' : 'Swipe up for next profile'}
          </Text>
          <Feather name="chevron-up" size={13} color="rgba(255,255,255,0.3)" />
        </View>
      </View>
    </View>
  );
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function DiscoverScreen({ navigation }) {
  const [profiles, setProfiles]     = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading]       = useState(true);
  const flatListRef = useRef(null);

  const needsReload = React.useRef(false);

  useEffect(() => {
    loadProfiles();
    const unsub = navigation.addListener('focus', () => {
      if (needsReload.current) {
        needsReload.current = false;
        loadProfiles();
      }
    });
    return unsub;
  }, []);

  // Set flag when going to filters
  useEffect(() => {
    const unsub = navigation.addListener('blur', (e) => {
      // Check if navigating to Filters
      const state = navigation.getState();
      if (state) needsReload.current = true;
    });
    return unsub;
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: me } = await supabase
        .from('profiles')
        .select('gender, diaspora_mode, looking_for_gender')
        .eq('id', user.id).single();

      const { data: blockData } = await supabase
        .from('blocks').select('blocked_id').eq('blocker_id', user.id);
      const blockedIds = (blockData || []).map(b => b.blocked_id);

      const filters = await getFilters();

      let q = supabase
        .from('profiles')
        .select('id,name,age,gender,location,bio,interests,has_video,verification_status,hometown,country,diaspora_mode')
        .neq('id', user.id);

      const genderFilter = filters.interestedIn !== 'Everyone'
        ? filters.interestedIn
        : me?.looking_for_gender;
      if (genderFilter === 'Men'   || genderFilter === 'Man')   q = q.eq('gender', 'Man');
      if (genderFilter === 'Women' || genderFilter === 'Woman') q = q.eq('gender', 'Woman');
      if (filters.ageMin > 18)  q = q.gte('age', filters.ageMin);
      if (filters.ageMax < 99)  q = q.lte('age', filters.ageMax);
      if (filters.showVideosOnly) q = q.eq('has_video', true);
      if (blockedIds.length > 0)
        q = q.not('id', 'in', `(${blockedIds.join(',')})`);

      const { data } = await q.limit(50);

      if (data?.length) {
        const enriched = data.map(p => {
          const { data: ph } = supabase.storage
            .from('avatars').getPublicUrl(`${p.id}/avatar.jpg`);

          const { data: vi } = supabase.storage
            .from('videos').getPublicUrl(`${p.id}/profile.mp4`);

          let locationDisplay = p.location || '';
          if (p.hometown && p.location && p.hometown !== p.location) {
            locationDisplay = `${p.hometown} → ${p.location}`;
          } else if (p.hometown) {
            locationDisplay = p.hometown;
          }

          const photoUrl  = ph?.publicUrl
            ? `${ph.publicUrl}?t=${p.id}` : null;
          const videoUrl  = p.has_video && vi?.publicUrl
            ? `${vi.publicUrl}?v=${Date.now()}` : null;


          return {
            ...p,
            initials: p.name?.[0]?.toUpperCase() ?? '?',
            tags: p.interests
              ? p.interests.split(',').map(t => t.trim()).filter(Boolean)
              : [],
            verified: p.verification_status === 'verified',
            photoUrl,
            videoUrl,
            locationDisplay,
            isDiaspora: p.diaspora_mode || false,
          };
        });

        setProfiles(enriched.sort(() => Math.random() - 0.5));
        setCurrentIndex(0);
      } else {
        setProfiles([]);
      }
    } catch (e) {
      Alert.alert('Could not load profiles', 'Please check your connection and try again.');
    }
    setLoading(false);
  };

  const handleLike = useCallback(async (likedProfile, index, isSuper = false) => {
    if (flatListRef.current && index < profiles.length - 1) {
      flatListRef.current.scrollToIndex({ index: index + 1, animated: true });
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('likes').upsert({
        liker_id: user.id, liked_id: likedProfile.id, is_super: isSuper,
      });
      const { data: mutual } = await supabase.from('likes').select('id')
        .eq('liker_id', likedProfile.id).eq('liked_id', user.id);
      if (mutual?.length) {
        await supabase.from('matches').upsert({
          user_1: user.id < likedProfile.id ? user.id : likedProfile.id,
          user_2: user.id < likedProfile.id ? likedProfile.id : user.id,
        });
        Alert.alert("It's a Match! 🎉", `You and ${likedProfile.name} liked each other!`, [
          { text: 'Keep swiping', style: 'cancel' },
          { text: 'Message', onPress: () => navigation.navigate('Chat', {
            name: likedProfile.name,
            initials: likedProfile.initials,
            bgColor: '#14102a',
            accentColor: '#ff6b6b',
            userId: likedProfile.id,
            photoUrl: likedProfile.photoUrl,
          })},
        ]);
      }
    } catch (e) {
      // Like failed silently — not critical enough to interrupt the user
    }
  }, [profiles.length, navigation]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    const idx = viewableItems[0]?.index;
    if (idx != null) setCurrentIndex(idx);
  }, []);
  const getItemLayout = useCallback((_, i) => ({ length: H, offset: H * i, index: i }), []);

  const renderItem = useCallback(({ item, index }) => (
    <ProfileCard
      key={item.id}
      profile={item}
      isActive={index === currentIndex}
      onInfo={() => navigation.navigate('ViewProfile', { profile: item })}
      onLike={() => handleLike(item, index, false)}
      onPass={() => {
        if (flatListRef.current && index < profiles.length - 1)
          flatListRef.current.scrollToIndex({ index: index + 1, animated: true });
      }}
      onSuper={() => handleLike(item, index, true)}
    />
  ), [currentIndex, navigation, profiles.length, handleLike]);

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Finding profiles...</Text>
      </View>
    );
  }

  if (!profiles.length) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView edges={['top']}>
          <View style={styles.staticHeader}>
            <View style={styles.logoRow}>
              <Image source={require('../../assets/icon.png')} style={styles.logoImg} />
              <Text style={styles.logo}>Dashni</Text>
            </View>
          </View>
        </SafeAreaView>
        <View style={styles.emptyWrap}>
          <Text style={{ fontSize: 60 }}>💘</Text>
          <Text style={styles.emptyTitle}>No profiles yet</Text>
          <Text style={styles.emptySub}>Check back soon!</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={loadProfiles}>
            <Feather name="refresh-cw" size={14} color="#fff" />
            <Text style={styles.emptyBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <FlatList
        ref={flatListRef}
        data={profiles}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        pagingEnabled
        snapToInterval={H}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum={true}
        showsVerticalScrollIndicator={false}
        getItemLayout={getItemLayout}
        initialNumToRender={2}
        maxToRenderPerBatch={1}
        windowSize={3}
        removeClippedSubviews
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />
      <SafeAreaView edges={['top']} style={styles.headerAbsolute} pointerEvents="box-none">
        <View style={styles.staticHeader}>
          <View style={styles.logoRow}>
            <Image source={require('../../assets/icon.png')} style={styles.logoImg} />
            <Text style={styles.logo}>Dashni</Text>
          </View>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Filters')}
          >
            <Feather name="sliders" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#000' },
  center:       { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText:  { color: colors.textSecondary, fontSize: 14 },
  emptyWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  emptyTitle:   { color: colors.textPrimary, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  emptySub:     { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  emptyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: radius.full, paddingVertical: 13, paddingHorizontal: 28 },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  headerAbsolute: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999 },
  staticHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10 },
  logoRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg:        { width: 28, height: 28, borderRadius: 8 },
  logo:           { fontSize: 20, fontWeight: '800', color: colors.accent, letterSpacing: -0.5 },
  iconBtn:        { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  // Card
  card:         { width: W, height: H, backgroundColor: '#111' },
  initialWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  initial:      { fontSize: 100, fontWeight: '800', color: colors.accent, opacity: 0.15 },

  // Gradients — rendered before interactive UI so they don't block touches
  topGrad:    { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
  bottomGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: H * 0.55 },

  // Story-style dots at top
  dotsRow: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  dot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },

  // Video
  videoOverlay:   { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  videoPlayBtn:   { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  videoBadge:     { position: 'absolute', top: 70, left: 16, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.6)', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10, zIndex: 10 },
  videoBadgeDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  videoBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  // Tap zones
  tapLeft:  { position: 'absolute', left: 0, top: 0, bottom: 220, width: '38%', zIndex: 5 },
  tapRight: { position: 'absolute', right: 80, top: 0, bottom: 220, width: '38%', zIndex: 5 },

  // Like animation
  likeHeart: { position: 'absolute', top: '35%', alignSelf: 'center', zIndex: 20 },

  // Side buttons
  sideActions:         { position: 'absolute', right: 14, bottom: 200, gap: 18, alignItems: 'center', zIndex: 10 },
  sideBtn:             { alignItems: 'center', gap: 5 },
  sideBtnCircle:       { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  sideBtnLabel:        { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '500' },
  profileThumb:        { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#fff', overflow: 'hidden' },
  profileThumbFallback:{ backgroundColor: '#14102a', alignItems: 'center', justifyContent: 'center' },
  profileThumbText:    { color: colors.accent, fontSize: 16, fontWeight: '700' },

  // Card info
  cardBottom:  { position: 'absolute', bottom: 100, left: 0, right: 80, paddingHorizontal: 18, gap: 6, zIndex: 10 },
  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:        { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  age:         { color: 'rgba(255,255,255,0.8)', fontSize: 22 },
  locRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  location:    { color: 'rgba(255,255,255,0.65)', fontSize: 13 },
  bio:         { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 19 },
  tagsRow:     { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag:         { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: radius.full, paddingVertical: 4, paddingHorizontal: 10 },
  tagText:     { color: 'rgba(255,255,255,0.9)', fontSize: 11 },
  swipeHint:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  swipeHintText: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
});
