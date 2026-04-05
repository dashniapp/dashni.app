import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { usePremium } from '../hooks/usePremium';
import { colors, radius } from '../theme';
import { clearMessagesBadgeRef } from '../navigation/refs';

export default function MessagesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { hasAccess } = usePremium();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const hasLoadedOnce = useRef(false);

  const realtimeRef = React.useRef(null);

  useEffect(() => {
    loadConversations(true);

    // Realtime: reload when new message arrives
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const channel = supabase.channel('messages-list-' + user.id)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        }, () => {
          loadConversations(false); // silent refresh
        })
        .subscribe();
      realtimeRef.current = channel;
    };
    setupRealtime();

    const unsub = navigation.addListener('focus', () => {
      clearMessagesBadgeRef.current?.(); // clear messages badge immediately on tab open
      if (hasLoadedOnce.current) loadConversations(false);
      else loadConversations(true);
    });

    return () => {
      unsub();
      if (realtimeRef.current) {
        realtimeRef.current.unsubscribe();
        supabase.removeChannel(realtimeRef.current);
      }
    };
  }, [navigation]);

  const loadConversations = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Get all messages involving this user
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (!msgs || msgs.length === 0) {
        setConversations([]);
        setLoading(false);
        hasLoadedOnce.current = true;
        return;
      }

      // Group by conversation partner
      const convMap = {};
      for (const msg of msgs) {
        const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!convMap[otherId]) {
          convMap[otherId] = { lastMsg: msg, unread: 0, otherId };
        }
        if (msg.sender_id !== user.id && !msg.seen) {
          convMap[otherId].unread++;
        }
      }

      // Load profiles for each conversation partner
      const otherIds = Object.keys(convMap);
      if (otherIds.length === 0) {
        setConversations([]);
        setLoading(false);
        hasLoadedOnce.current = true;
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', otherIds);

      const convList = otherIds.map(otherId => {
        const profile = profiles?.find(p => p.id === otherId);
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(`${otherId}/avatar.jpg`);
        return {
          id: otherId,
          userId: otherId,
          name: profile?.name || 'User',
          initials: profile?.name ? profile.name[0].toUpperCase() : '?',
          photoUrl: urlData?.publicUrl || null,
          preview: convMap[otherId].lastMsg.content || '...',
          time: formatTime(convMap[otherId].lastMsg.created_at),
          unread: convMap[otherId].unread,
          online: false,
        };
      });

      setConversations(convList);
      hasLoadedOnce.current = true;
    } catch (e) {
      Alert.alert('Could not load messages', 'Please check your connection and try again.');
    }
    setLoading(false);
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
    return Math.floor(diff / 86400000) + 'd';
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => {
        if (!hasAccess) { navigation.navigate('Paywall'); return; }
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
      <View style={styles.avatarWrap}>
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.avatar} resizeMode="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{item.initials}</Text>
          </View>
        )}
        {item.online && <View style={styles.onlineDot} />}
      </View>
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{hasAccess ? item.name : '???'}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
        <View style={styles.previewRow}>
          {hasAccess ? (
            <Text style={styles.preview} numberOfLines={1}>{item.preview}</Text>
          ) : (
            <View style={styles.lockedPreview}>
              <Feather name="lock" size={11} color="rgba(255,255,255,0.3)" />
              <Text style={styles.lockedPreviewText}>Upgrade to read messages</Text>
            </View>
          )}
          {item.unread > 0 && hasAccess && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.safe, { paddingTop: insets.top + 40 }]}>
      <Text style={styles.sectionLabel}>Messages</Text>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySub}>Match with someone and start a conversation!</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  sectionLabel: { color: colors.textMuted, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 18, marginBottom: 6 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  emptySub: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  list: { paddingBottom: 100 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 78 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: '#14102a', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ff6b6b', fontSize: 18, fontWeight: '700' },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: colors.online, borderWidth: 2, borderColor: colors.bg },
  content: { flex: 1 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  time: { color: colors.textMuted, fontSize: 12 },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preview: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  lockedPreview: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  lockedPreviewText: { color: 'rgba(255,255,255,0.25)', fontSize: 12, fontStyle: 'italic' },
  unreadBadge: { backgroundColor: colors.accent, borderRadius: radius.full, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 8 },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
