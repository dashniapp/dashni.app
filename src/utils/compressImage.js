import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Compress a picked image to max 800px wide at 70% JPEG quality.
 * Always call this before any Supabase Storage upload so we never
 * send the full-resolution picker URI to the server.
 *
 * @param {string} uri  The local URI returned by expo-image-picker
 * @returns {Promise<string>}  Compressed local URI ready to upload
 */
export async function compressImage(uri) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],   // height scales proportionally
    {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
  return result.uri;
}
