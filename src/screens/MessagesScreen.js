import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';
import { clearMessagesBadgeRef } from '../navigation/RootNavigator';

export default function MessagesScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState(null);
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
      setMyId(user.id);

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
      onPress={() => navigation.navigate('Chat', {
        name: item.name,
        initials: item.initials,
        bgColor: '#14102a',
        accentColor: '#ff6b6b',
        userId: item.userId,
        photoUrl: item.photoUrl,
      })}
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
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
        <View style={styles.previewRow}>
          <Text style={styles.preview} numberOfLines={1}>{item.preview}</Text>
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image source={require('../../assets/icon.png')} style={styles.logoImg} />
          <Text style={styles.logo}>Dashni</Text>
        </View>
      </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 18, paddingVertical: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg: { width: 30, height: 30, borderRadius: 8 },
  logo: { fontSize: 22, fontWeight: '800', color: colors.accent, letterSpacing: -0.5 },
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
  unreadBadge: { backgroundColor: colors.accent, borderRadius: radius.full, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 8 },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
