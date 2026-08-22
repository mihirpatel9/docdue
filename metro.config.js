// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite runs on web as a WebAssembly build of SQLite, so Metro has to
// treat .wasm as a bundleable asset rather than an unknown extension.
config.resolver.assetExts.push('wasm');

// That wasm build needs SharedArrayBuffer, which browsers only expose to
// cross-origin-isolated pages. These two headers are what grant that isolation;
// without them the web preview fails at startup with an opaque error.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  return middleware(req, res, next);
};

module.exports = config;
