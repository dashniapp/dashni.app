import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { usePremium } from '../hooks/usePremium';
import { colors, radius } from '../theme';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 14 * 2 - 10) / 2;

export default function LikedYouScreen({ navigation }) {
  const [likes, setLikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { hasAccess: isPremium } = usePremium();

  useEffect(() => { loadLikes(); }, []);

  const loadLikes = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use distinct to avoid duplicates at query level
      const { data, error } = await supabase
        .from('likes')
        .select('liker_id, is_super, created_at')
        .eq('liked_id', user.id)
        .order('created_at', { ascending: false });

      if (error) return;
      if (!data || data.length === 0) { setLikes([]); setLoading(false); return; }

      // Deduplicate - one entry per person, keep most recent
      const uniqueMap = {};
      data.forEach(l => {
        if (!uniqueMap[l.liker_id]) {
          uniqueMap[l.liker_id] = l;
        }
      });
      const unique = Object.values(uniqueMap);
      const likerIds = unique.map(l => l.liker_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id,name,age')
        .in('id', likerIds);

      const likeList = unique.map((l, i) => {
        const profile = profiles?.find(p => p.id === l.liker_id);
        const { data: photoData } = supabase.storage.from('avatars').getPublicUrl(`${l.liker_id}/avatar.jpg`);
        const isBlurred = !isPremium;
        return {
          id: l.liker_id,
          name: isBlurred ? '???' : (profile?.name || 'User'),
          age: isBlurred ? '??' : (profile?.age || ''),
          initials: profile?.name ? profile.name[0].toUpperCase() : '?',
          photoUrl: photoData?.publicUrl || null,
          isSuper: l.is_super,
          isBlurred,
        };
      });

      setLikes(likeList);
    } catch (e) {}

    setLoading(false);
  };

  const renderLike = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => item.isBlurred ? navigation.navigate('Paywall') : navigation.navigate('ViewProfile', { profile: item })}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#14102a', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.accent, fontSize: 32, fontWeight: '800' }}>{item.initials}</Text>
      </View>
      {item.photoUrl ? (
        <Image
          source={{ uri: item.photoUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => {}}
        />
      ) : null}
      {item.isBlurred && <View style={styles.blurOverlay} />}
      {item.isSuper && !item.isBlurred && (
        <View style={styles.superBadge}>
          <Text style={styles.superText}>⭐ Super</Text>
        </View>
      )}
      {item.isBlurred && (
        <View style={styles.lockWrap}>
          <View style={styles.lockCircle}>
            <Feather name="lock" size={20} color="#fff" />
          </View>
          <Text style={styles.lockText}>Unlock</Text>
        </View>
      )}
      <LinearGradient colors={['transparent', 'rgba(8,8,16,0.9)']} style={styles.cardGradient}>
        <Text style={styles.cardName}>{item.name}{item.age ? `, ${item.age}` : ''}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>People who liked you</Text>
        <View style={{ width: 30 }} />
      </View>

      {!isPremium && likes.length > 0 && (
        <TouchableOpacity style={styles.unlockBanner} onPress={() => navigation.navigate('Paywall')}>
          <Ionicons name="heart" size={16} color={colors.accent} />
          <Text style={styles.unlockText}>{likes.length} {likes.length === 1 ? 'person' : 'people'} liked you — unlock to see them</Text>
          <Text style={styles.unlockBtn}>Upgrade</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : likes.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>❤️</Text>
          <Text style={styles.emptyTitle}>No likes yet</Text>
          <Text style={styles.emptySub}>Keep swiping — likes will show up here!</Text>
        </View>
      ) : (
        <FlatList
          data={likes}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 10 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={renderLike}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  unlockBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accentBorder, marginHorizontal: 14, borderRadius: radius.md, padding: 12, marginBottom: 10 },
  unlockText: { color: colors.accent, fontSize: 13, flex: 1 },
  unlockBtn: { color: '#fff', fontSize: 12, fontWeight: '700', backgroundColor: colors.accent, borderRadius: radius.full, paddingVertical: 4, paddingHorizontal: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  emptySub: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  grid: { paddingHorizontal: 14, paddingBottom: 100 },
  card: { width: CARD_W, aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.bgCard },
  blurOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,8,16,0.7)' },
  lockWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8 },
  lockCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,107,107,0.2)', borderWidth: 1.5, borderColor: colors.accentBorder, alignItems: 'center', justifyContent: 'center' },
  lockText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  superBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 8 },
  superText: { color: '#ffd166', fontSize: 11, fontWeight: '600' },
  cardGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 40, paddingBottom: 12, paddingHorizontal: 12 },
  cardName: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
