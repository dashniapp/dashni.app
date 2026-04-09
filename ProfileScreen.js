import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Modal,
  ActivityIndicator,
  Alert,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './lib/supabase';
import { useAuth } from './context/AuthContext';
import { useProfile } from './context/ProfileContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = Math.floor(SCREEN_WIDTH / 3);

// ---------------------------------------------------------------------------
// Helper: fetch posts for a given userId
// ---------------------------------------------------------------------------
async function fetchPostsForUser(userId) {
  const { data, error } = await supabase
    .from('posts')
    .select('id, media_url, media_type, likes_count, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Helper: fetch total likes received
async function fetchTotalLikes(userId) {
  const { data, error } = await supabase
    .from('posts')
    .select('likes_count')
    .eq('user_id', userId);

  if (error) throw error;
  const total = (data ?? []).reduce((sum, row) => sum + (row.likes_count ?? 0), 0);
  return total;
}

// Helper: fetch another user's profile row
async function fetchUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, age, city, bio, avatar_url, gender, is_premium')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AvatarImage({ uri, size = 80 }) {
  const initials = '?';
  return (
    <View style={[styles.avatarRing, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2 }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
          <Ionicons name="person" size={size * 0.5} color="#888" />
        </View>
      )}
    </View>
  );
}

function StatsRow({ postCount, totalLikes }) {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{postCount}</Text>
        <Text style={styles.statLabel}>posts</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{totalLikes}</Text>
        <Text style={styles.statLabel}>likes received</Text>
      </View>
    </View>
  );
}

function PostCell({ item, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(item)}
      style={styles.cell}
    >
      <Image
        source={{ uri: item.media_url }}
        style={styles.cellImage}
        resizeMode="cover"
      />
      {item.media_type === 'video' && (
        <View style={styles.videoBadge}>
          <Ionicons name="videocam" size={13} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

function EmptyGrid({ isOwnProfile, onNewPost }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="camera-outline" size={48} color="#555" />
      <Text style={styles.emptyTitle}>No posts yet</Text>
      {isOwnProfile && (
        <>
          <Text style={styles.emptySubtitle}>Be the first to share something</Text>
          <TouchableOpacity style={styles.newPostBtn} onPress={onNewPost}>
            <Text style={styles.newPostBtnText}>New Post</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Own-profile header
// ---------------------------------------------------------------------------
function OwnProfileHeader({
  profile,
  postCount,
  totalLikes,
  onAvatarPress,
  onNewPost,
  onSaveBio,
}) {
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBioText(profile?.bio ?? '');
  }, [profile?.bio]);

  const handleSaveBio = async () => {
    setSaving(true);
    try {
      await onSaveBio(bioText);
      setEditingBio(false);
    } catch {
      Alert.alert('Error', 'Could not save bio. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const nameDisplay = [profile?.name, profile?.age].filter(Boolean).join(', ');
  const cityDisplay = profile?.city ?? '';

  return (
    <View style={styles.header}>
      {/* Avatar */}
      <TouchableOpacity onPress={onAvatarPress} style={styles.avatarWrapper}>
        <AvatarImage uri={profile?.avatar_url} size={80} />
        <View style={styles.avatarEditBadge}>
          <Ionicons name="camera" size={12} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* Name / age / city */}
      <Text style={styles.displayName}>{nameDisplay}</Text>
      {!!cityDisplay && <Text style={styles.city}>{cityDisplay}</Text>}

      {/* Bio */}
      {editingBio ? (
        <View style={styles.bioEditContainer}>
          <TextInput
            value={bioText}
            onChangeText={(t) => setBioText(t.slice(0, 120))}
            style={styles.bioInput}
            multiline
            maxLength={120}
            placeholder="Write a short bio..."
            placeholderTextColor="#666"
            autoFocus
          />
          <View style={styles.bioActions}>
            <TouchableOpacity
              onPress={() => {
                setBioText(profile?.bio ?? '');
                setEditingBio(false);
              }}
              style={styles.bioCancelBtn}
            >
              <Text style={styles.bioCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveBio}
              style={styles.bioSaveBtn}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.bioSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setEditingBio(true)} style={styles.bioTouchable}>
          <Text style={[styles.bioText, !bioText && styles.bioPlaceholder]}>
            {bioText || 'Tap to add a bio…'}
          </Text>
        </TouchableOpacity>
      )}

      <StatsRow postCount={postCount} totalLikes={totalLikes} />

      {/* New Post button */}
      <TouchableOpacity style={styles.primaryBtn} onPress={onNewPost}>
        <Ionicons name="add-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.primaryBtnText}>New Post</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Other-user header
// ---------------------------------------------------------------------------
function OtherProfileHeader({
  profile,
  postCount,
  totalLikes,
  currentUserGender,
  currentUserIsPremium,
  targetUserId,
}) {
  const navigation = useNavigation();

  const nameDisplay = [profile?.name, profile?.age].filter(Boolean).join(', ');
  const cityDisplay = profile?.city ?? '';

  const handleMessage = () => {
    const isFemale = currentUserGender === 'female';
    const isPremiumMale = currentUserGender === 'male' && currentUserIsPremium;

    if (isFemale || isPremiumMale) {
      navigation.navigate('Conversation', { userId: targetUserId });
    } else {
      // Free male → paywall
      navigation.navigate('Paywall');
    }
  };

  return (
    <View style={styles.header}>
      {/* Avatar (not tappable) */}
      <View style={styles.avatarWrapper}>
        <AvatarImage uri={profile?.avatar_url} size={80} />
      </View>

      <Text style={styles.displayName}>{nameDisplay}</Text>
      {!!cityDisplay && <Text style={styles.city}>{cityDisplay}</Text>}

      {!!profile?.bio && <Text style={styles.bioText}>{profile.bio}</Text>}

      <StatsRow postCount={postCount} totalLikes={totalLikes} />

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleMessage}>
          <Ionicons name="chatbubble-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.primaryBtnText}>Message</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------
export default function ProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { profile: ownProfile, updateProfile } = useProfile();

  const paramUserId = route.params?.userId;
  const isOwnProfile = !paramUserId || paramUserId === user?.id;
  const targetUserId = isOwnProfile ? user?.id : paramUserId;

  const [otherProfile, setOtherProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [totalLikes, setTotalLikes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Set navigation header options
  useEffect(() => {
    navigation.setOptions({
      headerRight: isOwnProfile
        ? () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('Settings')}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="settings-outline" size={22} color="#fff" />
            </TouchableOpacity>
          )
        : undefined,
      headerTitle: isOwnProfile ? 'My Profile' : (otherProfile?.name ?? 'Profile'),
    });
  }, [navigation, isOwnProfile, otherProfile?.name]);

  // Load data
  const loadData = useCallback(async () => {
    if (!targetUserId) return;
    try {
      setLoading(true);
      const [fetchedPosts, fetchedLikes] = await Promise.all([
        fetchPostsForUser(targetUserId),
        fetchTotalLikes(targetUserId),
      ]);
      setPosts(fetchedPosts);
      setTotalLikes(fetchedLikes);

      if (!isOwnProfile) {
        const prof = await fetchUserProfile(targetUserId);
        setOtherProfile(prof);
      }
    } catch (err) {
      console.error('ProfileScreen loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, isOwnProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---- Avatar upload (own profile only) -----------------------------------
  const handleAvatarPress = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (result.canceled) return;

    const picked = result.assets[0];

    try {
      setAvatarUploading(true);

      // Compress
      const compressed = await ImageManipulator.manipulateAsync(
        picked.uri,
        [{ resize: { width: 800, height: 800 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Read as blob
      const response = await fetch(compressed.uri);
      const blob = await response.blob();

      const filePath = `${user.id}/avatar.jpg`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = urlData?.publicUrl;

      // Update profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update context
      await updateProfile({ avatar_url: avatarUrl });
    } catch (err) {
      console.error('Avatar upload error:', err);
      Alert.alert('Error', 'Could not update avatar. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  };

  // ---- Bio save (own profile only) ----------------------------------------
  const handleSaveBio = async (newBio) => {
    const { error } = await supabase
      .from('profiles')
      .update({ bio: newBio })
      .eq('id', user.id);

    if (error) throw error;
    await updateProfile({ bio: newBio });
  };

  // ---- Post cell tap -------------------------------------------------------
  const handlePostPress = (item) => {
    navigation.navigate('PostDetail', { postId: item.id });
  };

  // ---- Render --------------------------------------------------------------
  const activeProfile = isOwnProfile ? ownProfile : otherProfile;

  const ListHeader = () => {
    if (avatarUploading) {
      return (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.uploadingText}>Updating avatar…</Text>
        </View>
      );
    }

    if (isOwnProfile) {
      return (
        <OwnProfileHeader
          profile={ownProfile}
          postCount={posts.length}
          totalLikes={totalLikes}
          onAvatarPress={handleAvatarPress}
          onNewPost={() => navigation.navigate('CreatePost')}
          onSaveBio={handleSaveBio}
        />
      );
    }

    return (
      <OtherProfileHeader
        profile={otherProfile}
        postCount={posts.length}
        totalLikes={totalLikes}
        currentUserGender={ownProfile?.gender}
        currentUserIsPremium={ownProfile?.is_premium}
        targetUserId={targetUserId}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        numColumns={3}
        ListHeaderComponent={<ListHeader />}
        ListEmptyComponent={
          <EmptyGrid
            isOwnProfile={isOwnProfile}
            onNewPost={() => navigation.navigate('CreatePost')}
          />
        }
        renderItem={({ item }) => (
          <PostCell item={item} onPress={handlePostPress} />
        )}
        getItemLayout={(_, index) => ({
          length: CELL_SIZE,
          offset: CELL_SIZE * Math.floor(index / 3),
          index,
        })}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={posts.length === 0 && styles.flatListGrow}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const ACCENT = '#E03D7F';
const BG = '#0E0E0E';
const SURFACE = '#1A1A1A';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = '#AAAAAA';
const BORDER = '#2C2C2C';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },

  // Avatar
  avatarWrapper: {
    marginBottom: 12,
    position: 'relative',
  },
  avatarRing: {
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholder: {
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: ACCENT,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Name / city
  displayName: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  city: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    marginBottom: 8,
  },

  // Bio
  bioTouchable: {
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  bioText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  bioPlaceholder: {
    color: '#555',
    fontStyle: 'italic',
  },
  bioEditContainer: {
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  bioInput: {
    backgroundColor: SURFACE,
    color: TEXT_PRIMARY,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 72,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: BORDER,
  },
  bioActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  bioCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: SURFACE,
  },
  bioCancelText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  bioSaveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: ACCENT,
    minWidth: 60,
    alignItems: 'center',
  },
  bioSaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statNumber: {
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    marginTop: 1,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: BORDER,
  },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignSelf: 'stretch',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  actionRow: {
    alignSelf: 'stretch',
  },

  // Avatar upload indicator
  uploadingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: SURFACE,
    gap: 8,
  },
  uploadingText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },

  // Grid cells
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    backgroundColor: SURFACE,
  },
  cellImage: {
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
  videoBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    padding: 2,
  },

  // Empty state
  flatListGrow: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: TEXT_SECONDARY,
    fontSize: 17,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  newPostBtn: {
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  newPostBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
