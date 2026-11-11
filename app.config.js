const fs = require("fs");
const path = require("path");
const app = (() => {
  try {
    return require("./app.json");
  } catch {
    return {};
  }
})();

const loadLocalEnv = () => {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return {};

  return fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .reduce((values, line) => {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (match) {
        values[match[1]] = match[2]
          .replace(/;\s*$/, "")
          .replace(/^(["'])(.*)\1$/, "$2")
          .trim();
      }
      return values;
    }, {});
};

const localEnv = loadLocalEnv();
const getEnv = (name) => process.env[name] || localEnv[name] || "";

const configuredGoogleWebClientId = getEnv("GOOGLE_WEB_CLIENT_ID");
const googleAndroidClientId = getEnv("GOOGLE_ANDROID_CLIENT_ID");
const googleIosClientId = getEnv("GOOGLE_IOS_CLIENT_ID");
const isGoogleClientId = (value = "") => {
  const normalized = String(value).trim();
  return normalized.endsWith(".apps.googleusercontent.com");
};
const googleWebClientId = isGoogleClientId(configuredGoogleWebClientId)
  ? configuredGoogleWebClientId
  : getEnv("GOOGLE_CLIENT_ID");

const googlePlugin =
  isGoogleClientId(googleWebClientId) &&
  isGoogleClientId(googleAndroidClientId) &&
  isGoogleClientId(googleIosClientId)
    ? [
        "@react-native-google-signin/google-signin",
        {
          webClientId: googleWebClientId,
          androidClientId: googleAndroidClientId,
          iosClientId: googleIosClientId,
          iosUrlScheme: `com.googleusercontent.apps.${googleIosClientId.split("-")[0]}`,
        },
      ]
    : null;

const playIntegrityProjectNumber = getEnv(
  "EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER",
).trim();

if (playIntegrityProjectNumber && !/^\d+$/.test(playIntegrityProjectNumber)) {
  throw new Error(
    "Invalid Play Integrity Cloud Project Number. It must contain digits only.",
  );
}

const appExpo = app.expo || {};
const expoPlugins = [
  "expo-asset",
  "expo-audio",
  "expo-font",
  "expo-status-bar",
  "expo-video",
  "expo-web-browser",
];

module.exports = {
  ...app,
  expo: {
    ...appExpo,
    plugins: [
      ...(appExpo.plugins || []),
      ...expoPlugins,
      ...(googlePlugin ? [googlePlugin] : []),
      [
        "expo-splash-screen",
        {
          backgroundColor: "#0a0a0a",
          android: {
            drawable: {
              icon: "./assets/transparent-splash.xml",
            },
          },
          dark: {
            backgroundColor: "#0a0a0a",
          },
        },
      ],
    ],
    extra: {
      ...(appExpo.extra || {}),
      apiBaseUrl:
        getEnv("API_BASE_URL") ||
        getEnv("EXPO_PUBLIC_API_BASE_URL") ||
        "https://vidbuxapp.com",
      apiSocketBaseUrl:
        getEnv("API_SOCKET_BASE_URL") || getEnv("EXPO_PUBLIC_SOCKET_BASE_URL"),
      playIntegrityCloudProjectNumber: playIntegrityProjectNumber
        ? Number(playIntegrityProjectNumber)
        : undefined,
      google: {
        webClientId: googleWebClientId,
        androidClientId: googleAndroidClientId,
        iosClientId: googleIosClientId,
      },
    },
  },
};
