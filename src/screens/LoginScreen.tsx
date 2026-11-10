import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowRight,
  ChevronLeft,
  CheckCircle2,
  Play,
  Headphones,
  Disc3,
  Music2,
  Radio,
  Tv,
  Clapperboard,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { API_BASE, API_PLATFORM_HEADER } from "../../config/api";
import { getClientHardwareUuid } from "./deviceId";
import { getSignupIntegrityProof } from "../utils/signupIntegrity";

WebBrowser.maybeCompleteAuthSession();

const { width } = Dimensions.get("window");

const googleConfig = Constants.expoConfig?.extra?.google || {};
const GOOGLE_WEB_CLIENT_ID = googleConfig.webClientId || "";
const GOOGLE_ANDROID_CLIENT_ID = googleConfig.androidClientId || "";
const GOOGLE_IOS_CLIENT_ID = googleConfig.iosClientId || "";
const isGoogleClientId = (value = "") => {
  const normalized = String(value).trim();
  return normalized.endsWith(".apps.googleusercontent.com");
};
const GOOGLE_CONFIGURED = Boolean(
  isGoogleClientId(GOOGLE_WEB_CLIENT_ID) &&
  isGoogleClientId(GOOGLE_ANDROID_CLIENT_ID) &&
  isGoogleClientId(GOOGLE_IOS_CLIENT_ID),
);

const getDeviceCookieHeader = (clientHardwareUuid) =>
  `device_id=${encodeURIComponent(clientHardwareUuid)}`;

export default function LoginScreen({ navigation, onAuthenticated }) {
  const [isLogin, setIsLogin] = useState(true);
  const [authMethod, setAuthMethod] = useState("email");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP states
  const [otpRequired, setOtpRequired] = useState(false);
  const [otp, setOtp] = useState("");
  const [developmentOtp, setDevelopmentOtp] = useState("");
  const [migrationMode, setMigrationMode] = useState(false);
  const [migrationEmailOtp, setMigrationEmailOtp] = useState("");
  const [migrationPhoneOtp, setMigrationPhoneOtp] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [registrationPhoneRequired, setRegistrationPhoneRequired] =
    useState(false);
  const [pendingRegistration, setPendingRegistration] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [resetStep, setResetStep] = useState(0);
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetOtpCountdown, setResetOtpCountdown] = useState(0);
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] =
    useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetResending, setResetResending] = useState(false);
  // ========== Animations ==========
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const ambientMotion = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(1)).current;
  const formTranslate = useRef(new Animated.Value(0)).current;
  const otpAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const tabIndicator = useRef(new Animated.Value(0)).current;

  // Card entrance
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientMotion, {
          toValue: 1,
          duration: 9000,
          useNativeDriver: true,
        }),
        Animated.timing(ambientMotion, {
          toValue: 0,
          duration: 9000,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [ambientMotion]);

  // Tab indicator animation
  useEffect(() => {
    Animated.spring(tabIndicator, {
      toValue: isLogin ? 0 : 1,
      useNativeDriver: false,
      tension: 80,
      friction: 12,
    }).start();
  }, [isLogin]);

  // Form switch animation
  const animateFormSwitch = (callback) => {
    Animated.parallel([
      Animated.timing(formOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(formTranslate, {
        toValue: isLogin ? -20 : 20,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
      formTranslate.setValue(isLogin ? 20 : -20);
      Animated.parallel([
        Animated.timing(formOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(formTranslate, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();
    });
  };

  // OTP appear animation
  useEffect(() => {
    if (otpRequired) {
      otpAnim.setValue(0);
      Animated.spring(otpAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 70,
        friction: 10,
      }).start();
    }
  }, [otpRequired]);

  // Button press animation
  const onPressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();
  };
  const onPressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();
  };

  // ========== Google Auth ==========
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    scopes: ["profile", "email"],
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { authentication } = response;
      handleGoogleSuccess(authentication, response);
    } else if (response?.type === "error") {
      setGoogleLoading(false);
      Toast.show({
        type: "error",
        text1: "Google Sign-In Failed",
        text2: String(response.error || "Something went wrong"),
      });
    } else if (response?.type === "dismiss" || response?.type === "cancel") {
      setGoogleLoading(false);
    }
  }, [response]);

  // OTP countdown
  useEffect(() => {
    if (!otpRequired || otpCountdown <= 0) return;
    const timer = setTimeout(() => {
      setOtpCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [otpRequired, otpCountdown]);

  useEffect(() => {
    if (resetStep !== 2 || resetOtpCountdown <= 0) return;
    const timer = setTimeout(() => {
      setResetOtpCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [resetStep, resetOtpCountdown]);

  const handleGoogleSuccess = async (authentication, authResponse) => {
    try {
      setGoogleLoading(true);
      const idToken = authentication?.idToken || authResponse?.params?.id_token;

      if (!idToken) throw new Error("Google token not received");
      const clientHardwareUuid = await getClientHardwareUuid();
      const deviceCookie = getDeviceCookieHeader(clientHardwareUuid);
      const sendGoogleCredential = (integrityProof = {}) =>
        fetch(`${API_BASE}/auth/google`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Cookie: deviceCookie,
            ...API_PLATFORM_HEADER,
          },
          body: JSON.stringify({
            credential: idToken,
            clientHardwareUuid,
            ...integrityProof,
          }),
        });

      let res = await sendGoogleCredential();
      let data = await res.json();
      if (!res.ok && data.code === "PLAY_INTEGRITY_REQUIRED") {
        res = await sendGoogleCredential(await getSignupIntegrityProof());
        data = await res.json();
      }
      if (!res.ok)
        throw new Error(data.message || "Google authentication failed");

      if (data.needsPhoneBinding) {
        setPendingRegistration(data);
        setRegistrationPhoneRequired(true);
        setFormData((current) => ({
          ...current,
          name: data.user?.name || current.name,
          email: data.user?.email || current.email,
        }));
        return;
      }

      await handleAuthSuccess(data);
    } catch (err) {
      console.error("Google auth error:", err);
      Toast.show({
        type: "error",
        text1: "Google Sign-In Error",
        text2: err.message || "Something went wrong",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
    if (error) setError("");
    if (
      field === "email" ||
      field === "password" ||
      field === "name" ||
      field === "phone"
    ) {
      setOtpRequired(false);
      setDevelopmentOtp("");
      setOtp("");
      setMigrationEmailOtp("");
      setMigrationPhoneOtp("");
      setOtpCountdown(0);
    }
  };

  const handleAuthSuccess = async (data) => {
    try {
      const token = data?.token || data?.user?.token || data?.accessToken;
      const user = data?.user || {};

      if (!token) {
        throw new Error(
          data?.message || "Authentication response did not include a token",
        );
      }

      await AsyncStorage.setItem("token", String(token));
      await AsyncStorage.setItem("user", JSON.stringify(user));
      onAuthenticated?.();
      navigation.replace(
        "AdminPanel",
        data.needsEmailBinding ? { screen: "Profile" } : undefined,
      );

      Toast.show({
        type: "success",
        text1: "Welcome!",
        text2: "Authentication successful.",
        position: "top",
        visibilityTime: 2500,
      });
    } catch (e) {
      console.error("Failed to save auth data", e);
      Toast.show({
        type: "error",
        text1: "Authentication Error",
        text2: e?.message || "Session could not be saved.",
      });
    }
  };

  const handleEmailSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const clientHardwareUuid = await getClientHardwareUuid();
      const deviceCookie = getDeviceCookieHeader(clientHardwareUuid);
      if (registrationPhoneRequired) {
        const phone = formData.phone.replace(/\D/g, "");
        if (!pendingRegistration?.token) {
          throw new Error("Your account setup session expired. Please sign in again.");
        }
        if (!/^\d{10}$/.test(phone)) {
          throw new Error("Enter a valid 10-digit Indian mobile number.");
        }

        const response = await fetch(`${API_BASE}/phone/map`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${pendingRegistration.token}`,
            Cookie: deviceCookie,
            ...API_PLATFORM_HEADER,
          },
          body: JSON.stringify({ phone: `+91${phone}`, clientHardwareUuid }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Could not save your mobile number.");
        }

        setRegistrationPhoneRequired(false);
        setPendingRegistration(null);
        await handleAuthSuccess({
          ...pendingRegistration,
          user: data.user || pendingRegistration.user,
          needsPhoneBinding: false,
        });
        return;
      }

      const email = formData.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Enter a valid email address.");
      }
      if (isLogin && !otpRequired && !formData.password) {
        throw new Error("Password is required.");
      }
      if (!isLogin && !formData.name.trim()) {
        throw new Error("Full name is required.");
      }
      if (!isLogin && formData.password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }
      if (otpRequired && !/^\d{6}$/.test(otp)) {
        throw new Error("Enter the six-digit OTP sent to your email.");
      }

      const integrityProof = isLogin ? {} : await getSignupIntegrityProof();
      const response = await fetch(`${API_BASE}/${isLogin ? "login" : "register"}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: deviceCookie,
          ...API_PLATFORM_HEADER,
        },
        body: JSON.stringify({
          ...(isLogin ? {} : { name: formData.name.trim() }),
          email,
          password: formData.password,
          ...(otpRequired ? { otp } : {}),
          clientHardwareUuid,
          ...integrityProof,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Authentication failed.");
      }

      if (data.requiresOtp) {
        setOtpRequired(true);
        setOtp("");
        setDevelopmentOtp(data.otpCode || "");
        setOtpCountdown(data.retryAfterSeconds || 60);
        setError(data.message || "A verification code was sent to your email.");
        return;
      }

      if (!isLogin && data.needsPhoneBinding) {
        setPendingRegistration(data);
        setRegistrationPhoneRequired(true);
        setFormData((current) => ({
          ...current,
          name: data.user?.name || current.name,
          email: data.user?.email || current.email,
          phone: "",
        }));
        setOtpRequired(false);
        setOtp("");
        return;
      }

      await handleAuthSuccess(data);
    } catch (err) {
      const errorMsg = err.message || "Authentication failed.";
      setError(errorMsg);
      Toast.show({ type: "error", text1: "Authentication Error", text2: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const startPasswordReset = () => {
    setResetEmail(formData.email.trim().toLowerCase());
    setResetOtp("");
    setResetToken("");
    setResetPassword("");
    setResetConfirmPassword("");
    setResetOtpCountdown(0);
    setResetStep(1);
    setError("");
  };

  const backFromPasswordReset = () => {
    if (resetStep === 1 || resetStep === 4) {
      setResetStep(0);
      setResetToken("");
      setResetOtp("");
    } else {
      setResetStep(1);
      setResetOtp("");
      setResetToken("");
      setResetOtpCountdown(0);
    }
    setError("");
  };

  const handleRequestResetOtp = async () => {
    const normalizedEmail = resetEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setResetBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to send verification code.");
      }

      setResetEmail(normalizedEmail);
      setResetStep(2);
      setResetOtp("");
      setResetOtpCountdown(60);
      Toast.show({
        type: "info",
        text1: "Verification code sent",
        text2: "If an account exists, check your email for the code.",
      });
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setResetBusy(false);
    }
  };

  const handleResendResetOtp = async () => {
    if (resetOtpCountdown > 0 || resetBusy) return;
    setResetResending(true);
    try {
      await handleRequestResetOtp();
    } finally {
      setResetResending(false);
    }
  };

  const handleVerifyResetOtp = async () => {
    if (!/^\d{6}$/.test(resetOtp)) {
      setError("Please enter a valid 6-digit verification code.");
      return;
    }

    setResetBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/verify-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail, otp: resetOtp }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.resetToken) {
        throw new Error(
          data.message || "Verification failed. Please try again.",
        );
      }

      setResetToken(data.resetToken);
      setResetStep(3);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setResetBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (resetPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!resetToken) {
      setError("Your reset session has expired. Please start again.");
      setResetStep(1);
      return;
    }

    setResetBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to reset password.");
      }

      setResetStep(4);
      setResetPassword("");
      setResetConfirmPassword("");
      Toast.show({
        type: "success",
        text1: "Password reset successful",
        text2: "Sign in with your new password.",
      });
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setResetBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!GOOGLE_CONFIGURED) {
      Toast.show({
        type: "info",
        text1: "Google Sign-In unavailable",
        text2: "Configure Google OAuth IDs in the local .env file.",
      });
      return;
    }

    try {
      setGoogleLoading(true);
      setError("");
      await promptAsync();
    } catch (err) {
      setGoogleLoading(false);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: err.message || "Could not start Google Sign-In",
      });
    }
  };

  // ========== Indian mobile OTP authentication ==========
  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const clientHardwareUuid = await getClientHardwareUuid();
      const deviceCookie = getDeviceCookieHeader(clientHardwareUuid);
      const phoneDigits = formData.phone.replace(/\D/g, "");
      if (migrationMode) {
        const email = formData.email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error("Enter your existing account email.");
        }
        if (!formData.password || !/^\d{10}$/.test(phoneDigits)) {
          throw new Error("Enter your existing password and 10-digit Indian mobile number.");
        }
        if (otpRequired && (!/^\d{6}$/.test(migrationEmailOtp) || !/^\d{6}$/.test(migrationPhoneOtp))) {
          throw new Error("Enter both six-digit verification codes.");
        }
        const response = await fetch(
          `${API_BASE}/phone-auth/migrate${otpRequired ? "/verify" : ""}`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              Cookie: deviceCookie,
              ...API_PLATFORM_HEADER,
            },
            body: JSON.stringify(
              otpRequired
                ? {
                    email,
                    phone: phoneDigits,
                    emailOtp: migrationEmailOtp,
                    phoneOtp: migrationPhoneOtp,
                    clientHardwareUuid,
                  }
                : {
                    email,
                    password: formData.password,
                    phone: phoneDigits,
                    clientHardwareUuid,
                  },
            ),
          },
        );
        const migrationData = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(migrationData.message || "Account migration failed.");
        }
        if (migrationData.requiresOtp) {
          setOtpRequired(true);
          setMigrationEmailOtp("");
          setMigrationPhoneOtp("");
          setOtpCountdown(migrationData.retryAfterSeconds || 60);
          Toast.show({
            type: "info",
            text1: "Codes sent",
            text2: "Check your existing email and mobile for verification codes.",
          });
          return;
        }
        await handleAuthSuccess(migrationData);
        return;
      }

      if (!/^\d{10}$/.test(phoneDigits)) {
        throw new Error("Enter a valid 10-digit Indian mobile number.");
      }
      if (!isLogin && !formData.name.trim()) {
        throw new Error("Full name is required.");
      }
      if (otpRequired && !/^\d{6}$/.test(otp)) {
        throw new Error("Enter the six-digit OTP sent to your phone.");
      }
      const res = await fetch(
        `${API_BASE}/phone-auth/${otpRequired ? "verify-otp" : "request-otp"}`,
        {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: deviceCookie,
          ...API_PLATFORM_HEADER,
        },
        body: JSON.stringify({
          phone: phoneDigits,
          intent: isLogin ? "login" : "signup",
          name: formData.name.trim(),
          otp,
          clientHardwareUuid,
        ...(!isLogin ? await getSignupIntegrityProof() : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === "VPN_OR_PROXY_DETECTED") {
          throw new Error(
            "Login/Register not allowed over VPN or Proxy. Please disable it.",
          );
        }
        throw new Error(data.message || "Authentication failed");
      }

      if (data.requiresOtp) {
        setOtpRequired(true);
        setDevelopmentOtp("");
        setOtp("");
        setOtpCountdown(data.retryAfterSeconds || 60);
        setError("");
        Toast.show({
          type: "info",
          text1: "OTP Sent",
          text2: "Check your mobile for the 6-digit code",
          visibilityTime: 4000,
        });
        return;
      }

      await handleAuthSuccess(data);
    } catch (err) {
      const errorMsg = err.message || "Something went wrong";
      setError(errorMsg);
      Toast.show({ type: "error", text1: "Error", text2: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCountdown > 0 || resendingOtp) return;

    setResendingOtp(true);
    setError("");

    try {
      const clientHardwareUuid = await getClientHardwareUuid();
      const deviceCookie = getDeviceCookieHeader(clientHardwareUuid);
      if (authMethod === "email" && !migrationMode) {
        const integrityProof = isLogin ? {} : await getSignupIntegrityProof();
        const response = await fetch(
          `${API_BASE}/${isLogin ? "login" : "register"}`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              Cookie: deviceCookie,
              ...API_PLATFORM_HEADER,
            },
            body: JSON.stringify({
              ...(isLogin ? {} : { name: formData.name.trim() }),
              email: formData.email.trim().toLowerCase(),
              password: formData.password,
              clientHardwareUuid,
              ...integrityProof,
            }),
          },
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Could not resend OTP.");
        }
        if (data.requiresOtp) {
          setOtp("");
          setDevelopmentOtp(data.otpCode || "");
          setOtpCountdown(data.retryAfterSeconds || 60);
          setError(data.message || "A new verification code has been sent.");
          return;
        }
        await handleAuthSuccess(data);
        return;
      }

      const endpoint = migrationMode
        ? "/phone-auth/migrate"
        : "/phone-auth/request-otp";
      const body = migrationMode
        ? {
            email: formData.email.trim().toLowerCase(),
            password: formData.password,
            phone: formData.phone.replace(/\D/g, ""),
            clientHardwareUuid,
          }
        : {
            phone: formData.phone.replace(/\D/g, ""),
            intent: isLogin ? "login" : "signup",
            name: formData.name.trim(),
            clientHardwareUuid,
            ...(!isLogin ? await getSignupIntegrityProof() : {}),
          };
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: deviceCookie,
          ...API_PLATFORM_HEADER,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Could not resend OTP");

      if (data.requiresOtp) {
        setOtp("");
        setMigrationEmailOtp("");
        setMigrationPhoneOtp("");
        setOtpCountdown(data.retryAfterSeconds || 60);
        Toast.show({
          type: "info",
          text1: "New OTP Sent",
          text2: data.message || "Please check your phone",
        });
      }
    } catch (err) {
      setError(err.message || "Could not resend OTP");
      Toast.show({
        type: "error",
        text1: "Error",
        text2: err.message || "Could not resend OTP",
      });
    } finally {
      setResendingOtp(false);
    }
  };

  const toggleMode = () => {
    animateFormSwitch(() => {
      setIsLogin(!isLogin);
      setOtpRequired(false);
      setRegistrationPhoneRequired(false);
      setPendingRegistration(null);
      setOtp("");
      setOtpCountdown(0);
      setError("");
      setFormData({ name: "", email: "", password: "", phone: "" });
    });
  };

  // Tab indicator style
  const indicatorLeft = tabIndicator.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "50%"],
  });

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={styles.ambientBackground}>
        <Animated.View
          style={[
            styles.ambientGlowTop,
            {
              opacity: ambientMotion.interpolate({
                inputRange: [0, 1],
                outputRange: [0.7, 1],
              }),
              transform: [
                {
                  translateX: ambientMotion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 12],
                  }),
                },
                {
                  scale: ambientMotion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1.06],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.ambientGlowBottom,
            {
              opacity: ambientMotion.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.68],
              }),
              transform: [
                {
                  translateX: ambientMotion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, -12],
                  }),
                },
              ],
            },
          ]}
        />
        <Play size={54} color="rgba(255,130,120,0.24)" style={styles.backgroundPlay} />
        <Headphones size={62} color="rgba(255,125,115,0.19)" style={styles.backgroundHeadphones} />
        <Disc3 size={48} color="rgba(255,130,120,0.2)" style={styles.backgroundDisc} />
        <Music2 size={52} color="rgba(255,130,120,0.17)" style={styles.backgroundMusic} />
        <Radio size={48} color="rgba(255,130,120,0.18)" style={styles.backgroundRadio} />
        <Tv size={58} color="rgba(255,130,120,0.17)" style={styles.backgroundTv} />
        <Clapperboard size={56} color="rgba(255,130,120,0.16)" style={styles.backgroundClapper} />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.centerContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.header}>
                <Image
                  source={require("../../assets/VidBuxApp-logo.png")}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <Text style={styles.subtitle}>
                  {resetStep === 0
                    ? registrationPhoneRequired
                      ? "Add your mobile number to finish setup"
                      : isLogin
                        ? "Sign in to continue"
                        : "Create your account"
                    : resetStep === 1
                      ? "Reset your password"
                      : resetStep === 2
                        ? "Verify your email"
                        : resetStep === 3
                          ? "Create a new password"
                          : "Password reset successful"}
                </Text>
              </View>

              {/* Tabs with animated indicator */}
              {resetStep === 0 &&
                !otpRequired &&
                !registrationPhoneRequired && (
                <View style={styles.tabsContainer}>
                  <TouchableOpacity
                    style={styles.tab}
                    onPress={() => {
                      if (!isLogin) toggleMode();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.tabText, isLogin && styles.activeTabText]}
                    >
                      Login
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.tab}
                    onPress={() => {
                      if (isLogin) toggleMode();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.tabText, !isLogin && styles.activeTabText]}
                    >
                      Register
                    </Text>
                  </TouchableOpacity>

                  {/* Animated underline */}
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.tabIndicator, { left: indicatorLeft }]}
                  />
                </View>
              )}

              <View style={styles.formContainer}>
                {error ? (
                  <Animated.View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </Animated.View>
                ) : null}
                {resetStep === 0 &&
                  !otpRequired &&
                  !registrationPhoneRequired &&
                  !migrationMode && (
                    <>
                      <TouchableOpacity
                        onPress={handleGoogleSignIn}
                        disabled={googleLoading || loading}
                        activeOpacity={0.85}
                        style={[
                          styles.googleButton,
                          (googleLoading || loading) && styles.buttonDisabled,
                        ]}
                      >
                        {googleLoading ? (
                          <ActivityIndicator color="#111" size="small" />
                        ) : (
                          <View style={styles.googleButtonContent}>
                            <Text style={styles.googleMark}>G</Text>
                            <Text style={styles.googleButtonText}>
                              {isLogin
                                ? "Sign in with Google"
                                : "Sign up with Google"}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <View style={styles.dividerContainer}>
                        <View style={styles.divider} />
                        <Text style={styles.dividerText}>or</Text>
                        <View style={styles.divider} />
                      </View>
                    </>
                  )}
                <Animated.View
                  style={[
                    styles.form,
                    {
                      opacity: formOpacity,
                      transform: [{ translateX: formTranslate }],
                    },
                  ]}
                >
                  {resetStep === 0 ? (
                    <>
                      {/* Name field */}
                      {!isLogin &&
                        !migrationMode &&
                        !otpRequired &&
                        !registrationPhoneRequired && (
                        <View style={styles.inputWrapper}>
                          <User size={20} color="#6b7280" style={styles.icon} />
                          <TextInput
                            placeholder="Full Name"
                            value={formData.name}
                            onChangeText={(text) => handleChange("name", text)}
                            style={styles.input}
                            placeholderTextColor="#6b7280"
                            autoCapitalize="words"
                          />
                        </View>
                      )}

                      {authMethod === "email" &&
                        !migrationMode &&
                        !registrationPhoneRequired &&
                        (
                        <View style={styles.inputWrapper}>
                          <Mail size={20} color="#6b7280" style={styles.icon} />
                          <TextInput
                            placeholder="Email address"
                            value={formData.email}
                            onChangeText={(text) => handleChange("email", text)}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!otpRequired}
                            style={styles.input}
                            placeholderTextColor="#6b7280"
                          />
                        </View>
                      )}

                      {migrationMode && !otpRequired && (
                        <View style={styles.inputWrapper}>
                          <Mail size={20} color="#6b7280" style={styles.icon} />
                          <TextInput
                            placeholder="Existing account email"
                            value={formData.email}
                            onChangeText={(text) => handleChange("email", text)}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={styles.input}
                            placeholderTextColor="#6b7280"
                          />
                        </View>
                      )}

                      {migrationMode && !otpRequired && (
                        <View style={styles.inputWrapper}>
                          <Lock size={20} color="#6b7280" style={styles.icon} />
                          <TextInput
                            placeholder="Existing account password"
                            value={formData.password}
                            onChangeText={(text) =>
                              handleChange("password", text)
                            }
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={styles.input}
                            placeholderTextColor="#6b7280"
                          />
                          <TouchableOpacity
                            onPress={() => setShowPassword(!showPassword)}
                            style={styles.eyeIcon}
                            hitSlop={{
                              top: 10,
                              bottom: 10,
                              left: 10,
                              right: 10,
                            }}
                          >
                            {showPassword ? (
                              <EyeOff size={20} color="#9ca3af" />
                            ) : (
                              <Eye size={20} color="#9ca3af" />
                            )}
                          </TouchableOpacity>
                        </View>
                      )}

                      {authMethod === "email" &&
                        !migrationMode &&
                        !registrationPhoneRequired &&
                        !otpRequired && (
                        <View style={styles.inputWrapper}>
                          <Lock size={20} color="#6b7280" style={styles.icon} />
                          <TextInput
                            placeholder={
                              isLogin
                                ? "Password"
                                : "Create password (min. 8 characters)"
                            }
                            value={formData.password}
                            onChangeText={(text) => handleChange("password", text)}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={styles.input}
                            placeholderTextColor="#6b7280"
                          />
                          <TouchableOpacity
                            onPress={() => setShowPassword(!showPassword)}
                            style={styles.eyeIcon}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            {showPassword ? (
                              <EyeOff size={20} color="#9ca3af" />
                            ) : (
                              <Eye size={20} color="#9ca3af" />
                            )}
                          </TouchableOpacity>
                        </View>
                      )}

                      {registrationPhoneRequired && (
                        <View style={styles.inputWrapper}>
                          <Text style={[styles.icon, styles.phonePrefix]}>+91</Text>
                          <TextInput
                            placeholder="10-digit Indian mobile number"
                            value={formData.phone}
                            onChangeText={(text) =>
                              handleChange(
                                "phone",
                                text.replace(/\D/g, "").slice(0, 10),
                              )
                            }
                            keyboardType="phone-pad"
                            style={styles.input}
                            placeholderTextColor="#6b7280"
                          />
                        </View>
                      )}

                      {authMethod === "phone" &&
                        !registrationPhoneRequired &&
                        !otpRequired && (
                        <View style={styles.inputWrapper}>
                          <Text style={[styles.icon, { color: "#a1a1aa", fontWeight: "700" }]}>
                            +91
                          </Text>
                          <TextInput
                            placeholder={migrationMode ? "New mobile number" : "10-digit Indian mobile number"}
                            value={formData.phone}
                            onChangeText={(text) =>
                              handleChange("phone", text.replace(/\D/g, "").slice(0, 10))
                            }
                            keyboardType="phone-pad"
                            editable={!otpRequired}
                            style={styles.input}
                            placeholderTextColor="#6b7280"
                          />
                        </View>
                      )}

                      {authMethod === "email" &&
                        !migrationMode &&
                        !registrationPhoneRequired &&
                        !otpRequired &&
                        isLogin && (
                        <TouchableOpacity
                          onPress={startPasswordReset}
                          style={styles.forgotPasswordButton}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.forgotPasswordText}>
                            Forgot password?
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* ========== OTP Section ========== */}
                      {otpRequired && (
                        <Animated.View
                          style={[
                            styles.otpSection,
                            {
                              opacity: otpAnim,
                              transform: [
                                {
                                  translateY: otpAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [25, 0],
                                  }),
                                },
                                {
                                  scale: otpAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.95, 1],
                                  }),
                                },
                              ],
                            },
                          ]}
                        >
                          <Text style={styles.otpTitle}>
                            {migrationMode
                              ? "Verify existing account"
                              : authMethod === "email"
                                ? "Verify your email"
                                : "Enter OTP"}
                          </Text>
                          <Text style={styles.otpSubtitle}>
                            {migrationMode
                              ? "Enter the codes sent to your existing email and new mobile."
                              : `We sent a 6-digit code to your ${
                                  authMethod === "email" ? "email" : "mobile"
                                }.`}
                            {"\n"}
                            {authMethod === "phone" && (
                              <Text
                                style={{ color: "#ef4444", fontWeight: "600" }}
                              >
                                +91 {formData.phone}
                              </Text>
                            )}
                          </Text>
                          {migrationMode ? (
                            <>
                              <TextInput
                                style={styles.otpInput}
                                placeholder="Email OTP"
                                placeholderTextColor="#4b5563"
                                value={migrationEmailOtp}
                                onChangeText={(text) => setMigrationEmailOtp(text.replace(/\D/g, "").slice(0, 6))}
                                keyboardType="number-pad"
                                maxLength={6}
                                textAlign="center"
                              />
                              <TextInput
                                style={styles.otpInput}
                                placeholder="Mobile OTP"
                                placeholderTextColor="#4b5563"
                                value={migrationPhoneOtp}
                                onChangeText={(text) => setMigrationPhoneOtp(text.replace(/\D/g, "").slice(0, 6))}
                                keyboardType="number-pad"
                                maxLength={6}
                                textAlign="center"
                              />
                            </>
                          ) : (
                            <TextInput
                              style={styles.otpInput}
                              placeholder="••••••"
                              placeholderTextColor="#4b5563"
                              value={otp}
                              onChangeText={(text) =>
                                setOtp(text.replace(/\D/g, "").slice(0, 6))
                              }
                              keyboardType="number-pad"
                              maxLength={6}
                              textAlign="center"
                              autoFocus
                            />
                          )}

                          <View style={styles.otpRow}>
                            <Text style={styles.otpHint}>
                              {otpCountdown > 0
                                ? `Resend OTP in ${otpCountdown}s`
                                : "Didn't receive the code?"}
                            </Text>
                            <TouchableOpacity
                              onPress={handleResendOtp}
                              disabled={
                                resendingOtp || otpCountdown > 0 || loading
                              }
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.resendText,
                                  (resendingOtp ||
                                    otpCountdown > 0 ||
                                    loading) &&
                                    styles.resendDisabled,
                                ]}
                              >
                                {resendingOtp ? "Sending..." : "Resend OTP"}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </Animated.View>
                      )}

                      {/* Submit Button */}
                      <Animated.View
                        style={{ transform: [{ scale: buttonScale }] }}
                      >
                        <TouchableOpacity
                          onPress={
                            authMethod === "email" && !migrationMode
                              ? handleEmailSubmit
                              : handleSubmit
                          }
                          onPressIn={onPressIn}
                          onPressOut={onPressOut}
                          disabled={loading || googleLoading}
                          activeOpacity={0.9}
                          style={[
                            styles.button,
                            (loading || googleLoading) && styles.buttonDisabled,
                          ]}
                        >
                          {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <View style={styles.buttonContent}>
                              <Text style={styles.buttonText}>
                                {migrationMode
                                  ? otpRequired
                                    ? "Verify & Migrate Account"
                                    : "Send Migration Codes"
                                  : registrationPhoneRequired
                                    ? "Save number & continue"
                                  : otpRequired
                                  ? authMethod === "email"
                                    ? isLogin
                                      ? "Verify OTP & Sign In"
                                      : "Verify OTP & Create Account"
                                    : "Verify OTP & Continue"
                                  : isLogin
                                    ? "Sign In"
                                    : "Create Account"}
                              </Text>
                              <ArrowRight size={20} color="#fff" />
                            </View>
                          )}
                        </TouchableOpacity>
                      </Animated.View>

                      {/* Back button when OTP is shown */}
                      {otpRequired && (
                        <TouchableOpacity
                          onPress={() => {
                            setOtpRequired(false);
                            setDevelopmentOtp("");
                            setOtp("");
                            setOtpCountdown(0);
                            setError("");
                          }}
                          style={styles.backButton}
                          activeOpacity={0.7}
                        >
                          <ChevronLeft size={18} color="#9ca3af" />
                          <Text style={styles.backButtonText}>Back</Text>
                        </TouchableOpacity>
                      )}

                      {authMethod === "phone" &&
                        isLogin &&
                        !otpRequired &&
                        !migrationMode && (
                        <TouchableOpacity
                          onPress={() => {
                            setMigrationMode(true);
                            setError("");
                          }}
                          style={styles.forgotPasswordButton}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.forgotPasswordText}>
                            Existing email account? Migrate to mobile login
                          </Text>
                        </TouchableOpacity>
                      )}
                      {migrationMode && !otpRequired && (
                        <TouchableOpacity
                          onPress={() => {
                            setMigrationMode(false);
                            setFormData({
                              name: "",
                              email: "",
                              password: "",
                              phone: "",
                            });
                            setError("");
                          }}
                          style={styles.forgotPasswordButton}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.forgotPasswordText}>
                            Back to mobile login
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <>
                      {resetStep === 1 && (
                        <View style={[styles.resetStep, styles.resetSuccess]}>
                          <Text style={styles.resetStepSubtitle}>
                            Enter your account email and we'll send a
                            verification code.
                          </Text>
                          <View style={styles.inputWrapper}>
                            <Mail
                              size={20}
                              color="#6b7280"
                              style={styles.icon}
                            />
                            <TextInput
                              placeholder="Email address"
                              value={resetEmail}
                              onChangeText={setResetEmail}
                              keyboardType="email-address"
                              autoCapitalize="none"
                              autoCorrect={false}
                              editable={!resetBusy}
                              style={styles.input}
                              placeholderTextColor="#6b7280"
                            />
                          </View>
                          <TouchableOpacity
                            onPress={handleRequestResetOtp}
                            disabled={resetBusy}
                            activeOpacity={0.9}
                            style={[
                              styles.button,
                              resetBusy && styles.buttonDisabled,
                            ]}
                          >
                            {resetBusy ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <View style={styles.buttonContent}>
                                <Text style={styles.buttonText}>Send code</Text>
                                <ArrowRight size={20} color="#fff" />
                              </View>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}

                      {resetStep === 2 && (
                        <View style={styles.resetStep}>
                          <Text style={styles.resetStepSubtitle}>
                            Enter the 6-digit code sent to {resetEmail}.
                          </Text>
                          <TextInput
                            style={styles.otpInput}
                            placeholder="••••••"
                            placeholderTextColor="#4b5563"
                            value={resetOtp}
                            onChangeText={(text) =>
                              setResetOtp(text.replace(/\D/g, "").slice(0, 6))
                            }
                            keyboardType="number-pad"
                            maxLength={6}
                            textAlign="center"
                            editable={!resetBusy}
                          />
                          <View style={styles.otpRow}>
                            <Text style={styles.otpHint}>
                              {resetOtpCountdown > 0
                                ? `Resend code in ${resetOtpCountdown}s`
                                : "Didn't receive the code?"}
                            </Text>
                            <TouchableOpacity
                              onPress={handleResendResetOtp}
                              disabled={
                                resetResending ||
                                resetBusy ||
                                resetOtpCountdown > 0
                              }
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.resendText,
                                  (resetResending ||
                                    resetBusy ||
                                    resetOtpCountdown > 0) &&
                                    styles.resendDisabled,
                                ]}
                              >
                                {resetResending ? "Sending..." : "Resend code"}
                              </Text>
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity
                            onPress={handleVerifyResetOtp}
                            disabled={resetBusy}
                            activeOpacity={0.9}
                            style={[
                              styles.button,
                              resetBusy && styles.buttonDisabled,
                            ]}
                          >
                            {resetBusy ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <View style={styles.buttonContent}>
                                <Text style={styles.buttonText}>
                                  Verify code
                                </Text>
                                <ArrowRight size={20} color="#fff" />
                              </View>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}

                      {resetStep === 3 && (
                        <View style={styles.resetStep}>
                          <Text style={styles.resetStepSubtitle}>
                            Choose a password with at least 8 characters.
                          </Text>
                          <View style={styles.inputWrapper}>
                            <Lock
                              size={20}
                              color="#6b7280"
                              style={styles.icon}
                            />
                            <TextInput
                              placeholder="New password"
                              value={resetPassword}
                              onChangeText={setResetPassword}
                              secureTextEntry={!showResetPassword}
                              autoCapitalize="none"
                              style={styles.input}
                              placeholderTextColor="#6b7280"
                              editable={!resetBusy}
                            />
                            <TouchableOpacity
                              onPress={() =>
                                setShowResetPassword(!showResetPassword)
                              }
                              style={styles.eyeIcon}
                              hitSlop={{
                                top: 10,
                                bottom: 10,
                                left: 10,
                                right: 10,
                              }}
                            >
                              {showResetPassword ? (
                                <EyeOff size={20} color="#9ca3af" />
                              ) : (
                                <Eye size={20} color="#9ca3af" />
                              )}
                            </TouchableOpacity>
                          </View>
                          <View style={styles.inputWrapper}>
                            <Lock
                              size={20}
                              color="#6b7280"
                              style={styles.icon}
                            />
                            <TextInput
                              placeholder="Confirm new password"
                              value={resetConfirmPassword}
                              onChangeText={setResetConfirmPassword}
                              secureTextEntry={!showResetConfirmPassword}
                              autoCapitalize="none"
                              style={styles.input}
                              placeholderTextColor="#6b7280"
                              editable={!resetBusy}
                            />
                            <TouchableOpacity
                              onPress={() =>
                                setShowResetConfirmPassword(
                                  !showResetConfirmPassword,
                                )
                              }
                              style={styles.eyeIcon}
                              hitSlop={{
                                top: 10,
                                bottom: 10,
                                left: 10,
                                right: 10,
                              }}
                            >
                              {showResetConfirmPassword ? (
                                <EyeOff size={20} color="#9ca3af" />
                              ) : (
                                <Eye size={20} color="#9ca3af" />
                              )}
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity
                            onPress={handleResetPassword}
                            disabled={resetBusy}
                            activeOpacity={0.9}
                            style={[
                              styles.button,
                              resetBusy && styles.buttonDisabled,
                            ]}
                          >
                            {resetBusy ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <View style={styles.buttonContent}>
                                <Text style={styles.buttonText}>
                                  Reset password
                                </Text>
                                <ArrowRight size={20} color="#fff" />
                              </View>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}

                      {resetStep === 4 && (
                        <View style={styles.resetStep}>
                          <CheckCircle2 size={52} color="#22c55e" />
                          <Text style={styles.resetSuccessTitle}>
                            Password updated
                          </Text>
                          <Text style={styles.resetStepSubtitle}>
                            Sign in with your new password.
                          </Text>
                          <TouchableOpacity
                            onPress={backFromPasswordReset}
                            activeOpacity={0.9}
                            style={styles.button}
                          >
                            <View style={styles.buttonContent}>
                              <Text style={styles.buttonText}>
                                Back to login
                              </Text>
                              <ArrowRight size={20} color="#fff" />
                            </View>
                          </TouchableOpacity>
                        </View>
                      )}

                      {resetStep > 0 && resetStep < 4 && (
                        <TouchableOpacity
                          onPress={backFromPasswordReset}
                          style={styles.backButton}
                          activeOpacity={0.7}
                        >
                          <ChevronLeft size={18} color="#9ca3af" />
                          <Text style={styles.backButtonText}>
                            {resetStep === 1 ? "Back to login" : "Back"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </Animated.View>

                {/* Toggle Login/Register */}
                {resetStep === 0 &&
                  !otpRequired &&
                  !registrationPhoneRequired && (
                  <View style={styles.toggleContainer}>
                    <Text style={styles.toggleText}>
                      {isLogin
                        ? "Don't have an account? "
                        : "Already have an account? "}
                      {!migrationMode && (
                        <Text style={styles.toggleLink} onPress={toggleMode}>
                          {isLogin ? "Sign up" : "Sign in"}
                        </Text>
                      )}
                    </Text>
                  </View>
                )}
                {resetStep === 0 &&
                  !otpRequired &&
                  !registrationPhoneRequired &&
                  !migrationMode && (
                    <TouchableOpacity
                      onPress={() => {
                        setAuthMethod(authMethod === "email" ? "phone" : "email");
                        setOtpRequired(false);
                        setOtp("");
                        setOtpCountdown(0);
                        setError("");
                        setFormData({
                          name: "",
                          email: "",
                          password: "",
                          phone: "",
                        });
                      }}
                      activeOpacity={0.75}
                      style={styles.authMethodLink}
                    >
                      <Text style={styles.authMethodLinkText}>
                        {authMethod === "email"
                          ? "Use phone number instead"
                          : "Use email instead"}
                      </Text>
                    </TouchableOpacity>
                  )}
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080709",
  },
  ambientBackground: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  ambientGlowTop: {
    position: "absolute",
    width: 280,
    height: 280,
    top: -105,
    left: -100,
    borderRadius: 140,
    backgroundColor: "rgba(190, 28, 38, 0.2)",
    shadowColor: "#dc2626",
    shadowOpacity: 0.75,
    shadowRadius: 90,
  },
  ambientGlowBottom: {
    position: "absolute",
    width: 320,
    height: 320,
    right: -140,
    bottom: -150,
    borderRadius: 160,
    backgroundColor: "rgba(135, 20, 30, 0.16)",
    shadowColor: "#b91c1c",
    shadowOpacity: 0.7,
    shadowRadius: 100,
  },
  backgroundPlay: {
    position: "absolute",
    top: "13%",
    right: "12%",
    opacity: 0.7,
    transform: [{ rotate: "-12deg" }],
  },
  backgroundHeadphones: {
    position: "absolute",
    top: "28%",
    left: "7%",
    opacity: 0.65,
    transform: [{ rotate: "9deg" }],
  },
  backgroundDisc: {
    position: "absolute",
    top: "46%",
    right: "6%",
    opacity: 0.65,
    transform: [{ rotate: "18deg" }],
  },
  backgroundMusic: {
    position: "absolute",
    top: "68%",
    left: "12%",
    opacity: 0.65,
    transform: [{ rotate: "-8deg" }],
  },
  backgroundRadio: {
    position: "absolute",
    top: "78%",
    right: "17%",
    opacity: 0.6,
    transform: [{ rotate: "-10deg" }],
  },
  backgroundTv: {
    position: "absolute",
    top: "11%",
    left: "17%",
    opacity: 0.55,
    transform: [{ rotate: "8deg" }],
  },
  backgroundClapper: {
    position: "absolute",
    top: "53%",
    left: "4%",
    opacity: 0.6,
    transform: [{ rotate: "10deg" }],
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "rgba(10, 8, 12, 0.55)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 10,
  },
  header: {
    paddingTop: 24,
    paddingBottom: 12,
    alignItems: "center",
  },
  logoImage: {
    width: 80,
    height: 64,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#9ca3af",
    textAlign: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    position: "relative",
    marginHorizontal: 20,
    padding: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  tab: {
    flex: 1,
    zIndex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 8,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6b7280",
  },
  activeTabText: {
    color: "#fff",
  },
  tabIndicator: {
    position: "absolute",
    top: 2,
    bottom: 2,
    zIndex: 0,
    width: "50%",
    backgroundColor: "#c81e27",
    borderRadius: 8,
  },
  formContainer: {
    padding: 20,
    paddingTop: 16,
  },
  errorBox: {
    backgroundColor: "rgba(127, 29, 29, 0.35)",
    borderWidth: 1,
    borderColor: "#7f1d1d",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  errorText: {
    color: "#fca5a5",
    textAlign: "center",
    fontSize: 13.5,
    lineHeight: 19,
  },
  deviceLockedBox: {
    backgroundColor: "rgba(127, 29, 29, 0.25)",
    borderWidth: 1,
    borderColor: "#7f1d1d",
    padding: 14,
    borderRadius: 14,
    marginBottom: 18,
    gap: 8,
  },
  deviceLockedTitle: {
    color: "#fecaca",
    fontSize: 14,
    fontWeight: "700",
  },
  deviceLockedText: {
    color: "#fca5a5",
    fontSize: 12,
    lineHeight: 18,
  },
  deviceLockedButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#dc2626",
    borderRadius: 8,
  },
  deviceLockedButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  form: {
    gap: 12,
  },
  inputWrapper: {
    position: "relative",
  },
  icon: {
    position: "absolute",
    left: 16,
    top: 13,
    zIndex: 1,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 42,
    color: "#fff",
    fontSize: 14,
  },
  phonePrefix: {
    color: "#a1a1aa",
    fontWeight: "700",
  },
  eyeIcon: {
    position: "absolute",
    right: 16,
    top: 13,
  },
  // OTP Styles
  otpSection: {
    gap: 14,
    alignItems: "center",
    marginBottom: 4,
  },
  otpTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  otpSubtitle: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  developmentOtp: {
    color: "#fbbf24",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1,
  },
  otpInput: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1.5,
    borderColor: "#ef4444",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    color: "#fff",
    fontSize: 28,
    letterSpacing: 14,
    width: "100%",
    textAlign: "center",
    fontWeight: "700",
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginTop: 2,
  },
  otpHint: {
    color: "#9ca3af",
    fontSize: 13,
  },
  resendText: {
    color: "#ef4444",
    fontWeight: "600",
    fontSize: 13,
  },
  resendDisabled: {
    color: "#4b5563",
  },
  button: {
    backgroundColor: "#c81e27",
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: "center",
    marginTop: 6,
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 4,
  },
  backButtonText: {
    color: "#9ca3af",
    fontSize: 14.5,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#2e2e2e",
  },
  dividerText: {
    color: "#6b7280",
    paddingHorizontal: 14,
    fontSize: 13,
    fontWeight: "500",
  },
  googleButton: {
    backgroundColor: "#c81e27",
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dc2626",
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  googleButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleMark: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
  googleButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  toggleContainer: {
    marginTop: 5,
    alignItems: "center",
  },
  toggleText: {
    color: "#9ca3af",
    fontSize: 12,
  },
  toggleLink: {
    color: "#ef4444",
    fontWeight: "600",
  },
  authMethodLink: {
    alignSelf: "center",
    paddingVertical: 8,
  },
  authMethodLinkText: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "500",
  },
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginTop: -10,
  },
  forgotPasswordText: {
    color: "#ef4444",
    fontSize: 13.5,
    fontWeight: "600",
  },
  resetStep: {
    width: "100%",
    gap: 16,
  },
  resetStepSubtitle: {
    color: "#9ca3af",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  resetSuccess: {
    alignItems: "center",
  },
  resetSuccessTitle: {
    color: "#fff",
    fontSize: 21,
    fontWeight: "700",
    textAlign: "center",
  },
  claimModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  claimModal: {
    width: "100%",
    maxWidth: 400,
    padding: 22,
    gap: 14,
    backgroundColor: "#181818",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 18,
  },
  claimModalTitle: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "700",
  },
  claimModalDescription: {
    color: "#a1a1aa",
    fontSize: 13,
    lineHeight: 19,
  },
  claimModalEmail: {
    color: "#d4d4d8",
    fontSize: 12,
    fontWeight: "600",
  },
  claimPasswordInput: {
    minHeight: 48,
    paddingHorizontal: 14,
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 10,
    color: "#fff",
  },
  claimErrorText: {
    color: "#fca5a5",
    fontSize: 12,
  },
  claimModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  claimCancelButton: {
    minWidth: 86,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "#272727",
    borderRadius: 10,
  },
  claimCancelText: {
    color: "#d4d4d8",
    fontSize: 13,
    fontWeight: "600",
  },
  claimContinueButton: {
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "#dc2626",
    borderRadius: 10,
  },
  claimContinueText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
