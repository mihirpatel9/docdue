import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

const FOLDER = 'document-images';

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  webp: 'image/webp',
};

function extensionOf(uri: string): string {
  const match = /\.(jpe?g|png|heic|webp)(\?|$)/i.exec(uri);
  return match ? match[1].toLowerCase() : 'jpg';
}

/** Defaults to JPEG: the pickers hand back JPEG unless told otherwise. */
export function mimeForUri(uri: string): string {
  return MIME_BY_EXTENSION[extensionOf(uri)] ?? 'image/jpeg';
}

/**
 * Reads a picked image into memory as base64, ready to be written into the
 * encrypted vault.
 *
 * This replaces the old copy-to-app-storage step, and the difference is the
 * whole point: a photo of a passport now lives inside SQLCipher with everything
 * else, instead of sitting beside the database as a plain file that a rooted
 * phone or a filesystem dump could read while the text stayed sealed.
 *
 * The picker's own copy in the OS cache directory is left alone — it is not
 * ours to manage, and the OS reclaims it. Nothing we write persists outside the
 * database.
 */
export async function readImageForVault(
  sourceUri: string
): Promise<{ data: string; mime: string }> {
  const data = await new File(sourceUri).base64();
  return { data, mime: mimeForUri(sourceUri) };
}

/**
 * What `<Image>` wants. A data URI keeps the decrypted bytes in memory for as
 * long as the view is mounted and never touches disk — writing a temp file to
 * render it would undo the encryption this migration just bought.
 */
export function imageDataUri(image: { data: string; mime: string }): string {
  return `data:${image.mime};base64,${image.data}`;
}

/**
 * Removes the legacy photo folder once every file in it has been adopted into
 * the vault. Called after the V3 adoption sweep; a no-op on a fresh install
 * that never had one.
 */
export async function removeLegacyImageFolder(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const dir = new Directory(Paths.document, FOLDER);
    if (dir.exists) dir.delete();
  } catch {
    // Still holding a file the sweep could not adopt. It will be retried on the
    // next launch, and an empty directory is not worth failing a startup over.
  }
}

export type PickResult = { uri: string } | { error: string } | null;

/** null means the user backed out, which is not an error and needs no message. */
export async function pickFromLibrary(): Promise<PickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { error: 'Photo access is off. Turn it on in Settings to attach a picture.' };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return { uri: result.assets[0].uri };
}

export async function captureWithCamera(): Promise<PickResult> {
  if (Platform.OS === 'web') {
    return { error: 'The camera is only available in the iOS and Android app.' };
  }

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return { error: 'Camera access is off. Turn it on in Settings to photograph a document.' };
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return { uri: result.assets[0].uri };
}
