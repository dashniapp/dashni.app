import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Image, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

export default function AdminScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigation.goBack(); return; }
      const { data: profile } = await supabase
        .from('profiles').select('is_admin').eq('id', user.id).single();
      if (!profile?.is_admin) { navigation.goBack(); return; }
      loadUsers();
    } catch (e) { navigation.goBack(); }
  };

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) { setFiltered(users); return; }
    setFiltered(users.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.location?.toLowerCase().includes(q) ||
      String(u.age).includes(q)
    ));
  }, [search, users]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id,name,age,gender,location,has_video,verification_status,created_at')
        .order('created_at', { ascending: false });

      const enriched = (data || []).map(p => {
        const { data: ph } = supabase.storage.from('avatars').getPublicUrl(`${p.id}/avatar.jpg`);
        return {
          ...p,
          photoUrl: ph?.publicUrl ? `${ph.publicUrl}?t=${p.id}` : null,
        };
      });
      setUsers(enriched);
      setFiltered(enriched);
    } catch (e) {
      Alert.alert('Error', 'Failed to load users.');
    }
    setLoading(false);
  };

  const deleteUser = useCallback((user) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      `Delete ${user.name}?`,
      'This will permanently delete their account, profile, matches, and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            setDeleting(user.id);
            try {
              // Delete storage files first
              await supabase.storage.from('avatars').remove([
                `${user.id}/avatar.jpg`,
                `${user.id}/photo_1.jpg`, `${user.id}/photo_2.jpg`,
                `${user.id}/photo_3.jpg`, `${user.id}/photo_4.jpg`,
                `${user.id}/photo_5.jpg`,
              ]);
              await supabase.storage.from('videos').remove([`${user.id}/profile.mp4`]);

              // Try RPC (removes auth user too)
              const { error: rpcError } = await supabase.rpc('admin_delete_user', {
                target_user_id: user.id,
              });

              if (rpcError) {
                // Fallback: delete all table data manually
                await supabase.from('messages').delete().or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
                await supabase.from('matches').delete().or(`user_1.eq.${user.id},user_2.eq.${user.id}`);
                await supabase.from('likes').delete().or(`liker_id.eq.${user.id},liked_id.eq.${user.id}`);
                await supabase.from('blocks').delete().or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
                await supabase.from('passes').delete().or(`user_id.eq.${user.id},profile_id.eq.${user.id}`);
                await supabase.from('reports').delete().eq('reporter_id', user.id);
                await supabase.from('profiles').delete().eq('id', user.id);
              }

              setUsers(prev => prev.filter(u => u.id !== user.id));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {
              Alert.alert('Error', 'Failed to delete user. Try again.');
            }
            setDeleting(null);
          },
        },
      ]
    );
  }, []);

  const renderItem = useCallback(({ item }) => (
    <View style={styles.row}>
      <View style={styles.avatar}>
        {item.photoUrl
          ? <Image source={{ uri: item.photoUrl }} style={styles.avatarImg} />
          : <Text style={styles.avatarInitial}>{item.name?.[0]?.toUpperCase() ?? '?'}</Text>
        }
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{item.name ?? 'Unknown'}</Text>
          {item.verification_status === 'verified' && (
            <Feather name="check-circle" size={13} color="#3b82f6" />
          )}
          {item.has_video && (
            <Feather name="video" size={13} color={colors.accent} />
          )}
        </View>
        <Text style={styles.meta}>
          {[item.age ? `${item.age} yrs` : null, item.gender, item.location]
            .filter(Boolean).join(' · ')}
        </Text>
      </View>
      {deleting === item.id
        ? <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 4 }} />
        : (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => deleteUser(item)}
            activeOpacity={0.8}
          >
            <Feather name="trash-2" size={16} color="#ff4d4d" />
          </TouchableOpacity>
        )
      }
    </View>
  ), [deleting, deleteUser]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="x" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <TouchableOpacity onPress={loadUsers} style={styles.backBtn}>
          <Feather name="refresh-cw" size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Feather name="search" size={15} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, location, age..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.countLabel}>
        {loading ? 'Loading...' : `${filtered.length} of ${users.length} users`}
      </Text>

      {loading
        ? <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )
      }
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 4, width: 36 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, margin: 14, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  countLabel: { color: colors.textMuted, fontSize: 12, paddingHorizontal: 18, marginBottom: 4 },
  list: { paddingHorizontal: 14, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  separator: { height: 1, backgroundColor: colors.border },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12 },
  deleteBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,77,77,0.12)', borderWidth: 1, borderColor: 'rgba(255,77,77,0.25)', alignItems: 'center', justifyContent: 'center' },
});
