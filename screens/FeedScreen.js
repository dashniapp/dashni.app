import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';

const PAGE_SIZE = 10;
const FREE_MALE_POST_LIMIT = 10;
const FREE_MALE_LIKE_LIMIT = 1;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Time-ago helper ──────────────────────────────────────────────────────────

function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ─── VideoPostItem ────────────────────────────────────────────────────────────

function VideoPostItem({ uri, isVisible }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (isVisible) {
      player.play();
    } else {
      player.pause();
    }
  }, [isVisible, player]);

  const toggleMute = () => {
    player.muted = !player.muted;
  };

  return (
    <TouchableOpacity activeOpacity={1} onPress={toggleMute} style={styles.mediaContainer}>
      <VideoView
        player={player}
        style={styles.media}
        contentFit="cover"
        nativeControls={false}
      />
      <View style={styles.unmuteLabel}>
        <Text style={styles.unmuteLabelText}>Tap to unmute</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

function PostCard({ post, currentUser, profile, isVisible, onLike, onShowPaywall, onOpenProfile }) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likesCount, setLikesCount] = useState(post.likes_count);

  const handleLike = async () => {
    const result = await onLike(post, liked, setLiked, setLikesCount);
    if (result === 'paywall') {
      onShowPaywall();
    }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => onOpenProfile(post.user_id)}
        activeOpacity={0.7}
      >
        {post.profiles?.avatar_url ? (
          <Image source={{ uri: post.profiles.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={20} color="#666" />
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>
            {post.profiles?.name || 'Unknown'}
            {post.profiles?.age ? `, ${post.profiles.age}` : ''}
          </Text>
          <Text style={styles.headerMeta}>
            {[post.profiles?.city, timeAgo(post.created_at)].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Media */}
      {post.media_type === 'photo' && post.media_url && (
        <Image source={{ uri: post.media_url }} style={styles.media} resizeMode="cover" />
      )}
      {post.media_type === 'video' && post.media_url && (
        <VideoPostItem uri={post.media_url} isVisible={isVisible} />
      )}

      {/* Caption */}
      {!!post.caption && <Text style={styles.caption}>{post.caption}</Text>}

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.likeButton} onPress={handleLike} activeOpacity={0.7}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={24}
            color={liked ? '#e63946' : '#888'}
          />
          {likesCount > 0 && (
            <Text style={[styles.likesCount, liked && styles.likesCountActive]}>
              {likesCount}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── FeedScreen ───────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile } = useProfile();

  const isMale = profile?.gender === 'male';
  const isPremium = profile?.is_premium === true;
  const isFreeMale = isMale && !isPremium;
  const oppositeGender = profile?.gender === 'male' ? 'female' : 'male';

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hitLimit, setHitLimit] = useState(false);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [dailyLikesUsed, setDailyLikesUsed] = useState(0);

  const offsetRef = useRef(0);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!profile || !user) return;

    const init = async () => {
      if (isFreeMale) {
        const { count } = await supabase
          .from('daily_swipes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('swipe_date', today);
        setDailyLikesUsed(count || 0);
      }
      fetchPosts(true);
    };

    init();
  }, [profile, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPosts = async (reset) => {
    if (reset) {
      offsetRef.current = 0;
      setHitLimit(false);
      setLoading(true);
    } else {
      if (loadingMore || !hasMore || hitLimit) return;
      setLoadingMore(true);
    }

    try {
      const from = offsetRef.current;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (name, age, city, avatar_url),
          liked_by_me:post_likes!left(liker_id)
        `)
        .eq('profiles.gender', oppositeGender)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Normalise liked_by_me: true if current user has a like entry
      let normalised = (data || []).map((p) => ({
        ...p,
        liked_by_me: Array.isArray(p.liked_by_me)
          ? p.liked_by_me.some((e) => e.liker_id === user.id)
          : false,
        likes_count: p.likes_count || 0,
      }));

      if (isFreeMale) {
        const { count: alreadySeen } = await supabase
          .from('posts_seen_today')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('seen_date', today);

        const seen = alreadySeen || 0;
        const canSee = FREE_MALE_POST_LIMIT - seen;

        if (canSee <= 0) {
          setHitLimit(true);
          reset ? setLoading(false) : setLoadingMore(false);
          return;
        }

        const allowed = normalised.slice(0, canSee);

        if (allowed.length > 0) {
          await supabase.from('posts_seen_today').upsert(
            allowed.map((p) => ({
              user_id: user.id,
              post_id: p.id,
              seen_date: today,
            })),
            { onConflict: 'user_id,post_id,seen_date' }
          );
        }

        if (seen + allowed.length >= FREE_MALE_POST_LIMIT) {
          setHitLimit(true);
        }

        normalised = allowed;
      }

      if (reset) {
        setPosts(normalised);
      } else {
        setPosts((prev) => [...prev, ...normalised]);
      }

      // Advance offset by original fetch count; determine if more pages exist
      offsetRef.current = from + (data?.length || 0);
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (err) {
      console.error('fetchPosts error:', err);
    } finally {
      reset ? setLoading(false) : setLoadingMore(false);
    }
  };

  const handleLike = async (post, currentlyLiked, setLiked, setLikesCount) => {
    if (isFreeMale && !currentlyLiked && dailyLikesUsed >= FREE_MALE_LIKE_LIMIT) {
      return 'paywall';
    }

    // Optimistic update
    setLiked(!currentlyLiked);
    setLikesCount((c) => c + (currentlyLiked ? -1 : 1));

    try {
      if (currentlyLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('liker_id', user.id);
      } else {
        await supabase.from('post_likes').insert({ post_id: post.id, liker_id: user.id });

        if (isFreeMale) {
          await supabase
            .from('daily_swipes')
            .upsert({ user_id: user.id, swipe_date: today }, { onConflict: 'user_id,swipe_date' });
          setDailyLikesUsed((c) => c + 1);
        }
      }
    } catch (err) {
      // Revert on failure
      setLiked(currentlyLiked);
      setLikesCount((c) => c + (currentlyLiked ? 1 : -1));
      console.error('handleLike error:', err);
    }

    return 'ok';
  };

  const showPaywall = () => navigation.navigate('Paywall');
  const openProfile = (userId) => navigation.navigate('UserProfile', { userId });

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setVisibleIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const renderItem = useCallback(
    ({ item, index }) => (
      <PostCard
        post={item}
        currentUser={user}
        profile={profile}
        isVisible={index === visibleIndex}
        onLike={handleLike}
        onShowPaywall={showPaywall}
        onOpenProfile={openProfile}
      />
    ),
    [visibleIndex, dailyLikesUsed], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const ListHeader = (
    <TouchableOpacity
      style={styles.createBanner}
      onPress={() => navigation.navigate('CreatePost')}
      activeOpacity={0.75}
    >
      <Ionicons name="add-circle-outline" size={20} color="#fff" />
      <Text style={styles.createBannerText}>Share a moment</Text>
    </TouchableOpacity>
  );

  const ListFooter = () => {
    if (hitLimit) {
      return (
        <View style={styles.limitCard}>
          <Ionicons name="lock-closed" size={32} color="#e63946" />
          <Text style={styles.limitTitle}>You've reached today's limit</Text>
          <Text style={styles.limitSubtitle}>
            Upgrade to Premium to see unlimited posts and likes every day.
          </Text>
          <TouchableOpacity style={styles.upgradeButton} onPress={showPaywall} activeOpacity={0.8}>
            <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator color="#888" />
        </View>
      );
    }
    if (!hasMore && posts.length > 0) {
      return (
        <View style={styles.allCaughtUp}>
          <Text style={styles.allCaughtUpText}>You're all caught up</Text>
        </View>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#888" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={<ListFooter />}
        onEndReached={() => {
          if (!loadingMore && hasMore && !hitLimit) {
            fetchPosts(false);
          }
        }}
        onEndReachedThreshold={0.4}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  centered: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Create banner
  createBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  createBannerText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },

  // Card
  card: {
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },

  // Header
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerMeta: {
    color: '#888',
    fontSize: 12,
    marginTop: 1,
  },

  // Media
  mediaContainer: {
    width: SCREEN_WIDTH,
    aspectRatio: 4 / 3,
    position: 'relative',
  },
  media: {
    width: SCREEN_WIDTH,
    aspectRatio: 4 / 3,
  },

  // Unmute label
  unmuteLabel: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  unmuteLabelText: {
    color: '#fff',
    fontSize: 11,
  },

  // Caption
  caption: {
    color: '#ddd',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    lineHeight: 20,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  likesCount: {
    color: '#888',
    fontSize: 14,
  },
  likesCountActive: {
    color: '#e63946',
  },

  // Footer
  limitCard: {
    alignItems: 'center',
    padding: 32,
    margin: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    gap: 10,
  },
  limitTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  limitSubtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  upgradeButton: {
    marginTop: 6,
    backgroundColor: '#e63946',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  footerLoader: {
    padding: 20,
    alignItems: 'center',
  },
  allCaughtUp: {
    padding: 24,
    alignItems: 'center',
  },
  allCaughtUpText: {
    color: '#555',
    fontSize: 14,
  },
});
