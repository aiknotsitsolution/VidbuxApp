import Toast from "react-native-toast-message";

type ToastType = "success" | "error" | "info";

export const showToast = (
  type: ToastType,
  title: string,
  message?: string,
  visibilityTime = 4500,
) => {
  Toast.show({
    type,
    text1: title,
    visibilityTime,
    ...(message ? { text2: message } : {}),
  });
};
