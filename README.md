# Expiry Vault

Passports, licences, insurance, registrations — the documents that quietly
expire and cost you a border crossing, a fine, or a claim. Expiry Vault keeps
their dates and photographs on your phone, encrypted, and tells you before they
lapse.

It has no account, no server, and no copy of your documents anywhere but the
device in your hand.

## What it does

- **Tracks expiry dates** with a grouped, searchable list — expired, expiring
  soon, and everything else.
- **Stores the photograph inside the encrypted database**, not as a loose file
  next to it. The picture of a passport is the sensitive part.
- **Reminds you** ahead of each expiry through local notifications. No push
  server is involved.
- **Locks behind biometrics** — or the device passcode, on phones with no
  fingerprint enrolled.
- **Exports an encrypted backup** keyed by a passphrase you choose and the app
  never stores. Losing the phone otherwise loses the vault, by design.

## Security

The vault is a SQLCipher database (AES-256) whose key lives in the platform
keystore as `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, so it is deliberately excluded
from iCloud and Android backups. `src/db/init.ts` verifies `PRAGMA
cipher_version` at startup and **refuses to open the vault** if encryption is
not real — there is no "continue unencrypted" path.

**[`SECURITY.md`](SECURITY.md) is the load-bearing document.** It states the
threat model, and just as importantly what the app does *not* defend against.
It is meant to be argued with rather than quietly eroded: if a change weakens
something it promises, the promise gets rewritten in the same commit.

## Stack

Expo SDK 57 · React Native 0.86 · expo-router · TypeScript · SQLCipher via
`expo-sqlite`. React Compiler and typed routes are on.

## Development

```bash
npm install
npx expo start        # requires a development build, not Expo Go
npm run typecheck     # tsc --noEmit
npm test              # node --experimental-strip-types, no emulator needed
```

Expo Go cannot run this app — SQLCipher, biometrics, and secure storage are all
native. Build a development client with EAS:

```bash
eas build --profile development --platform android
```

`npx expo start --web` renders the layout only. It runs the `IS_INSECURE_PREVIEW`
path with no SQLCipher, no lock, and no notifications, so it must never be used
to claim the security model works.

### Verifying encryption is real

```bash
adb shell run-as com.mihirpatel.expiryvault \
  cat files/SQLite/expiry-vault.db | head -c 16 | od -c
```

Random bytes mean SQLCipher is working. If it ever reads `SQLite format 3`, the
vault is shipping plaintext.

Note that `adb shell screencap` returns a 0-byte file. That is `expo-screen-capture`
setting `FLAG_SECURE` — the app working, not a bug.

## Licence

MIT — see [LICENSE](LICENSE).
