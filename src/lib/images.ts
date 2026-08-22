import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

const FOLDER = 'document-images';

/**
 * Where document photos live.
 *
 * A caveat worth stating plainly: SQLCipher encrypts the database, not this
 * folder. The image itself is protected by the OS file-protection class of the
 * app's private container — strong on a locked iPhone, weaker on a rooted
 * Android — but it is not covered by the vault's own key. That is why the app
 * stores a photo of a document and never asks for the document number twice.
 */
function imagesDirectory(): Directory {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function extensionOf(uri: string): string {
  const match = /\.(jpe?g|png|heic|webp)(\?|$)/i.exec(uri);
  return match ? match[1].toLowerCase() : 'jpg';
}

/**
 * Copies a picked or captured image into app storage and returns the stored
 * URI. The picker hands back a URI in a cache directory the OS is free to
 * empty; keeping that reference would give the user a document whose photo
 * silently disappears a week later.
 *
 * On web there is no such directory to copy into, and the preview build is not
 * the product — the transient URI is returned unchanged.
 */
export async function persistImage(sourceUri: string, documentId: string): Promise<string> {
  if (Platform.OS === 'web') return sourceUri;

  const directory = imagesDirectory();
  const target = new File(directory, `${documentId}-${Date.now()}.${extensionOf(sourceUri)}`);
  await new File(sourceUri).copy(target);
  return target.uri;
}

/** Best-effort. A photo already gone is the state we wanted anyway. */
export async function deleteImage(uri: string | null): Promise<void> {
  if (!uri || Platform.OS === 'web') return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Missing, already removed, or outside our directory. Nothing to undo.
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
