import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Image, Alert, Modal, ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import { usePremium } from '../hooks/usePremium';
import { colors, radius } from '../theme';

const { width: W } = Dimensions.get('window');
const EMOJI_REACTIONS = ['❤️', '😂', '😮', '😢', '👏', '🔥'];

export default function ChatScreen({ route, navigation }) {
  const { name, initials, bgColor, accentColor, userId, photoUrl } = route.params || {};
  const { hasAccess } = usePremium();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [myId, setMyId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [showReactions, setShowReactions] = useState(null);
  const [uploading, setUploading] = useState(false);
  const flatListRef = useRef(null);
  const subRef = useRef(null);

  useEffect(() => {
    setupChat();
    return () => {
      if (subRef.current) {
        subRef.current.unsubscribe();
        supabase.removeChannel(subRef.current);
      }
    };
  }, []);

  const setupChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);

      // Demo profile - no real userId
      const isDemo = !userId || userId === 'null' || userId === null;
      if (isDemo) {
        setMessages([{
          id: 'demo-1',
          sender_id: 'demo',
          receiver_id: user.id,
          content: 'This is a demo profile. Real messages will appear here when real users sign up!',
          type: 'text',
          created_at: new Date().toISOString(),
          seen: true,
          reactions: {},
        }]);
        return;
      }

      const otherId = userId;

      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true })
        .limit(100);

      if (data) setMessages(data);

      await supabase.from('messages').update({ seen: true })
        .eq('receiver_id', user.id).eq('sender_id', otherId);

      const channel = supabase.channel('chat-' + user.id + '-' + otherId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const msg = payload.new;
            const isRelevant =
              (msg.sender_id === user.id && msg.receiver_id === otherId) ||
              (msg.sender_id === otherId && msg.receiver_id === user.id);
            if (isRelevant) {
              setMessages(prev => {
                // Check for exact ID match or temp message replacement
                if (prev.find(m => m.id === msg.id)) return prev;
                // Remove any temp messages that match this content+sender
                const filtered = prev.filter(m => 
                  !(typeof m.id === 'string' && m.id.startsWith('temp-') && 
                    m.content === msg.content && m.sender_id === msg.sender_id)
                );
                return [...filtered, msg];
              });
              setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            }
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
          }
        })
        .subscribe();

      subRef.current = channel;
    } catch (e) {
      Alert.alert('Could not load chat', 'Please check your connection and try again.');
    }
  };

  const sendMessage = async (content, type = 'text', mediaUrl = null) => {
    if (!myId) { Alert.alert('Error', 'Not logged in'); return; }
    const isDemo = !userId || userId === 'null' || userId === null;
    if (isDemo) {
      Alert.alert('Demo profile', 'This is a demo profile. You can only message real users!');
      return;
    }
    const otherId = userId;
    const tempId = 'temp-' + Date.now();
    const msgData = {
      sender_id: myId,
      receiver_id: otherId,
      content: content || '',
      type,
      media_url: mediaUrl,
      reply_to: replyTo?.id || null,
      reply_preview: replyTo?.content ? replyTo.content.slice(0, 50) : null,
    };

    // Add to state immediately so it shows right away
    const tempMsg = { ...msgData, id: tempId, created_at: new Date().toISOString(), seen: false, reactions: {} };
    setMessages(prev => [...prev, tempMsg]);
    setReplyTo(null);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const { data, error } = await supabase.from('messages').insert(msgData).select().single();
      if (error) throw error;
      // Replace temp message with real one from DB
      if (data) setMessages(prev => prev.map(m => m.id === tempId ? data : m));
    } catch (e) {
      // Remove temp message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Failed to send', e.message);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage(text, 'text');
  };

  const sendPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to send photos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.4,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      const fileName = `${user.id}/chat_${Date.now()}.jpg`;

      const formData = new FormData();
      formData.append('file', {
        uri: result.assets[0].uri,
        name: 'chat_photo.jpg',
        type: 'image/jpeg',
      });

      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/avatars/${fileName}`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'x-upsert': 'true',
        },
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Photo upload failed');

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await sendMessage('📷 Photo', 'photo', urlData.publicUrl);
    } catch (e) {
      Alert.alert('Upload failed', e.message);
    }
    setUploading(false);
  };

  const addReaction = async (msgId, emoji) => {
    setShowReactions(null);
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const reactions = { ...(msg.reactions || {}) };
    if (reactions[emoji]) {
      if (reactions[emoji].includes(myId)) {
        reactions[emoji] = reactions[emoji].filter(id => id !== myId);
        if (!reactions[emoji].length) delete reactions[emoji];
      } else {
        reactions[emoji] = [...reactions[emoji], myId];
      }
    } else {
      reactions[emoji] = [myId];
    }
    await supabase.from('messages').update({ reactions }).eq('id', msgId);
  };


  const renderMessage = ({ item }) => {
    const isMe = item.sender_id === myId;
    const time = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const reactions = item.reactions || {};
    const hasReactions = Object.keys(reactions).length > 0;

    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && (
          <View style={[styles.avatar, { backgroundColor: bgColor || '#14102a' }]}>
            <Text style={[styles.avatarText, { color: accentColor || colors.accent }]}>{initials || '?'}</Text>
          </View>
        )}
        <View style={{ maxWidth: '72%' }}>
          {item.reply_preview ? (
            <View style={[styles.replyPreview, isMe && styles.replyPreviewMe]}>
              <View style={styles.replyAccent} />
              <Text style={styles.replyText} numberOfLines={1}>{item.reply_preview}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}
            onLongPress={() => setShowReactions(item.id)}
            activeOpacity={0.85}
          >
            {item.type === 'photo' && item.media_url ? (
              <Image source={{ uri: item.media_url }} style={styles.chatPhoto} resizeMode="cover" />
            ) : item.type === 'voice' ? (
              <View style={styles.voiceMsg}>
                <Ionicons name="mic" size={15} color={isMe ? '#fff' : colors.accent} />
                <View style={styles.voiceWave}>
                  {[4, 8, 12, 6, 10, 8, 4, 12, 6, 8].map((h, i) => (
                    <View key={i} style={[styles.voiceBar, { height: h, backgroundColor: isMe ? 'rgba(255,255,255,0.7)' : colors.accent }]} />
                  ))}
                </View>
                <Text style={[styles.voiceDur, isMe && { color: 'rgba(255,255,255,0.6)' }]}>0:05</Text>
              </View>
            ) : (
              <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.content}</Text>
            )}
            <View style={styles.msgMeta}>
              <Text style={[styles.timeText, isMe && styles.timeTextMe]}>{time}</Text>
              {isMe && (
                <Ionicons name={item.seen ? 'checkmark-done' : 'checkmark'} size={13}
                  color={item.seen ? '#4fc3f7' : 'rgba(255,255,255,0.5)'} />
              )}
            </View>
          </TouchableOpacity>

          {hasReactions && (
            <View style={[styles.reactionsRow, isMe && styles.reactionsRowMe]}>
              {Object.entries(reactions).map(([emoji, users]) => (
                <TouchableOpacity key={emoji} style={styles.reactionBadge} onPress={() => addReaction(item.id, emoji)}>
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  <Text style={styles.reactionCount}>{users.length}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.replyBtn} onPress={() => setReplyTo(item)}>
          <Feather name="corner-up-left" size={13} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerAvatarWrap}
          onPress={() => userId && navigation.navigate('ViewProfile', {
            profile: { id: userId, name, initials, photoUrl, has_video: false }
          })}
          activeOpacity={0.8}
        >
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: bgColor || '#14102a', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={[styles.headerAvatarText, { color: accentColor || colors.accent }]}>{initials || '?'}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerInfo}
          onPress={() => userId && navigation.navigate('ViewProfile', {
            profile: { id: userId, name, initials, photoUrl, has_video: false }
          })}
          activeOpacity={0.8}
        >
          <Text style={styles.headerName}>{name || 'Chat'}</Text>
          <Text style={styles.headerStatus}>Tap to view profile</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id?.toString() || Math.random().toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Say hello to {name || 'them'}! 👋</Text>
            </View>
          }
        />

        {replyTo && (
          <View style={styles.replyBar}>
            <View style={styles.replyBarAccent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.replyBarLabel}>Replying</Text>
              <Text style={styles.replyBarText} numberOfLines={1}>{replyTo.content}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Feather name="x" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {!hasAccess && (
          <TouchableOpacity style={styles.lockedBar} onPress={() => navigation.navigate('Paywall')} activeOpacity={0.85}>
            <Feather name="lock" size={16} color="rgba(255,255,255,0.4)" />
            <Text style={styles.lockedBarText}>Upgrade to send messages</Text>
            <View style={styles.lockedBarBtn}>
              <Text style={styles.lockedBarBtnText}>Upgrade</Text>
            </View>
          </TouchableOpacity>
        )}
        <View style={[styles.inputBar, !hasAccess && { display: 'none' }]}>
          <TouchableOpacity style={styles.attachBtn} onPress={sendPhoto} disabled={uploading}>
            {uploading
              ? <ActivityIndicator size="small" color={colors.accent} />
              : <Feather name="image" size={20} color={colors.textSecondary} />
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={() => {
              Alert.alert(
                'Voice Message',
                'Voice recording coming in the next update. For now you can send photos!',
                [{ text: 'OK' }]
              );
            }}
          >
            <Feather name="mic" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, input.trim() && styles.sendBtnActive]}
            onPress={handleSend}
          >
            <Feather name="send" size={18} color={input.trim() ? '#fff' : colors.textMuted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Emoji picker */}
      <Modal visible={!!showReactions} transparent animationType="fade" onRequestClose={() => setShowReactions(null)}>
        <TouchableOpacity style={styles.reactionOverlay} activeOpacity={1} onPress={() => setShowReactions(null)}>
          <View style={styles.reactionPicker}>
            {EMOJI_REACTIONS.map(emoji => (
              <TouchableOpacity key={emoji} style={styles.reactionOption} onPress={() => addReaction(showReactions, emoji)}>
                <Text style={styles.reactionOptionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
  backBtn: { padding: 4 },
  headerAvatarWrap: { marginRight: 10 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { fontSize: 14, fontWeight: '700' },
  headerInfo: { flex: 1 },
  headerName: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  headerStatus: { color: colors.online, fontSize: 11 },
  callBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  messagesList: { padding: 16, gap: 8, flexGrow: 1, paddingBottom: 20 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 6 },
  msgRowMe: { flexDirection: 'row-reverse' },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 11, fontWeight: '700' },
  replyPreview: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: colors.accent, paddingVertical: 4, paddingHorizontal: 8, marginBottom: 3, flexDirection: 'row', alignItems: 'center', gap: 6 },
  replyPreviewMe: { alignSelf: 'flex-end' },
  replyAccent: { width: 2, height: '100%', backgroundColor: colors.accent },
  replyText: { color: colors.textMuted, fontSize: 12, flex: 1 },
  bubble: { borderRadius: radius.lg, paddingVertical: 8, paddingHorizontal: 12 },
  bubbleMe: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { color: colors.textPrimary, fontSize: 15, lineHeight: 21 },
  bubbleTextMe: { color: '#fff' },
  chatPhoto: { width: 180, height: 180, borderRadius: 12 },
  voiceMsg: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  voiceWave: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  voiceBar: { width: 3, borderRadius: 2 },
  voiceDur: { color: colors.textMuted, fontSize: 11 },
  msgMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3, justifyContent: 'flex-end' },
  timeText: { color: colors.textMuted, fontSize: 10 },
  timeTextMe: { color: 'rgba(255,255,255,0.55)' },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  reactionsRowMe: { justifyContent: 'flex-end' },
  reactionBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 7 },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { color: colors.textSecondary, fontSize: 11 },
  replyBtn: { padding: 4, opacity: 0.5 },
  replyBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSurface, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 14, paddingVertical: 8, gap: 10 },
  replyBarAccent: { width: 3, height: 36, backgroundColor: colors.accent, borderRadius: 2 },
  replyBarLabel: { color: colors.accent, fontSize: 11, fontWeight: '600' },
  replyBarText: { color: colors.textSecondary, fontSize: 13 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border, gap: 6, backgroundColor: colors.bg },
  lockedBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  lockedBarText: { color: 'rgba(255,255,255,0.35)', fontSize: 14, flex: 1 },
  lockedBarBtn: { backgroundColor: '#e91e8c', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  lockedBarBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  attachBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 8, color: colors.textPrimary, fontSize: 15, maxHeight: 120 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  sendBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  reactionOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  reactionPicker: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 4 },
  reactionOption: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  reactionOptionEmoji: { fontSize: 26 },
  callOverlay: { flex: 1, backgroundColor: 'rgba(8,8,16,0.96)', alignItems: 'center', justifyContent: 'center' },
  callCard: { width: '85%', backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 28, alignItems: 'center', gap: 14 },
  callAvatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  callAvatarText: { fontSize: 28, fontWeight: '700' },
  callName: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  callStatus: { color: colors.textMuted, fontSize: 14 },
  videoPlaceholder: { width: '100%', height: 140, backgroundColor: colors.bgSurface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 8 },
  videoPlaceholderText: { color: colors.textMuted, fontSize: 13 },
  callActions: { flexDirection: 'row', gap: 14, marginTop: 8 },
  callActionBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  callEndBtn: { backgroundColor: '#e53935', borderColor: '#e53935' },
});
