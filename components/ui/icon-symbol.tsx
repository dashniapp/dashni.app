// Cross-platform icon component.
// Uses expo-symbols (SF Symbols) on iOS and MaterialIcons as a fallback elsewhere.
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Platform } from 'react-native';
import { OpaqueColorValue, StyleProp, TextStyle } from 'react-native';

// SF Symbol → MaterialIcons name mapping
const MAPPING = {
  'house.fill': 'home',
  'heart.fill': 'favorite',
  'bubble.fill': 'chat-bubble',
  'person.fill': 'person',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'xmark': 'close',
  'gear': 'settings',
  'bell.fill': 'notifications',
  'magnifyingglass': 'search',
  'plus': 'add',
  'camera.fill': 'camera-alt',
  'photo': 'photo',
  'location.fill': 'location-on',
  'lock.fill': 'lock',
  'envelope.fill': 'email',
} as const;

export type IconSymbolName = keyof typeof MAPPING;

interface Props {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
}

export function IconSymbol({ name, size = 24, color, style }: Props) {
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={MAPPING[name] ?? 'help'}
      style={style}
    />
  );
}
