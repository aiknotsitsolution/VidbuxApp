import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { requestIntegrityToken } from "expo-play-integrity";

export const getSignupIntegrityProof = async () => {
  if (Platform.OS !== "android") return {};

  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (isExpoGo || __DEV__) {
    return {
      integrityNonce: Crypto.randomUUID(),
      playIntegrityToken: "DEV_BYPASS_TOKEN",
    };
  }

  const cloudProjectNumber = Number(
    Constants.expoConfig?.extra?.playIntegrityCloudProjectNumber ??
      process.env.EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER,
  );
  if (!Number.isSafeInteger(cloudProjectNumber) || cloudProjectNumber <= 0) {
    throw new Error(
      "Android signup security is not configured. Set EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER to your linked Google Cloud project number and rebuild the app.",
    );
  }

  const integrityNonce = Crypto.randomUUID();
  let playIntegrityToken: string;
  try {
    playIntegrityToken = await requestIntegrityToken(
      cloudProjectNumber,
      integrityNonce,
    );
  } catch (error) {
    console.error("Could not request Android Play Integrity proof:", error);
    const isNativeModuleMissing =
      error instanceof Error &&
      error.message.includes("Cannot find native module 'PlayIntegrity'");
    throw new Error(
      isNativeModuleMissing
        ? "Play Integrity is missing from this installed app. Expo Go cannot load native modules; rebuild and reinstall the Android app, then start with npm start."
        : "This Android app version could not complete secure registration. Update the app and try again.",
    );
  }

  return { integrityNonce, playIntegrityToken };
};
