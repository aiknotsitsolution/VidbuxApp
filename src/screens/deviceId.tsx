import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { Platform } from "react-native";
import { v4 as uuidv4 } from "uuid";

export const getClientHardwareUuid = async () => {
  try {
    const hardwareId =
      Platform.OS === "android"
        ? Application.getAndroidId()
        : Platform.OS === "ios"
          ? await Application.getIosIdForVendorAsync()
          : null;

    if (hardwareId) {
      return `${Platform.OS}:${hardwareId}`;
    }

    let clientHardwareUuid = await AsyncStorage.getItem("clientHardwareUuid");
    if (!clientHardwareUuid) {
      clientHardwareUuid = uuidv4();
      await AsyncStorage.setItem("clientHardwareUuid", clientHardwareUuid);
    }

    return clientHardwareUuid;
  } catch (error) {
    console.error("Error getting client hardware UUID:", error);
    return uuidv4();
  }
};
