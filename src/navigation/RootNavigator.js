import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
  Image,
} from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

// Screens
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import MatchesScreen from '../screens/MatchesScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import VideoUploadScreen from '../screens/VideoUploadScreen';
import ViewProfileScreen from '../screens/ViewProfileScreen';
import FiltersScreen from '../screens/FiltersScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LikedYouScreen from '../screens/LikedYouScreen';
import BoostScreen from '../screens/BoostScreen';
import VerificationScreen from '../screens/VerificationScreen';
import BlockReportScreen from '../screens/BlockReportScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';
import CompleteProfileScreen from '../screens/CompleteProfileScreen';
import AdminScreen from '../screens/AdminScreen';
import PaywallScreen from '../screens/PaywallScreen';
import PremiumScreen from '../screens/PremiumScreen';
import LegalScreen from '../screens/LegalScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const { width: W } = Dimensions.get('window');

// Module-level ref so CompleteProfileScreen can call back without nav params
export const onProfileCompleteRef = { current: null };

const TABS = [
  { name: 'Discover', icon: 'play-circle', lib: 'feather' },
  { name: 'Matches', icon: 'heart', lib: 'feather' },
  { name: 'Messages', icon: 'message-circle', lib: 'feather' },
  { name: 'Profile', icon: 'user', lib: 'feather' },
];

function DynamicIslandTabBar({ state, descriptors, navigation }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [newLikesCount, setNewLikesCount] = useState(0);
  const anims = useRef(TABS.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

  const realtimeRef = React.useRef(null);

  // Load unread count + subscribe to realtime changes
  useEffect(() => {
    loadUnread();

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Subscribe to new messages and new likes in real time
      const channel = supabase.channel('tab-badges-' + user.id)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        }, () => {
          loadUnread(); // new message — refresh badge instantly
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'likes',
          filter: `liked_id=eq.${user.id}`,
        }, () => {
          loadUnread(); // new like — refresh badge instantly
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
        }, () => {
          loadUnread(); // new match — refresh badge
        })
        .subscribe();

      realtimeRef.current = channel;
    };

    setupRealtime();

    return () => {
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    };
  }, []);

  const loadUnread = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Unread messages
      const { count: msgCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('seen', false);
      setUnreadCount(msgCount || 0);

      // New likes that haven't been matched yet
      const { data: likeRows } = await supabase
        .from('likes')
        .select('liker_id')
        .eq('liked_id', user.id);

      // Get existing matches to filter out already-matched likes
      const { data: matchRows } = await supabase
        .from('matches')
        .select('user_1, user_2')
        .or(`user_1.eq.${user.id},user_2.eq.${user.id}`);

      const matchedIds = new Set();
      (matchRows || []).forEach(m => {
        matchedIds.add(m.user_1 === user.id ? m.user_2 : m.user_1);
      });

      // Count likes from people you haven't matched with yet
      const unmatched = (likeRows || []).filter(l => !matchedIds.has(l.liker_id));
      setNewLikesCount(unmatched.length);
    } catch (e) {}
  };

  useEffect(() => {
    TABS.forEach((_, i) => {
      Animated.spring(anims[i], {
        toValue: state.index === i ? 1 : 0,
        useNativeDriver: false,
        friction: 6,
      }).start();
    });
  }, [state.index]);

  return (
    <View style={styles.tabBarWrap} pointerEvents="box-none">
      <View style={styles.tabBar}>
        {TABS.map((tab, i) => {
          const isActive = state.index === i;
          const showBadge = (tab.name === 'Messages' && unreadCount > 0) ||
                             (tab.name === 'Matches' && newLikesCount > 0);
          const badgeNum = tab.name === 'Messages' ? unreadCount : newLikesCount;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => navigation.navigate(tab.name)}
              activeOpacity={0.7}
            >
              <View style={{ position: 'relative' }}>
                <Feather
                  name={tab.icon}
                  size={22}
                  color={isActive ? colors.accent : 'rgba(255,255,255,0.45)'}
                />
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {badgeNum > 9 ? '9+' : badgeNum}
                    </Text>
                  </View>
                )}
              </View>
              {isActive && (
                <View style={styles.activeDot} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function AppTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <DynamicIslandTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {TABS.map(tab => {
        const Screen = {
          Discover: DiscoverScreen,
          Matches: MatchesScreen,
          Messages: MessagesScreen,
          Profile: ProfileScreen,
        }[tab.name];
        return <Tab.Screen key={tab.name} name={tab.name} component={Screen} />;
      })}
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Legal" component={LegalScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="App" component={AppTabs} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="VideoUpload" component={VideoUploadScreen} />
      <Stack.Screen name="ViewProfile" component={ViewProfileScreen} />
      <Stack.Screen name="Filters" component={FiltersScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="LikedYou" component={LikedYouScreen} />
      <Stack.Screen name="Boost" component={BoostScreen} />
      <Stack.Screen name="Verification" component={VerificationScreen} />
      <Stack.Screen name="BlockReport" component={BlockReportScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="Paywall" component={PaywallScreen} />
      <Stack.Screen name="Premium" component={PremiumScreen} />
      <Stack.Screen name="Legal" component={LegalScreen} />
      <Stack.Screen name="Admin" component={AdminScreen} />
    </Stack.Navigator>
  );
}

function CompleteProfileGate() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="VideoUpload" component={VideoUploadScreen} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);

  const checkProfile = async (userId) => {
    try {
      const { data: profile } = await supabase
        .from('profiles').select('has_video').eq('id', userId).single();
      const { data: files } = await supabase.storage
        .from('avatars').list(userId, { limit: 5 });
      const hasPhoto = (files || []).some(f => f.name === 'avatar.jpg');
      setProfileComplete(!!(profile?.has_video && hasPhoto));
    } catch (e) {
      setProfileComplete(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) checkProfile(session.user.id).then(() => setLoading(false));
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) checkProfile(session.user.id);
      else setProfileComplete(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  onProfileCompleteRef.current = () => setProfileComplete(true);

  if (loading) return null;

  if (!session) return <AuthStack />;
  if (!profileComplete) return <CompleteProfileGate />;
  return <AppStack />;
}

const styles = StyleSheet.create({
  tabBarWrap: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(18,18,28,0.95)',
    borderRadius: 32,
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  tabItem: {
    alignItems: 'center',
    gap: 4,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
});
