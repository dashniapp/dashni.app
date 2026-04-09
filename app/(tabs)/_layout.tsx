import { Tabs } from 'expo-router';
import React from 'react';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#e05a5a',
      tabBarStyle: { backgroundColor: '#0f0f0f', borderTopColor: '#222' },
      headerShown: false,
      tabBarButton: HapticTab,
    }}>
      <Tabs.Screen name="index" options={{
        title: 'Feed',
        tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
      }} />
      <Tabs.Screen name="matches" options={{
        title: 'Likes',
        tabBarIcon: ({ color }) => <IconSymbol size={28} name="heart.fill" color={color} />,
      }} />
      <Tabs.Screen name="messages" options={{
        title: 'Messages',
        tabBarIcon: ({ color }) => <IconSymbol size={28} name="bubble.fill" color={color} />,
      }} />
      <Tabs.Screen name="profile" options={{
        title: 'Profile',
        tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
      }} />
    </Tabs>
  );
}
