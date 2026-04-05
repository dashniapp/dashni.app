import AsyncStorage from '@react-native-async-storage/async-storage';

const TTL_MS = 1000 * 60 * 10; // 10 minutes
const KEY_PREFIX = 'profile:';

/**
 * Return a cached profile for userId, or null if not cached / expired.
 */
export async function getCachedProfile(userId) {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + userId);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > TTL_MS) {
      await AsyncStorage.removeItem(KEY_PREFIX + userId);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Store a profile in the cache with the current timestamp.
 */
export async function setCachedProfile(userId, data) {
  try {
    await AsyncStorage.setItem(
      KEY_PREFIX + userId,
      JSON.stringify({ data, ts: Date.now() })
    );
  } catch {}
}

/**
 * Remove every profile:* key from AsyncStorage.
 * Called from clearMediaCache() on logout.
 */
export async function clearProfileCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const profileKeys = keys.filter(k => k.startsWith(KEY_PREFIX));
    if (profileKeys.length > 0) await AsyncStorage.multiRemove(profileKeys);
  } catch {}
}
