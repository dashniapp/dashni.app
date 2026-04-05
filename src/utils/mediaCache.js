import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearProfileCache } from './profileCache';

/**
 * clearMediaCache()
 *
 * Call this immediately before supabase.auth.signOut() so the next
 * user who logs in on this device starts with a clean slate.
 *
 * Clears three layers of cache:
 *  1. On-disk media files in expo-file-system's cacheDirectory
 *     (photos/videos cached by expo-image and manual downloads)
 *  2. All profile: keys in AsyncStorage (profileCache TTL store)
 *  3. The feed:cache key in AsyncStorage (stale-while-revalidate store)
 */
export async function clearMediaCache() {
  await Promise.all([
    _clearFilesystemCache(),
    clearProfileCache(),
    AsyncStorage.removeItem('feed:cache'),
  ]);
}

async function _clearFilesystemCache() {
  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return;
    const contents = await FileSystem.readDirectoryAsync(cacheDir);
    await Promise.all(
      contents
        .filter(name => /\.(jpg|jpeg|png|webp|mp4|mov)$/i.test(name))
        .map(name =>
          FileSystem.deleteAsync(cacheDir + name, { idempotent: true })
        )
    );
  } catch (e) {
    console.warn('clearMediaCache: filesystem clear failed silently:', e);
  }
}
