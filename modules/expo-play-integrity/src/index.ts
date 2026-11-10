import { requireNativeModule } from "expo-modules-core";

type PlayIntegrityModule = {
  requestIntegrityToken(
    cloudProjectNumber: number,
    nonce: string,
  ): Promise<string>;
};

export const requestIntegrityToken = (
  cloudProjectNumber: number,
  nonce: string,
) =>
  requireNativeModule<PlayIntegrityModule>(
    "PlayIntegrity",
  ).requestIntegrityToken(cloudProjectNumber, nonce);
