import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, PanResponder, Animated, TouchableOpacity, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_H = SCREEN_H * 0.58;
const SWIPE_THRESHOLD = 100;

export default function SwipeCard({ profile, onLike, onPass, isTop, onPress }) {
  const position = useRef(new Animated.ValueXY()).current;
  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_W / 2, 0, SCREEN_W / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
  });
  const likeOpacity = position.x.interpolate({ inputRange: [0, 80], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacity = position.x.interpolate({ inputRange: [-80, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isTop,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderMove: (_, gesture) => { position.setValue({ x: gesture.dx, y: gesture.dy }); },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) { swipeOut('right'); }
        else if (gesture.dx < -SWIPE_THRESHOLD) { swipeOut('left'); }
        else if (Math.abs(gesture.dx) < 5 && Math.abs(gesture.dy) < 5) {
          // It was a tap not a swipe
          Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
          if (onPress) onPress();
        } else {
          Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const swipeOut = (direction) => {
    const x = direction === 'right' ? SCREEN_W * 1.5 : -SCREEN_W * 1.5;
    Animated.timing(position, { toValue: { x, y: 0 }, duration: 250, useNativeDriver: false }).start(() => {
      position.setValue({ x: 0, y: 0 });
      direction === 'right' ? onLike() : onPass();
    });
  };

  const cardStyle = isTop
    ? { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }
    : { transform: [{ scale: 0.96 }], top: 8, opacity: 0.7 };

  return (
    <Animated.View style={[styles.card, cardStyle]} {...(isTop ? panResponder.panHandlers : {})}>
      <View style={[styles.mediaBg, { backgroundColor: profile.bgColor }]}>
        {profile.photoUrl ? (
          <Image source={{ uri: profile.photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Text style={[styles.initial, { color: profile.accentColor }]}>{profile.initials}</Text>
        )}
      </View>

      <View style={styles.dotsRow}>
        {Array(profile.mediaCount).fill(0).map((_, i) => (
          <View key={i} style={[styles.dot, i === 0 && styles.dotActive]} />
        ))}
      </View>

      {profile.hasVideo && (
        <View style={[styles.videoBadge, { borderColor: profile.accentColor }]}>
          <View style={[styles.videoDot, { backgroundColor: profile.accentColor }]} />
          <Text style={styles.videoBadgeText}>VIDEO</Text>
        </View>
      )}

      {profile.verified && (
        <View style={styles.verifiedBadge}>
          <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
        </View>
      )}

      {/* Info button to open full profile */}
      {isTop && onPress && (
        <TouchableOpacity style={styles.infoBtn} onPress={onPress}>
          <Feather name="info" size={16} color="#fff" />
        </TouchableOpacity>
      )}

      <Animated.View style={[styles.likeStamp, { opacity: likeOpacity }]}>
        <Text style={styles.likeStampText}>LIKE</Text>
      </Animated.View>
      <Animated.View style={[styles.nopeStamp, { opacity: nopeOpacity }]}>
        <Text style={styles.nopeStampText}>NOPE</Text>
      </Animated.View>

      <LinearGradient colors={['transparent', 'rgba(8,8,16,0.95)']} style={styles.gradient}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.age}>{profile.age}</Text>
          {profile.verified && <Ionicons name="checkmark-circle" size={16} color="#3b82f6" />}
        </View>
        <View style={styles.locationRow}>
          <Feather name="map-pin" size={11} color={colors.textMuted} />
          <Text style={styles.location}>{profile.location}</Text>
        </View>
        <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text>
        <View style={styles.tagsRow}>
          {profile.tags && profile.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { width: SCREEN_W - 28, height: CARD_H, borderRadius: radius.lg, overflow: 'hidden', position: 'absolute', backgroundColor: colors.bgCard },
  mediaBg: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 120, fontWeight: '800', opacity: 0.2 },
  dotsRow: { position: 'absolute', top: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5, paddingHorizontal: 16 },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', maxWidth: 32 },
  dotActive: { backgroundColor: '#fff' },
  videoBadge: { position: 'absolute', top: 30, right: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderRadius: 10, paddingVertical: 5, paddingHorizontal: 9, gap: 5 },
  videoDot: { width: 7, height: 7, borderRadius: 4 },
  videoBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  verifiedBadge: { position: 'absolute', top: 30, left: 14, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.full, padding: 4 },
  infoBtn: { position: 'absolute', bottom: 130, right: 14, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  gradient: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 70, paddingBottom: 18, paddingHorizontal: 18 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 3 },
  name: { color: colors.textPrimary, fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  age: { color: 'rgba(255,255,255,0.7)', fontSize: 20, fontWeight: '400' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 7 },
  location: { color: colors.textMuted, fontSize: 12 },
  bio: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 19, marginBottom: 11 },
  tagsRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  tag: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', borderRadius: radius.full, paddingVertical: 4, paddingHorizontal: 11 },
  tagText: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  likeStamp: { position: 'absolute', top: 50, left: 20, borderWidth: 3, borderColor: '#4caf50', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, transform: [{ rotate: '-20deg' }], zIndex: 10 },
  likeStampText: { color: '#4caf50', fontSize: 28, fontWeight: '800', letterSpacing: 2 },
  nopeStamp: { position: 'absolute', top: 50, right: 20, borderWidth: 3, borderColor: colors.accent, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, transform: [{ rotate: '20deg' }], zIndex: 10 },
  nopeStampText: { color: colors.accent, fontSize: 28, fontWeight: '800', letterSpacing: 2 },
});
