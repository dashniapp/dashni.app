import React, { useCallback, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface LikeAnimationProps {
  onLike?: () => void;
  size?: number;
  color?: string;
}

/**
 * LikeAnimation
 *
 * Mimics modern dating-app "like" feedback with a three-phase animation:
 *
 * Phase 1 — Press-in (quick tactile response)
 *   The heart scales down slightly so the user feels the tap immediately.
 *   Duration: 80 ms, Easing.out(Easing.quad)
 *
 * Phase 2 — Burst (satisfying pop)
 *   The heart overshoots past 1× to ~1.35× with a spring-like ease-out,
 *   then naturally settles. This is the "moment of delight" in Tinder-style UX.
 *   Duration: 320 ms, Easing.out(Easing.back(1.7))
 *
 * Phase 3 — Settle (graceful return to rest)
 *   The heart gently returns to 1×. The opacity also fades back so repeat
 *   taps can re-trigger the burst without visual stacking.
 *   Duration: 200 ms, Easing.out(Easing.quad)
 *
 * The ripple ring expands from 0→1 with a longer ease-out so it trails
 * behind the heart pop — this layered timing is what makes the overall
 * motion feel "expensive" without adding real complexity.
 */
export const LikeAnimation: React.FC<LikeAnimationProps> = ({
  onLike,
  size = 48,
  color = '#FF4458',
}) => {
  // --- Heart values ---
  const heartScale = useRef(new Animated.Value(1)).current;
  const heartOpacity = useRef(new Animated.Value(1)).current;

  // --- Ripple ring values ---
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  // Keep a ref to the running sequence so we can interrupt it on fast taps.
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const triggerLike = useCallback(() => {
    onLike?.();

    // Cancel any in-flight animation so rapid taps always feel responsive.
    animRef.current?.stop();

    // Reset to known baseline before re-animating.
    heartScale.setValue(1);
    heartOpacity.setValue(1);
    ringScale.setValue(0);
    ringOpacity.setValue(0);

    const anim = Animated.parallel([
      // ── Heart choreography ──────────────────────────────────────────────
      Animated.sequence([
        // Phase 1: subtle press-down (tactile confirmation)
        Animated.timing(heartScale, {
          toValue: 0.82,
          duration: 80,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        // Phase 2: satisfying overshoot pop
        Animated.timing(heartScale, {
          toValue: 1.35,
          duration: 320,
          easing: Easing.out(Easing.back(1.7)),
          useNativeDriver: true,
        }),
        // Phase 3: graceful settle back to rest
        Animated.timing(heartScale, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      // ── Ripple ring choreography ─────────────────────────────────────────
      // Starts slightly after the pop begins so the ring "follows" the heart.
      Animated.sequence([
        Animated.delay(60),
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1,
            duration: 480,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.sequence([
            // Fade in fast, then linger and fade out slowly for a trailing effect.
            Animated.timing(ringOpacity, {
              toValue: 0.55,
              duration: 80,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(ringOpacity, {
              toValue: 0,
              duration: 380,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
    ]);

    animRef.current = anim;
    anim.start(() => {
      animRef.current = null;
    });
  }, [heartScale, heartOpacity, ringScale, ringOpacity, onLike]);

  const ringSize = size * 2.4;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={triggerLike}
        hitSlop={12}
        style={styles.pressable}
        accessibilityRole="button"
        accessibilityLabel="Like"
      >
        {/* Ripple ring — sits behind the heart */}
        <Animated.View
          style={[
            styles.ring,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderColor: color,
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
          pointerEvents="none"
        />

        {/* Heart icon */}
        <Animated.View
          style={[
            styles.heartWrapper,
            {
              opacity: heartOpacity,
              transform: [{ scale: heartScale }],
            },
          ]}
        >
          <Text style={[styles.heart, { fontSize: size, lineHeight: size * 1.1 }]}>
            ♥
          </Text>
        </Animated.View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2.5,
  },
  heartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heart: {
    color: '#FF4458',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
