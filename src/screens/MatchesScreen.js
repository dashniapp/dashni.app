import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, Image, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';
import { clearLikesBadgeRef } from '../navigation/RootNavigator';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 14 * 2 - 10) / 2;

export default function MatchesScreen({ navigation }) {
  const [matches, setMatches] = useState([]);
  const [likes, setLikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('matches');
  const hasLoadedOnce = React.useRef(false);

  useEffect(() => {
    loadAll(true); // first load shows spinner
    const unsub = navigation.addListener('focus', () => {
      clearLikesBadgeRef.current?.(); // clear likes badge immediately on tab open
      if (hasLoadedOnce.current) loadAll(false);
      else loadAll(true);
    });
    return unsub;
  }, [navigation]);

  const loadAll = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: blockData } = await supabase
        .from('blocks').select('blocked_id').eq('blocker_id', user.id);
      const blockedIds = new Set((blockData || []).map(b => b.blocked_id));

      await Promise.all([loadMatches(user, blockedIds), loadLikes(user, blockedIds)]);
      hasLoadedOnce.current = true;
    } catch (e) {
      Alert.alert('Could not load matches', 'Please check your connection and try again.');
    }
    setLoading(false);
    setRefreshing(false);
  };

  const loadMatches = async (user, blockedIds = new Set()) => {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .or(`user_1.eq.${user.id},user_2.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error || !data) return;

    // Deduplicate by other user ID
    const seen = new Set();
    const unique = data.filter(m => {
      const otherId = m.user_1 === user.id ? m.user_2 : m.user_1;
      if (seen.has(otherId)) return false;
      seen.add(otherId);
      return true;
    });

    if (unique.length === 0) { setMatches([]); return; }

    const otherIds = unique.map(m => m.user_1 === user.id ? m.user_2 : m.user_1);
    const { data: profiles } = await supabase.from('profiles').select('id,name,age').in('id', otherIds);

    const list = unique.map(m => {
      const otherId = m.user_1 === user.id ? m.user_2 : m.user_1;
      const profile = profiles?.find(p => p.id === otherId);
      const { data: photoData } = supabase.storage.from('avatars').getPublicUrl(`${otherId}/avatar.jpg`);
      return {
        id: m.id,
        userId: otherId,
        name: profile?.name || 'User',
        age: profile?.age || '',
        initials: profile?.name ? profile.name[0].toUpperCase() : '?',
        photoUrl: photoData?.publicUrl ? photoData.publicUrl + '?t=1' : null,
      };
    });
    setMatches(list.filter(m => !blockedIds.has(m.userId)));
  };

  const loadLikes = async (user, blockedIds = new Set()) => {
    const { data, error } = await supabase
      .from('likes')
      .select('liker_id, is_super, created_at')
      .eq('liked_id', user.id)
      .order('created_at', { ascending: false });

    if (error || !data) return;

    // Deduplicate by liker_id
    const uniqueMap = {};
    data.forEach(l => { if (!uniqueMap[l.liker_id]) uniqueMap[l.liker_id] = l; });
    const unique = Object.values(uniqueMap);

    if (unique.length === 0) { setLikes([]); return; }

    const likerIds = unique.map(l => l.liker_id);
    const { data: profiles } = await supabase.from('profiles').select('id,name,age').in('id', likerIds);

    const list = unique.map((l, i) => {
      const profile = profiles?.find(p => p.id === l.liker_id);
      const isBlurred = i > 1; // first 2 visible
      const { data: photoData } = supabase.storage.from('avatars').getPublicUrl(`${l.liker_id}/avatar.jpg`);
      return {
        id: l.liker_id,
        userId: l.liker_id,
        name: isBlurred ? '???' : (profile?.name || 'User'),
        age: isBlurred ? '' : (profile?.age || ''),
        initials: profile?.name ? profile.name[0].toUpperCase() : '?',
        photoUrl: photoData?.publicUrl ? photoData.publicUrl + '?t=1' : null,
        isBlurred,
        isSuper: l.is_super,
      };
    });
    setLikes(list.filter(l => !blockedIds.has(l.userId)));
  };

  const renderCard = ({ item, isLike }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => {
        if (isLike && item.isBlurred) {
          navigation.navigate('Paywall');
          return;
        }
        navigation.navigate('Chat', {
          name: item.name,
          initials: item.initials,
          bgColor: '#14102a',
          accentColor: '#ff6b6b',
          userId: item.userId,
          photoUrl: item.photoUrl,
        });
      }}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#14102a', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.accent, fontSize: 32, fontWeight: '800' }}>{item.initials}</Text>
      </View>
      {item.photoUrl && !item.isBlurred && (
        <Image source={{ uri: item.photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}
      {item.photoUrl && item.isBlurred && (
        <Image source={{ uri: item.photoUrl }} style={[StyleSheet.absoluteFill, { opacity: 0.15 }]} resizeMode="cover" />
      )}
      {item.isBlurred && (
        <View style={styles.blurOverlay}>
          <View style={styles.lockCircle}>
            <Feather name="lock" size={20} color="#fff" />
          </View>
          <Text style={styles.lockText}>Unlock with Gold</Text>
        </View>
      )}
      {item.isSuper && !item.isBlurred && (
        <View style={styles.superBadge}>
          <Text style={styles.superText}>⭐ Super</Text>
        </View>
      )}
      <LinearGradient colors={['transparent', 'rgba(8,8,16,0.92)']} style={styles.cardGradient}>
        <Text style={styles.cardName}>
          {item.name}{item.age ? `, ${item.age}` : ''}
        </Text>
        {!item.isBlurred && (
          <Text style={styles.cardSub}>Tap to message</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  const currentData = tab === 'matches' ? matches : likes;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image source={require('../../assets/icon.png')} style={styles.logoImg} />
          <Text style={styles.logo}>Dashni</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'matches' && styles.tabActive]}
          onPress={() => setTab('matches')}
        >
          <Ionicons name="heart" size={16} color={tab === 'matches' ? colors.accent : colors.textMuted} />
          <Text style={[styles.tabText, tab === 'matches' && styles.tabTextActive]}>
            Matches {matches.length > 0 ? `(${matches.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'likes' && styles.tabActive]}
          onPress={() => setTab('likes')}
        >
          <Ionicons name="heart-outline" size={16} color={tab === 'likes' ? colors.accent : colors.textMuted} />
          <Text style={[styles.tabText, tab === 'likes' && styles.tabTextActive]}>
            Likes {likes.length > 0 ? `(${likes.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : currentData.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={{ fontSize: 52 }}>{tab === 'matches' ? '💘' : '❤️'}</Text>
          <Text style={styles.emptyTitle}>
            {tab === 'matches' ? 'No matches yet' : 'No likes yet'}
          </Text>
          <Text style={styles.emptySub}>
            {tab === 'matches' ? 'Keep swiping to find your match!' : 'Like someone to get started!'}
          </Text>
          <TouchableOpacity style={styles.swipeBtn} onPress={() => navigation.navigate('Discover')}>
            <Text style={styles.swipeBtnText}>Start swiping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 10 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => renderCard({ item, isLike: tab === 'likes' })}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 18, paddingVertical: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg: { width: 30, height: 30, borderRadius: 8 },
  logo: { fontSize: 22, fontWeight: '800', color: colors.accent, letterSpacing: -0.5 },
  tabs: { flexDirection: 'row', marginHorizontal: 14, marginBottom: 14, backgroundColor: colors.bgSurface, borderRadius: radius.lg, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md },
  tabActive: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  tabText: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: colors.accent, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  emptySub: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  swipeBtn: { backgroundColor: colors.accent, borderRadius: radius.full, paddingVertical: 12, paddingHorizontal: 32, marginTop: 8 },
  swipeBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  grid: { paddingHorizontal: 14, paddingBottom: 100 },
  card: { width: CARD_W, aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.bgCard },
  blurOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,8,16,0.75)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  lockCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,107,107,0.2)', borderWidth: 1.5, borderColor: colors.accentBorder, alignItems: 'center', justifyContent: 'center' },
  lockText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  superBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 8 },
  superText: { color: '#ffd166', fontSize: 11, fontWeight: '600' },
  cardGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 40, paddingBottom: 12, paddingHorizontal: 12 },
  cardName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardSub: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },
});
