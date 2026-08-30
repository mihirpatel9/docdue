import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY_NAME = 'docdue.db.key';

/**
 * The database encryption key lives in the platform keystore — iOS Keychain,
 * Android Keystore — which is hardware-backed on modern devices. The key never
 * touches the app's own storage, never appears in JS beyond the moment it is
 * handed to SQLCipher, and never leaves the device.
 *
 * `WHEN_UNLOCKED_THIS_DEVICE_ONLY` is doing real work here:
 *  - WHEN_UNLOCKED: the key is unreadable while the phone is locked, so a
 *    seized-and-powered-on-but-locked phone yields nothing.
 *  - THIS_DEVICE_ONLY: it is excluded from iCloud Keychain and from encrypted
 *    device backups. Restoring the backup onto another phone restores the
 *    database file but NOT the key, so the copy is unreadable ciphertext.
 *
 * The cost of that last property is real and deliberate: lose the phone and the
 * documents are gone. For a vault of passports and licences that is the correct
 * default — the alternative is a key that syncs to Apple's servers.
 */
export async function getOrCreateDatabaseKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (existing) return existing;

  // 32 bytes = AES-256, from the platform CSPRNG. Handed to SQLCipher as a raw
  // hex key so it is used verbatim rather than run through PBKDF2 — key
  // derivation buys nothing when the input is already full-entropy random.
  const bytes = await Crypto.getRandomBytesAsync(32);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  await SecureStore.setItemAsync(KEY_NAME, hex, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  return hex;
}
