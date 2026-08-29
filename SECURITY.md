# Security model

This app holds passports, driving licences, insurance and registration details.
The threat model is therefore not abstract. This document states what is
protected, what is not, and the reasoning — so that future changes have to
argue with it rather than quietly erode it.

## What we defend against

| Threat | Defence |
|---|---|
| Phone stolen while locked | Data encrypted with AES-256 (SQLCipher). Key is in the Secure Enclave / Android Keystore and unreadable while the device is locked. |
| Someone holding your unlocked phone | Device authentication on launch, and again after 15 seconds in the background — biometric where enrolled, device passcode otherwise. |
| Forensic extraction of the app sandbox | The database file is ciphertext, and document photos are inside it. Without the keystore entry the whole sandbox is noise. |
| Backup or clone restored to another device | The key is `THIS_DEVICE_ONLY`, so it is excluded from iCloud Keychain and encrypted backups. The restored database cannot be decrypted. |
| A backup file falling into someone else's hands | Exports are a separate SQLCipher database keyed by a user-chosen passphrase (PBKDF2-HMAC-SHA512, 256k iterations, AES-256). The passphrase is never stored. |
| Screenshots / app-switcher thumbnails | `expo-screen-capture` blocks capture on Android and hides the preview on iOS. |
| Malicious or careless third-party SDK | There are none. No analytics, no crash reporting, no ad SDK, no telemetry. |
| Data leaving the device | No document ever is. The one network call the app makes is EAS Update's check for a new JS bundle — see "The update channel" below. |

## What we explicitly do NOT defend against

Stating these plainly is part of the model — a security document that claims
total protection is not one.

- **A compromised (jailbroken/rooted) device.** An attacker with kernel access
  can read the key out of memory while the app is unlocked. No mobile app can
  defeat this; claiming otherwise would be dishonest.
- **Someone who knows your device passcode.** Biometric prompts fall back to it
  by design, because the alternative locks people out of their own documents.
- **Shoulder surfing.** A document open on screen is visible.

## Load-bearing decisions

**The database is encrypted, and we verify it actually is.** Plain SQLite
*silently ignores* `PRAGMA key` — no error, no warning, data written in the
clear. An app can therefore look encrypted, test as encrypted, and ship as
plaintext. `src/db/init.ts` checks `PRAGMA cipher_version` returns a real value
and **refuses to open the vault otherwise**. There is deliberately no
"continue unencrypted" path.

**Losing the phone means losing the data unless the user made a backup.** The
vault key is `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. It does not sync to iCloud and
does not ride along in a device backup. The alternative — a key on Apple's
servers — is a weaker promise than the one this app makes.

The escape hatch is an explicit, user-initiated export: a second SQLCipher
database keyed by a passphrase the user chooses and the app never stores
(`src/lib/vault-export.ts`). This is deliberately NOT the device key travelling
under another name — it is separate key material, created knowingly, and a
forgotten passphrase means an unreadable file. There is no recovery path,
because a recovery path is a backdoor with better marketing.

The export is written to the cache directory and deleted as soon as the share
sheet closes, so an encrypted copy of the whole vault never lingers.

**Photos live inside the vault, not beside it.** Until v3 a document's
photograph was a loose file in the app container: the database was encrypted
and the picture of the passport next to it was not. That was the wrong way
round — the photo is the sensitive part. Photos are now rows in the encrypted
database (`document_images`), so one key covers everything, on device and in
exports alike.

**A device passcode counts as a lock.** The gate asks
`getEnrolledLevelAsync()`, not "is a fingerprint enrolled". Asking the narrower
question left a hole: a phone secured with a PIN and no biometric reported "not
enrolled" and fell through to no lock at all — precisely the devices that had a
working passcode to offer. Only `SecurityLevel.NONE`, a phone with no lock of
any kind, opens without a challenge.

**Encryption and the biometric lock are independent.** The lock stops a person
holding your unlocked phone; encryption stops someone reading the disk. Neither
substitutes for the other, so a bypass of one does not defeat the other.

**No accounts, no server, no user data in flight.** The most reliable way to
not leak someone's passport number is to never hold it. This is why cloud sync
is not in v1 — see below.

**The update channel.** This document said "makes no network calls" until EAS
Update was added, and that sentence had to change rather than be quietly kept.
On launch the app asks `u.expo.dev` whether a newer JS bundle exists, which
sends the runtime version, the platform, and an Expo-generated install ID. It
sends no document, no photograph, no passphrase, and nothing derived from the
vault — the request is made before the vault is even opened. The manifest
therefore carries `INTERNET`, and it is the only permission the app holds that
a reader of this document would not have predicted.

The trade is deliberate: a security bug in a local-first app is otherwise
unfixable for anyone who does not notice a store update, and this app is
distributed to people who have no reason to check. Accepting one metadata
request to Expo buys the ability to fix a broken lock in minutes. If that trade
stops being worth it, remove `expo-updates` — nothing else depends on it.

## Open decision: document text extraction

Reading an expiry date off a photograph can be done two ways, and they have
very different security properties:

1. **On-device OCR** (Apple Vision / Android ML Kit) — the photo never leaves
   the phone. Consistent with everything above.
2. **Cloud vision API** — better at messy documents, but the image of the
   user's passport is transmitted to a third party.

Option 2 contradicts the promise this document makes. If it is ever adopted it
must be per-document, opt-in, explicit about what is sent, and never the
default.

## When cloud sync arrives

It must be **end-to-end encrypted**: ciphertext leaves the device, the key is
derived on-device from a user passphrase, and the server can never read a
document. A conventional "encrypted at rest on our servers" design means we
hold the keys to everyone's identity documents, which is precisely the
liability this app exists to avoid. The schema already carries `user_id` and
the sync columns so this can be added without migrating anyone's data.

## Deliberately not stored

Full document numbers are optional. The app is useful knowing *that* your
passport expires in March without knowing the number, and data never collected
cannot leak.
