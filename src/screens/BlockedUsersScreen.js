import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

export default function BlockedUsersScreen({ navigation }) {
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBlocked(); }, []);

  const loadBlocked = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('blocks')
        .select('blocked_id, created_at')
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false });

      if (error || !data?.length) { setBlocked([]); setLoading(false); return; }

      const ids = data.map(b => b.blocked_id);
      const { data: profiles } = await supabase
        .from('profiles').select('id, name, age').in('id', ids);

      const list = data.map(b => {
        const profile = profiles?.find(p => p.id === b.blocked_id);
        const { data: photoData } = supabase.storage
          .from('avatars').getPublicUrl(`${b.blocked_id}/avatar.jpg`);
        return {
          id: b.blocked_id,
          name: profile?.name || 'Deleted user',
          age: profile?.age || '',
          initials: profile?.name ? profile.name[0].toUpperCase() : '?',
          photoUrl: photoData?.publicUrl ? photoData.publicUrl + '?t=1' : null,
        };
      });
      setBlocked(list);
    } catch (e) {
      Alert.alert('Error', 'Could not load blocked users.');
    }
    setLoading(false);
  };

  const handleUnblock = useCallback((item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      `Unblock ${item.name}?`,
      `${item.name} will be able to see your profile and appear in your feed again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
              await supabase.from('blocks')
                .delete()
                .eq('blocker_id', user.id)
                .eq('blocked_id', item.id);
              setBlocked(prev => prev.filter(b => b.id !== item.id));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {
              Alert.alert('Error', 'Could not unblock. Please try again.');
            }
          },
        },
      ]
    );
  }, []);

  const renderItem = useCallback(({ item }) => (
    <View style={styles.row}>
      <View style={styles.avatar}>
        {item.photoUrl
          ? <Image source={{ uri: item.photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <Text style={styles.initials}>{item.initials}</Text>
        }
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}{item.age ? `, ${item.age}` : ''}</Text>
        <Text style={styles.sub}>Blocked</Text>
      </View>
      <TouchableOpacity style={styles.unblockBtn} onPress={() => handleUnblock(item)} activeOpacity={0.8}>
        <Text style={styles.unblockText}>Unblock</Text>
      </TouchableOpacity>
    </View>
  ), [handleUnblock]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked users</Text>
        <View style={{ width: 30 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : blocked.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={{ fontSize: 48 }}>🚫</Text>
          <Text style={styles.emptyTitle}>No blocked users</Text>
          <Text style={styles.emptySub}>Users you block will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  emptySub: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  list: { paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, gap: 14 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 18 + 46 + 14 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.bgCard, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  initials: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  info: { flex: 1, gap: 2 },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.textMuted, fontSize: 13 },
  unblockBtn: { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingVertical: 7, paddingHorizontal: 16 },
  unblockText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
});
