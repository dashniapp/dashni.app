import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { launchImageLibraryAsync, MediaTypeOptions } from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAPTION_MAX = 300;

// ─── Video preview ────────────────────────────────────────────────────────────

function VideoPreview({ uri }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    player.play();
  }, [player]);

  return (
    <VideoView
      player={player}
      style={styles.media}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

// ─── CreatePostScreen ─────────────────────────────────────────────────────────

export default function CreatePostScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile } = useProfile();

  const [selectedMedia, setSelectedMedia] = useState(null); // { uri, type }
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  // ── Header buttons ──────────────────────────────────────────────────────────

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'New Post',
      headerStyle: { backgroundColor: '#1a1a1a' },
      headerTitleStyle: { color: '#fff', fontWeight: '600' },
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          disabled={uploading}
          style={styles.headerButton}
        >
          <Text style={[styles.headerButtonText, uploading && styles.headerButtonDisabled]}>
            Cancel
          </Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={handlePost}
          disabled={!selectedMedia || uploading}
          style={styles.headerButton}
        >
          <Text
            style={[
              styles.headerPostText,
              (!selectedMedia || uploading) && styles.headerButtonDisabled,
            ]}
          >
            Post
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, selectedMedia, uploading, caption]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pickers ─────────────────────────────────────────────────────────────────

  const pickPhoto = async () => {
    const result = await launchImageLibraryAsync({
      mediaTypes: MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (result.canceled) return;

    const asset = result.assets[0];

    // Compress: resize to max 1080px wide, JPEG at 75%
    const compressed = await manipulateAsync(
      asset.uri,
      [{ resize: { width: Math.min(asset.width, 1080) } }],
      { compress: 0.75, format: SaveFormat.JPEG }
    );

    setSelectedMedia({ uri: compressed.uri, type: 'photo' });
  };

  const pickVideo = async () => {
    const result = await launchImageLibraryAsync({
      mediaTypes: MediaTypeOptions.Videos,
      videoMaxDuration: 60,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setSelectedMedia({ uri: asset.uri, type: 'video' });
  };

  // ── Upload + insert ─────────────────────────────────────────────────────────

  const handlePost = async () => {
    if (!selectedMedia) {
      Alert.alert('No media', 'Please select a photo or video first.');
      return;
    }

    setUploading(true);

    try {
      const isPhoto = selectedMedia.type === 'photo';
      const ext = isPhoto ? 'jpg' : 'mp4';
      const contentType = isPhoto ? 'image/jpeg' : 'video/mp4';
      const filename = `${user.id}/${uuidv4()}.${ext}`;

      // Read file as Blob
      const response = await fetch(selectedMedia.uri);
      const blob = await response.blob();

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(filename, blob, { contentType });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(filename);
      const publicUrl = urlData.publicUrl;

      // Insert post row
      const { error: insertError } = await supabase.from('posts').insert({
        user_id: user.id,
        media_url: publicUrl,
        media_type: selectedMedia.type,
        caption: caption.trim() || null,
      });

      if (insertError) throw insertError;

      navigation.goBack();
    } catch (err) {
      Alert.alert('Upload failed', err.message || 'Something went wrong. Please try again.');
      setUploading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {!selectedMedia ? (
          // ── Pick state ──────────────────────────────────────────────────────
          <View style={styles.pickContainer}>
            <Text style={styles.pickHeading}>Choose media</Text>
            <TouchableOpacity style={styles.pickButton} onPress={pickPhoto} activeOpacity={0.75}>
              <Ionicons name="image-outline" size={28} color="#fff" />
              <Text style={styles.pickButtonText}>Choose Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickButton} onPress={pickVideo} activeOpacity={0.75}>
              <Ionicons name="videocam-outline" size={28} color="#fff" />
              <Text style={styles.pickButtonText}>Choose Video</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // ── Preview + caption state ─────────────────────────────────────────
          <View>
            {/* Media preview */}
            <View style={styles.previewWrapper}>
              {selectedMedia.type === 'photo' ? (
                <Image
                  source={{ uri: selectedMedia.uri }}
                  style={styles.media}
                  resizeMode="cover"
                />
              ) : (
                <VideoPreview uri={selectedMedia.uri} />
              )}

              {/* Change button */}
              <TouchableOpacity
                style={styles.changeButton}
                onPress={selectedMedia.type === 'photo' ? pickPhoto : pickVideo}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-outline" size={14} color="#fff" />
                <Text style={styles.changeButtonText}>Change</Text>
              </TouchableOpacity>
            </View>

            {/* Caption input */}
            <View style={styles.captionContainer}>
              <TextInput
                style={styles.captionInput}
                placeholder="Add a caption..."
                placeholderTextColor="#555"
                multiline
                maxLength={CAPTION_MAX}
                value={caption}
                onChangeText={setCaption}
              />
              <Text style={styles.charCount}>
                {caption.length} / {CAPTION_MAX}
              </Text>
            </View>

            {/* Post button (below caption, secondary to header button) */}
            <TouchableOpacity
              style={[styles.postButton, (!selectedMedia || uploading) && styles.postButtonDisabled]}
              onPress={handlePost}
              disabled={!selectedMedia || uploading}
              activeOpacity={0.8}
            >
              <Text style={styles.postButtonText}>Post</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Uploading overlay */}
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.uploadingText}>Posting...</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Header buttons
  headerButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headerButtonText: {
    color: '#aaa',
    fontSize: 16,
  },
  headerPostText: {
    color: '#e63946',
    fontSize: 16,
    fontWeight: '700',
  },
  headerButtonDisabled: {
    opacity: 0.35,
  },

  // Pick state
  pickContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  pickHeading: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 32,
    width: '100%',
    justifyContent: 'center',
  },
  pickButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },

  // Preview
  previewWrapper: {
    position: 'relative',
  },
  media: {
    width: SCREEN_WIDTH,
    aspectRatio: 4 / 3,
  },
  changeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  changeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },

  // Caption
  captionContainer: {
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  captionInput: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    color: '#555',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },

  // Post button
  postButton: {
    margin: 20,
    backgroundColor: '#e63946',
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
  },
  postButtonDisabled: {
    opacity: 0.35,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Uploading overlay
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  uploadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
