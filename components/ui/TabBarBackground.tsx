import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

// Transparent tab bar background — styling is handled via tabBarStyle in _layout.
export default function TabBarBackground() {
  return null;
}

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
