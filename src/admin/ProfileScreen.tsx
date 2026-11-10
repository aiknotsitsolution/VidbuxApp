import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  FlatList,
  StatusBar,
} from "react-native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import { fetch as expoFetch } from "expo/fetch";
import { File } from "expo-file-system";
import { API_ORIGIN } from "../../config/api";
import { showToast } from "../utils/notifications";
// import LogoutWarningModal from "../components/LogoutWarningModal";
import LogoutWarningModal from "../components/LogoutWarningModal";
import AdminBottomTabs from "./AdminBottomTabs";
import {
  Eye,
  Clock,
  IndianRupee,
  Edit,
  Lock,
  EyeOff,
  ChevronRight,
  Play,
  ThumbsUp,
  MoreVertical,
  Settings,
  Bell,
  Search,
  X,
  Upload,
  Trash2,
  ArrowLeft,
  LogOut,
  User,
  HelpCircle,
  ShieldCheck,
  Phone,
} from "lucide-react-native";
import Navbar from "./Navbar";
import { getViewSocket } from "../utils/viewSocket";
const { width } = Dimensions.get("window");

const API_BASE = `${API_ORIGIN}/api`;
const BACKEND_URL = API_ORIGIN;
const COUNTRY_MCC: Record<string, string> = {
  IN: "404",
  US: "310",
  CA: "302",
  GB: "234",
  AU: "505",
  AE: "424",
  SA: "420",
  SG: "525",
  MY: "502",
  BD: "470",
  PK: "410",
  NP: "429",
  LK: "413",
};

const getMccForCountry = (country?: string) =>
  COUNTRY_MCC[country?.toUpperCase() || ""] || "";

const getLocalTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
};

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialTab = (route.params as { tab?: string } | undefined)?.tab;

  const [activeTab, setActiveTab] = useState(
    initialTab === "history" ? "history" : "my-videos",
  );
  const [sortBy, setSortBy] = useState("latest");
  const [selectedVideo, setSelectedVideo] = useState(null);

  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [myVideos, setMyVideos] = useState([]);
  const [historyVideos, setHistoryVideos] = useState([]);
  const [watchLaterVideos, setWatchLaterVideos] = useState([]);
  const [likedVideos, setLikedVideos] = useState([]);

  const [videosLoading, setVideosLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [watchLaterLoading, setWatchLaterLoading] = useState(false);
  const [likedLoading, setLikedLoading] = useState(false);

  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyError, setHistoryError] = useState(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    advertisingId: "",
    deviceFingerprint: "",
    country: "",
    timezone: "",
    simMcc: "",
  });
  const [avatarUri, setAvatarUri] = useState(null);
  const [avatarBase64, setAvatarBase64] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneVerifyLoading, setPhoneVerifyLoading] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const currentEmail = String(user?.email || "").trim().toLowerCase();
  const editEmail = String(editForm.email || "").trim().toLowerCase();
  const isEditEmailVerified = Boolean(
    user?.emailVerified && currentEmail && editEmail === currentEmail,
  );

  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false,
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [showMenu, setShowMenu] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);

  // ========== HELPERS ==========
  const getMediaUrl = (path) => {
    if (!path) return null;
    const cleaned = String(path).replace(/\\/g, "/").trim();
    if (/^(https?|file|content|data):/i.test(cleaned)) return cleaned;
    if (cleaned.startsWith("/")) return `${BACKEND_URL}${cleaned}`;
    return `${BACKEND_URL}/${cleaned}`;
  };

  const getAvatarSource = (avatar) =>
    getMediaUrl(avatar) ||
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400";

  const formatDuration = (duration) => {
    if (!duration || duration === "—") return null;
    if (typeof duration === "string" && duration.includes(":")) return duration;
    const sec = Math.floor(Number(duration) || 0);
    if (sec <= 0) return null;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const mapVideo = (v) => {
    if (!v) return null;

    const source = v.video || v;

    const id = source._id || source.id || v._id || v.id;
    if (!id) return null;

    const rawViews =
      source.views ?? source.viewCount ?? v.views ?? v.viewCount ?? 0;
    const views = Number(rawViews) || 0;

    return {
      id,
      _id: id,
      title: source.title || v.title || "Untitled",
      thumbnail: getMediaUrl(
        source.thumbnail || source.thumb || source.poster || v.thumbnail,
      ),
      channel:
        source.channelName ||
        v.channelName ||
        (typeof (source.channel || v.channel) === "object"
          ? (source.channel || v.channel)?.name
          : source.channel || v.channel) ||
        "Unknown",
      duration: formatDuration(source.duration || v.duration),
      views,
      likes:
        source.likesCount || source.likes || v.likesCount || v.likes || null,
      videoUrl: source.videoUrl || v.videoUrl,
      watchedAt: v.watchedAt || v.watchedDate || null,
      uploadDate: source.createdAt || v.createdAt,
      description: source.description || v.description || "",
    };
  };

  const getHistoryItems = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.videos)) return data.videos;
    if (Array.isArray(data?.history)) return data.history;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  // ─── Fetch Profile ───
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = await AsyncStorage.getItem("token");
        if (!token) throw new Error("No token found. Please login first.");

        const res = await fetch(`${API_BASE}/me`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          if (res.status === 401) {
            await AsyncStorage.multiRemove(["token", "user"]);
            navigation.replace("Login");
            throw new Error("Session expired. Please login again.");
          }
          throw new Error(`Server error: ${res.status}`);
        }

        const data = await res.json();
        if (!data.success || !data.user) {
          throw new Error("Invalid profile data received");
        }

        const profile = data.user;

        setUser({
          _id: profile._id,
          name: profile.name || "User",
          handle: `@${(profile.name || "user")
            .toLowerCase()
            .replace(/\s+/g, "")}`,
          email: profile.email || "",
          emailVerified: Boolean(profile.emailVerified),
          avatar: getAvatarSource(profile.avatar),
          createdAt: profile.createdAt
            ? new Date(profile.createdAt).toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
              })
            : "Unknown date",
          subscribers: profile.subscribers || 0,
          totalVideos: profile.totalVideos || profile.videos?.length || 0,
          totalViews: profile.totalViews || 0,
          totalEarnings: profile.totalEarnings || 0,
          avgRPM: profile.avgRPM || 0,
          earningsThisMonth: profile.earningsThisMonth || 0,
          pendingWithdrawal: profile.pendingWithdrawal || 0,
          likedCount: profile.likedVideos?.length || 0,
          watchLaterCount: profile.watchLaterVideos?.length || 0,
          channelsCount: profile.channels?.length || 0,
          phone: profile.phone || "",
          phoneVerified: Boolean(profile.phoneVerified),
          advertisingId: profile.advertisingId || "",
          deviceFingerprint: profile.deviceFingerprint || "",
          country: profile.country || "",
          timezone: profile.timezone || "",
          simMcc: profile.simMcc || "",
        });

        setEditForm({
          name: profile.name || "",
          email: profile.email || "",
          phone: profile.phone || "",
          advertisingId: profile.advertisingId || "",
          deviceFingerprint: profile.deviceFingerprint || "",
          country: profile.country || "",
          timezone: profile.timezone || getLocalTimezone(),
          simMcc: profile.simMcc || getMccForCountry(profile.country),
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigation]);

  // ─── Fetch History ───
  const fetchHistory = async (pageNum = 1) => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        setHistoryError("auth");
        setHistoryVideos([]);
        return;
      }

      const res = await fetch(
        `${API_BASE}/uservideo/history?page=${pageNum}&limit=20&_=${Date.now()}`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.status === 401 || res.status === 403) {
        setHistoryError("auth");
        setHistoryVideos([]);
        return;
      }

      if (!res.ok) {
        setHistoryError("server");
        setHistoryVideos([]);
        return;
      }

      const data = await res.json();
      const historyItems = getHistoryItems(data);
      const mapped = historyItems.map(mapVideo).filter(Boolean);

      if (pageNum === 1) {
        setHistoryVideos(mapped);
      } else {
        setHistoryVideos((prev) => [...prev, ...mapped]);
      }

      setHistoryTotal(data.total ?? data.count ?? mapped.length);
      setHistoryPage(pageNum);
    } catch (e) {
      console.warn("History fetch error:", e);
      setHistoryError("network");
      setHistoryVideos([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const removeHistoryItem = (videoId) => {
    Alert.alert(
      "Remove from history",
      "Remove this video from watch history?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("token");
              if (!token) throw new Error("Please login again");

              const response = await fetch(
                `${API_BASE}/uservideo/history/${videoId}`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
              const data = await response.json();
              if (!response.ok || !data.success) {
                throw new Error(
                  data.message || "Could not remove history item",
                );
              }

              setHistoryVideos((current) =>
                current.filter((video) => (video.id || video._id) !== videoId),
              );
              setHistoryTotal((total) => Math.max(0, total - 1));
            } catch (err) {
              showToast(
                "error",
                "Error",
                err.message || "Could not remove history item",
              );
            }
          },
        },
      ],
    );
  };

  useFocusEffect(
    useCallback(() => {
      fetchHistory(1);
    }, []),
  );

  useEffect(() => {
    let active = true;
    let socket;

    getViewSocket().then((connectedSocket) => {
      if (!active || !connectedSocket) return;
      socket = connectedSocket;
      socket.on("history-updated", () => fetchHistory(1));
    });

    return () => {
      active = false;
      socket?.off("history-updated");
    };
  }, []);

  useEffect(() => {
    const requestedTab = (route.params as { tab?: string } | undefined)?.tab;
    if (requestedTab === "history") setActiveTab("history");
  }, [route.params]);

  const fetchWatchLater = async () => {
    try {
      setWatchLaterLoading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API_BASE}/uservideo/watch-later`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setWatchLaterVideos([]);
        return;
      }

      const data = await res.json();
      const mapped = (data.videos || []).map(mapVideo).filter(Boolean);
      setWatchLaterVideos(mapped);
      setUser((prev) =>
        prev ? { ...prev, watchLaterCount: mapped.length } : prev,
      );
    } catch (e) {
      console.warn("Watch Later fetch error:", e);
      setWatchLaterVideos([]);
    } finally {
      setWatchLaterLoading(false);
    }
  };

  const removeWatchLaterItem = async (videoId) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        showToast("error", "Login required", "Please login again.");
        return;
      }

      const res = await fetch(`${API_BASE}/uservideo/watch-later/${videoId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Could not remove from Watch Later.");
      }

      setWatchLaterVideos((current) =>
        current.filter(
          (video) => String(video.id || video._id) !== String(videoId),
        ),
      );
      setUser((prev) =>
        prev
          ? {
              ...prev,
              watchLaterCount: Math.max(0, (prev.watchLaterCount || 0) - 1),
            }
          : prev,
      );
    } catch (err) {
      showToast(
        "error",
        "Watch Later",
        err.message || "Could not remove from Watch Later.",
      );
    }
  };

  const fetchLiked = async () => {
    try {
      setLikedLoading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API_BASE}/uservideo/liked`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setLikedVideos([]);
        return;
      }

      const data = await res.json();
      const mapped = (data.videos || []).map(mapVideo).filter(Boolean);
      setLikedVideos(mapped);
      setUser((prev) => (prev ? { ...prev, likedCount: mapped.length } : prev));
    } catch (e) {
      console.warn("Liked fetch error:", e);
      setLikedVideos([]);
    } finally {
      setLikedLoading(false);
    }
  };

  useEffect(() => {
    if (!user?._id) return;

    const fetchMyVideos = async () => {
      try {
        setVideosLoading(true);
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        const chRes = await fetch(`${API_BASE}/uservideo/channel`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!chRes.ok) {
          setMyVideos([]);
          return;
        }

        const chData = await chRes.json();
        const channels = chData.channels || [];

        if (channels.length === 0) {
          setMyVideos([]);
          return;
        }

        const allVideos = [];

        for (const ch of channels) {
          try {
            const vRes = await fetch(
              `${API_BASE}/uservideo/channel/${ch._id}/videos`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!vRes.ok) continue;

            const vData = await vRes.json();
            (vData.videos || []).forEach((v) => {
              const mapped = mapVideo(v);
              if (mapped) {
                allVideos.push({
                  ...mapped,
                  channel: v.channel?.name || ch.name,
                  earnings: v.earnings || 0,
                  dislikes: v.dislikesCount ?? v.dislikes ?? 0,
                  commentsCount: Array.isArray(v.comments)
                    ? v.comments.length
                    : v.commentsCount || 0,
                });
              }
            });
          } catch (err) {
            console.warn("Channel videos error:", err);
          }
        }

        allVideos.sort(
          (a, b) =>
            new Date(b.uploadDate || 0).getTime() -
            new Date(a.uploadDate || 0).getTime(),
        );

        setMyVideos(allVideos);

        const totalViews = allVideos.reduce(
          (sum, video) => sum + (Number(video.views) || 0),
          0,
        );
        setUser((prev) =>
          prev
            ? {
                ...prev,
                totalVideos: allVideos.length,
                totalViews: prev.totalViews || totalViews,
              }
            : prev,
        );
      } catch (e) {
        console.warn("My videos fetch error:", e);
      } finally {
        setVideosLoading(false);
      }
    };

    fetchMyVideos();
  }, [user?._id]);

  useEffect(() => {
    if (activeTab === "liked" && likedVideos.length === 0) {
      fetchLiked();
    }
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === "watch-later") {
        fetchWatchLater();
      }
    }, [activeTab]),
  );

  // ========== FIXED PICK AVATAR ==========
  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showToast("error", "Permission required", "Please allow photo access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      setAvatarUri(result.assets[0].uri);
      setEditError(null);
    }
  };

  const openEditProfile = () => {
    const timezone = user?.timezone || getLocalTimezone();
    setEditForm({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      advertisingId: user?.advertisingId || "",
      deviceFingerprint: user?.deviceFingerprint || "",
      country: user?.country || "",
      timezone: user?.timezone || getLocalTimezone(),
      simMcc: user?.simMcc || getMccForCountry(user?.country),
    });
    setAvatarUri(null);
    setPhoneOtp("");
    setPhoneOtpSent(false);
    setEmailOtp("");
    setEmailOtpSent(false);
    setEditError(null);
    setIsEditOpen(true);
    void hydrateDeviceInformation(timezone);
  };

  const hydrateDeviceInformation = async (timezone: string) => {
    try {
      let advertisingId =
        user?.advertisingId || (await AsyncStorage.getItem("advertisingId"));
      if (!advertisingId) {
        advertisingId = Crypto.randomUUID();
        await AsyncStorage.setItem("advertisingId", advertisingId);
      }

      const fingerprintSource = [
        Device.brand,
        Device.modelName,
        Device.osName,
        Device.osVersion,
        timezone,
        `${width}x${Dimensions.get("screen").height}`,
      ]
        .filter(Boolean)
        .join("|");
      const deviceFingerprint =
        user?.deviceFingerprint ||
        (await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          fingerprintSource,
        ));

      let country =
        user?.country || (await AsyncStorage.getItem("profileCountry")) || "";
      if (!country) {
        try {
          const response = await fetch("https://ipwho.is/");
          if (response.ok) {
            const location = await response.json();
            country = String(location.country_code || "").toUpperCase();
            if (country) await AsyncStorage.setItem("profileCountry", country);
          }
        } catch {
          // Device information stays usable when the location lookup is offline.
        }
      }

      setEditForm((previous) => ({
        ...previous,
        advertisingId: previous.advertisingId || advertisingId,
        deviceFingerprint: previous.deviceFingerprint || deviceFingerprint,
        country: previous.country || country,
        timezone: previous.timezone || timezone,
        simMcc: previous.simMcc || user?.simMcc || getMccForCountry(country),
      }));
    } catch (err) {
      console.warn("Could not load device information:", err);
    }
  };

  const fetchWithEmailAuth = async (
    path: string,
    token: string,
    options: Omit<RequestInit, "headers"> & {
      headers?: Record<string, string>;
    },
  ) => {
    const request = (accessToken: string) =>
      fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: "include",
        headers: {
          ...options.headers,
          Authorization: `Bearer ${accessToken}`,
        },
      });

    const response = await request(token);
    if (response.status !== 401) return response;

    const errorData = await response.clone().json().catch(() => ({}));
    if (errorData.message !== "Unauthorized - Invalid or expired token") {
      return response;
    }

    const refreshResponse = await fetch(`${API_BASE}/refresh`, {
      method: "POST",
      credentials: "include",
    });
    const refreshData = await refreshResponse.json().catch(() => ({}));
    if (!refreshResponse.ok || !refreshData.success || !refreshData.token) {
      return response;
    }

    const refreshedToken = String(refreshData.token);
    await AsyncStorage.setItem("token", refreshedToken);
    return request(refreshedToken);
  };

  const requestEmailOtp = async () => {
    const email = editForm.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEditError("Enter a valid email address.");
      return;
    }
    try {
      setPhoneVerifyLoading(true);
      setEditError(null);
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("Please login again.");
      const response = await fetchWithEmailAuth(
        "/phone-auth/email/request-otp",
        token,
        {
          method: "POST",
          headers: {
          "Content-Type": "application/json",
          Authorization: `******`,
        },
          body: JSON.stringify({ email }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not send email verification code.");
      }
      setEmailOtpSent(true);
      setEmailOtp("");
      showToast("info", "Email code sent", "Check your inbox for the verification code.");
    } catch (err: any) {
      setEditError(err.message || "Could not send email verification code.");
    } finally {
      setPhoneVerifyLoading(false);
    }
  };

  const verifyEmailOtp = async () => {
    if (!/^\d{6}$/.test(emailOtp)) {
      setEditError("Enter the 6-digit email verification code.");
      return;
    }
    try {
      setPhoneVerifyLoading(true);
      setEditError(null);
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("Please login again.");
      const response = await fetchWithEmailAuth(
        "/phone-auth/email/verify-otp",
        token,
        {
          method: "POST",
          headers: {
          "Content-Type": "application/json",
          Authorization: `******`,
        },
          body: JSON.stringify({
            email: editForm.email.trim().toLowerCase(),
            otp: emailOtp,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Invalid email verification code.");
      }
      setUser((previous) => ({
        ...previous,
        email: data.user?.email || editForm.email.trim().toLowerCase(),
        emailVerified: Boolean(data.user?.emailVerified ?? true),
      }));
      setEditForm((previous) => ({
        ...previous,
        email: data.user?.email || editForm.email.trim().toLowerCase(),
      }));
      setEmailOtp("");
      setEmailOtpSent(false);
      showToast("success", "Verified", "Email address verified successfully.");
    } catch (err: any) {
      setEditError(err.message || "Could not verify email address.");
    } finally {
      setPhoneVerifyLoading(false);
    }
  };

  const requestPhoneOtp = async () => {
    const phone = editForm.phone.trim().replace(/[\s()-]/g, "");
    if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
      setEditError("Enter a valid phone number with country code.");
      return;
    }

    try {
      setPhoneVerifyLoading(true);
      setEditError(null);
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("Please login again.");

      const response = await fetch(`${API_BASE}/phone/request-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not send verification code.");
      }

      setPhoneOtpSent(true);
      setPhoneOtp("");
      showToast(
        "info",
        "Verification code sent",
        "Check your mobile for the 6-digit code.",
        10000,
      );
    } catch (err: any) {
      setEditError(err.message || "Could not send verification code.");
    } finally {
      setPhoneVerifyLoading(false);
    }
  };

  const verifyPhoneOtp = async () => {
    const phone = editForm.phone.trim().replace(/[\s()-]/g, "");
    if (!/^\d{6}$/.test(phoneOtp)) {
      setEditError("Enter the 6-digit verification code.");
      return;
    }

    try {
      setPhoneVerifyLoading(true);
      setEditError(null);
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("Please login again.");

      const response = await fetch(`${API_BASE}/phone/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone, otp: phoneOtp }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Invalid verification code.");
      }

      setUser((previous) => ({
        ...previous,
        phone: data.user?.phone || phone,
        phoneVerified: true,
      }));
      setEditForm((previous) => ({
        ...previous,
        phone: data.user?.phone || phone,
      }));
      setPhoneOtp("");
      setPhoneOtpSent(false);
      showToast("success", "Verified", "Phone number verified successfully.");
    } catch (err: any) {
      setEditError(err.message || "Could not verify phone number.");
    } finally {
      setPhoneVerifyLoading(false);
    }
  };

  // ========== EDIT PROFILE ==========
  const handleEditSubmit = async () => {
    setEditLoading(true);
    setEditError(null);

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token || !user?._id) throw new Error("Please login again");

      const formData = new FormData();
      const trimmedName = editForm.name?.trim();
      const normalizedPhone = editForm.phone.trim().replace(/[\s()-]/g, "");
      const previousPhone = String(user.phone || "").replace(/[\s()-]/g, "");
      const phoneChanged = Boolean(
        normalizedPhone && normalizedPhone !== previousPhone,
      );
      let hasChanges = false;

      if (!trimmedName) {
        throw new Error("Name cannot be empty");
      }

      if (!user.phoneVerified) {
        throw new Error("Verify your mobile number before saving your profile.");
      }
      if (!isEditEmailVerified) {
        throw new Error("Verify your email address before saving your profile.");
      }
      if (phoneChanged) {
        throw new Error("Verify the new mobile number before saving your profile.");
      }

      if (trimmedName && trimmedName !== user.name) {
        formData.append("name", trimmedName);
        hasChanges = true;
      }

      if (phoneChanged) {
        if (!/^\+?[1-9]\d{7,14}$/.test(normalizedPhone)) {
          throw new Error("Enter a valid phone number with country code.");
        }
        formData.append("phone", normalizedPhone);
        hasChanges = true;
      }

      const profileFields = [
        "advertisingId",
        "deviceFingerprint",
        "country",
        "timezone",
        "simMcc",
      ] as const;
      for (const field of profileFields) {
        const value = editForm[field]?.trim();
        if (value && value !== String(user[field] || "")) {
          formData.append(field, value);
          hasChanges = true;
        }
      }

      if (avatarUri) {
        const filename = `avatar_${Date.now()}.jpg`;
        const imageFile = new File(avatarUri);
        console.log("[Profile] selected native file", {
          uri: avatarUri,
          exists: imageFile.exists,
          size: imageFile.size,
          type: imageFile.type,
        });
        formData.append("avatar", imageFile, filename);

        hasChanges = true;
      }

      if (!hasChanges) {
        throw new Error("No changes detected");
      }

      const res = await expoFetch(`${API_BASE}/user/${user._id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      console.log("[Profile] avatar update response", {
        status: res.status,
        success: data.success,
        avatarUrl: data.avatarUrl,
        userAvatar: data.user?.avatar,
      });

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update profile");
      }

      const savedAvatar = data.user?.avatar || data.avatarUrl;

      setUser((prev) => ({
        ...prev,
        name: data.user?.name || prev.name,
        email: data.user?.email || prev.email,
        emailVerified: data.user?.emailVerified ?? prev.emailVerified,
        avatar: getMediaUrl(savedAvatar) || avatarUri || prev.avatar,
        phone: data.user?.phone ?? prev.phone,
        phoneVerified:
          data.user?.phoneVerified ??
          (phoneChanged ? false : prev.phoneVerified),
        advertisingId: data.user?.advertisingId ?? prev.advertisingId,
        deviceFingerprint:
          data.user?.deviceFingerprint ?? prev.deviceFingerprint,
        country: data.user?.country ?? prev.country,
        timezone: data.user?.timezone ?? prev.timezone,
        simMcc: data.user?.simMcc ?? prev.simMcc,
        handle: data.user?.name
          ? `@${data.user.name.toLowerCase().replace(/\s+/g, "")}`
          : prev.handle,
      }));

      setEditForm({
        name: data.user?.name || editForm.name,
        email: data.user?.email || editForm.email,
        phone: data.user?.phone ?? editForm.phone,
        advertisingId: data.user?.advertisingId ?? editForm.advertisingId,
        deviceFingerprint:
          data.user?.deviceFingerprint ?? editForm.deviceFingerprint,
        country: data.user?.country ?? editForm.country,
        timezone: data.user?.timezone ?? editForm.timezone,
        simMcc: data.user?.simMcc ?? editForm.simMcc,
      });

      setAvatarUri(null);
      setAvatarBase64(null);
      if (phoneChanged) {
        setPhoneOtp("");
        setPhoneOtpSent(false);
        showToast(
          "success",
          "Profile updated",
          "Send a verification code to verify your new phone number.",
        );
      } else {
        setIsEditOpen(false);
        showToast("success", "Success", "Profile updated successfully!");
      }
    } catch (err: any) {
      console.log("Upload Error →", err);
      setEditError(err.message || "Something went wrong");
    } finally {
      setEditLoading(false);
    }
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditError(null);
    setAvatarUri(null);
    setAvatarBase64(null);
    setPhoneOtp("");
    setPhoneOtpSent(false);
    setEmailOtp("");
    setEmailOtpSent(false);
  };

  const handlePasswordSubmit = async () => {
    try {
      setPasswordLoading(true);
      setPasswordError(null);
      setPasswordSuccess(false);

      const { oldPassword, newPassword, confirmPassword } = passwordForm;

      if (!oldPassword || !newPassword || !confirmPassword) {
        throw new Error("All fields are required");
      }
      if (newPassword.length < 6) {
        throw new Error("New password must be at least 6 characters");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("New passwords do not match");
      }

      const token = await AsyncStorage.getItem("token");
      if (!token || !user?._id) throw new Error("Authentication required");

      const res = await fetch(`${API_BASE}/user/password/${user._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to change password");
      }

      setPasswordSuccess(true);
      setPasswordForm({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setTimeout(() => {
        setIsPasswordOpen(false);
        setPasswordSuccess(false);
      }, 1500);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const closePasswordModal = () => {
    setIsPasswordOpen(false);
    setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    setPasswordError(null);
    setPasswordSuccess(false);
    setShowPasswords({ old: false, new: false, confirm: false });
  };

  const handleLogout = () => setShowLogoutWarning(true);

  const confirmLogout = async () => {
    setShowLogoutWarning(false);
    try {
      await AsyncStorage.multiRemove(["token", "user"]);
    } finally {
      navigation.replace("Login");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ff0000" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          Error: {error || "Profile not loaded"}
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => navigation.replace("Login")}
        >
          <Text style={styles.retryText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const openVideo = (video) => {
    navigation.navigate("VideoDetail", {
      id: video.id || video._id,
      item: video,
    });
  };

  const renderVideoList = (videos, isLoading, emptyText, onRemove = null) => {
    if (isLoading) {
      return (
        <ActivityIndicator color="#ff0000" style={{ marginVertical: 40 }} />
      );
    }
    if (!videos || videos.length === 0) {
      return <Text style={styles.emptyHint}>{emptyText}</Text>;
    }

    return videos.map((video) => (
      <View key={video.id || video._id} style={styles.videoRow}>
        <TouchableOpacity
          style={styles.videoRowContent}
          onPress={() => openVideo(video)}
          onLongPress={() => setSelectedVideo(video)}
          activeOpacity={0.85}
        >
          <Image
            source={{
              uri:
                video.thumbnail ||
                "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400",
            }}
            style={styles.videoThumb}
          />
          <View style={styles.videoInfo}>
            <Text style={styles.videoTitle} numberOfLines={2}>
              {video.title}
            </Text>
            <Text style={styles.videoMeta}>
              {Number(video.views || 0).toLocaleString()} views
              {"  •  "}👍 {video.likes || 0}
            </Text>
            {video.channel ? (
              <Text style={styles.channelHint} numberOfLines={1}>
                {video.channel}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
        {onRemove ? (
          <TouchableOpacity
            style={styles.watchLaterRemoveBtn}
            onPress={() => onRemove(video.id || video._id)}
            accessibilityLabel="Remove from Watch Later"
          >
            <Trash2 size={18} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </View>
    ));
  };

  const sortedMyVideos = [...myVideos].sort((a, b) => {
    if (sortBy === "latest")
      return (
        new Date(b.uploadDate || 0).getTime() -
        new Date(a.uploadDate || 0).getTime()
      );
    if (sortBy === "views") return (b.views || 0) - (a.views || 0);
    if (sortBy === "earnings") return (b.earnings || 0) - (a.earnings || 0);
    return 0;
  });

  const ListHeader = ({ title, count }) => (
    <View style={styles.listHeader}>
      <TouchableOpacity
        onPress={() => setActiveTab("my-videos")}
        style={styles.backBtn}
      >
        <ArrowLeft size={22} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.listHeaderTitle}>
        {title} {count !== undefined ? `(${count})` : ""}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />
      <Navbar onMenuPress={() => {}} points={0} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {activeTab === "my-videos" && (
          <>
            <View style={styles.profileHeader}>
              <View style={styles.profileRow}>
                <Image
                  source={{ uri: getAvatarSource(user.avatar) }}
                  style={styles.avatar}
                  onLoad={() =>
                    console.log("[Profile] avatar loaded", user.avatar)
                  }
                  onError={(event) =>
                    console.log("[Profile] avatar load failed", {
                      uri: user.avatar,
                      error: event.nativeEvent.error,
                    })
                  }
                />
                <View style={styles.profileInfo}>
                  <Text style={styles.name} numberOfLines={1}>
                    {user.name}
                  </Text>
                  <Text style={styles.handle} numberOfLines={1}>
                    {user.handle}
                  </Text>
                </View>
              </View>

              {/* ===== UPDATED PILLS ROW WITH PENCIL ===== */}
              <View style={styles.pillsRow}>
                <TouchableOpacity
                  style={styles.pillPrimary}
                  onPress={() => navigation.navigate("ChannelScreen")}
                >
                  <Text style={styles.pillPrimaryText}>View channel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.pillSecondary}
                  onPress={() => navigation.navigate("Withdraw")}
                >
                  <Text style={styles.pillSecondaryText}>Withdraw</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.pencilBtn}
                  onPress={() => setShowEditMenu(true)}
                  activeOpacity={0.7}
                >
                  <Edit size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* History */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => setActiveTab("history")}
              >
                <Text style={styles.sectionTitle}>History</Text>
                <ChevronRight size={20} color="#aaa" />
              </TouchableOpacity>

              {historyLoading && historyVideos.length === 0 ? (
                <ActivityIndicator
                  color="#ff0000"
                  style={{ marginVertical: 20 }}
                />
              ) : historyError === "auth" ? (
                <Text style={styles.emptyHint}>
                  Sign in to see watch history
                </Text>
              ) : historyVideos.length === 0 ? (
                <Text style={styles.emptyHint}>No history yet</Text>
              ) : (
                <FlatList
                  data={historyVideos}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => String(item.id || item._id)}
                  contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.historyCard}
                      onPress={() => openVideo(item)}
                      activeOpacity={0.85}
                    >
                      <View>
                        <Image
                          source={{
                            uri:
                              item.thumbnail ||
                              "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400",
                          }}
                          style={styles.historyThumb}
                        />
                        <TouchableOpacity
                          style={styles.historyRemoveBtn}
                          onPress={(event) => {
                            event.stopPropagation?.();
                            removeHistoryItem(item.id || item._id);
                          }}
                        >
                          <Trash2 size={14} color="#fff" />
                        </TouchableOpacity>
                        {item.duration ? (
                          <View style={styles.durationBadge}>
                            <Text style={styles.durationText}>
                              {item.duration}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.historyTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.historyChannel} numberOfLines={1}>
                        {item.channel}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>

            {/* Library */}
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { marginLeft: 16, marginBottom: 12 },
                ]}
              >
                Library
              </Text>

              <TouchableOpacity
                style={styles.libraryRow}
                activeOpacity={0.7}
                onPress={() => {
                  setActiveTab("watch-later");
                  if (watchLaterVideos.length === 0) fetchWatchLater();
                }}
              >
                <View style={styles.libraryIconBox}>
                  <Clock size={28} color="#0f0f0f" />
                </View>
                <View style={styles.libraryInfo}>
                  <Text style={styles.libraryTitle}>Watch Later</Text>
                  <Text style={styles.librarySub}>
                    {user.watchLaterCount > 0
                      ? `${user.watchLaterCount} videos • Private`
                      : "Private"}
                  </Text>
                </View>
                <MoreVertical size={20} color="#aaa" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.libraryRow}
                activeOpacity={0.7}
                onPress={() => {
                  setActiveTab("liked");
                  if (likedVideos.length === 0) fetchLiked();
                }}
              >
                <View
                  style={[
                    styles.libraryIconBox,
                    { backgroundColor: "#272727" },
                  ]}
                >
                  <ThumbsUp size={26} color="#fff" />
                </View>
                <View style={styles.libraryInfo}>
                  <Text style={styles.libraryTitle}>Liked videos</Text>
                  <Text style={styles.librarySub}>
                    {user.likedCount > 0
                      ? `${user.likedCount} videos • Private`
                      : "Private"}
                  </Text>
                </View>
                <MoreVertical size={20} color="#aaa" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.libraryRow}
                activeOpacity={0.7}
                onPress={() => setActiveTab("my-videos")}
              >
                <View
                  style={[
                    styles.libraryIconBox,
                    { backgroundColor: "#272727" },
                  ]}
                >
                  {myVideos[0]?.thumbnail ? (
                    <Image
                      source={{ uri: myVideos[0].thumbnail }}
                      style={styles.libraryThumb}
                    />
                  ) : (
                    <Play size={28} color="#fff" />
                  )}
                </View>
                <View style={styles.libraryInfo}>
                  <Text style={styles.libraryTitle}>Your videos</Text>
                  <Text style={styles.librarySub}>
                    {myVideos.length} video
                    {myVideos.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <MoreVertical size={20} color="#aaa" />
              </TouchableOpacity>
            </View>
          </>
        )}

        {activeTab === "watch-later" && (
          <View style={styles.section}>
            <ListHeader
              title="Watch Later"
              count={watchLaterVideos.length || user.watchLaterCount}
            />
            {renderVideoList(
              watchLaterVideos,
              watchLaterLoading,
              "No videos in Watch Later",
              removeWatchLaterItem,
            )}
          </View>
        )}

        {activeTab === "liked" && (
          <View style={styles.section}>
            <ListHeader
              title="Liked videos"
              count={likedVideos.length || user.likedCount}
            />
            {renderVideoList(
              likedVideos,
              likedLoading,
              "No liked videos yet",
              null,
            )}
          </View>
        )}

        {/* Full History Tab */}
        {activeTab === "history" && (
          <View style={styles.section}>
            <ListHeader
              title="History"
              count={historyTotal || historyVideos.length}
            />

            {historyLoading && historyVideos.length === 0 ? (
              <ActivityIndicator
                color="#ff0000"
                style={{ marginVertical: 40 }}
              />
            ) : historyError === "auth" ? (
              <Text style={styles.emptyHint}>
                Sign in to see your watch history
              </Text>
            ) : historyVideos.length === 0 ? (
              <Text style={styles.emptyHint}>No watch history yet</Text>
            ) : (
              <>
                {historyVideos.map((video) => (
                  <TouchableOpacity
                    key={video.id || video._id}
                    style={styles.videoRow}
                    onPress={() => openVideo(video)}
                    onLongPress={() => setSelectedVideo(video)}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={{
                        uri:
                          video.thumbnail ||
                          "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400",
                      }}
                      style={styles.videoThumb}
                    />
                    <View style={styles.videoInfo}>
                      <Text style={styles.videoTitle} numberOfLines={2}>
                        {video.title}
                      </Text>
                      <Text style={styles.videoMeta}>
                        {Number(video.views || 0).toLocaleString()} views
                        {video.watchedAt
                          ? `  •  Watched ${new Date(
                              video.watchedAt,
                            ).toLocaleDateString()}`
                          : ""}
                      </Text>
                      {video.channel ? (
                        <Text style={styles.channelHint} numberOfLines={1}>
                          {video.channel}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.historyRowRemoveBtn}
                      onPress={(event) => {
                        event.stopPropagation?.();
                        removeHistoryItem(video.id || video._id);
                      }}
                    >
                      <Trash2 size={18} color="#fff" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}

                {historyVideos.length < historyTotal && (
                  <TouchableOpacity
                    style={{
                      marginVertical: 16,
                      alignSelf: "center",
                      backgroundColor: "#272727",
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      borderRadius: 20,
                    }}
                    onPress={() => fetchHistory(historyPage + 1)}
                    disabled={historyLoading}
                  >
                    {historyLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ color: "#fff", fontWeight: "600" }}>
                        Load more
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {activeTab === "my-videos" && (
          <View style={styles.section}>
            <View style={styles.videosHeader}>
              <Text style={styles.sectionTitle}>
                Your videos ({myVideos.length})
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setSortBy((s) =>
                    s === "latest"
                      ? "views"
                      : s === "views"
                        ? "earnings"
                        : "latest",
                  )
                }
              >
                <Text style={styles.sortText}>
                  {sortBy === "latest"
                    ? "Latest"
                    : sortBy === "views"
                      ? "Most viewed"
                      : "Highest earnings"}
                </Text>
              </TouchableOpacity>
            </View>

            {renderVideoList(
              sortedMyVideos,
              videosLoading,
              "No videos yet. Upload your first video!",
              null,
            )}
          </View>
        )}

        {activeTab === "my-videos" && (
          <View style={[styles.section, { paddingHorizontal: 16 }]}>
            <Text style={styles.sectionTitle}>Earnings</Text>
            <View style={styles.earningsRow}>
              <View style={styles.earnCard}>
                <Text style={styles.earnLabel}>This month</Text>
                <Text style={styles.earnValue}>
                  ₹{(user.earningsThisMonth || 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.earnCard}>
                <Text style={styles.earnLabel}>Total</Text>
                <Text style={styles.earnValue}>
                  ₹{(user.totalEarnings || 0).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ===== PENCIL EDIT MENU (Edit Profile + Change Password) ===== */}
      <Modal
        visible={showEditMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditMenu(false)}
      >
        <TouchableOpacity
          style={styles.editMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowEditMenu(false)}
        >
          <View style={styles.editMenuSheet}>
            <View style={styles.editMenuHandle} />
            <Text style={styles.editMenuTitle}>Profile settings</Text>

            <TouchableOpacity
              style={styles.editMenuItem}
              onPress={() => {
                setShowEditMenu(false);
                openEditProfile();
              }}
              activeOpacity={0.7}
            >
              <User size={20} color="#fff" />
              <Text style={styles.editMenuText}>Edit profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editMenuItem}
              onPress={() => {
                setShowEditMenu(false);
                setIsPasswordOpen(true);
              }}
              activeOpacity={0.7}
            >
              <Lock size={20} color="#fff" />
              <Text style={styles.editMenuText}>Change password</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.editMenuItem, { marginTop: 4 }]}
              onPress={() => setShowEditMenu(false)}
              activeOpacity={0.7}
            >
              <X size={20} color="#aaa" />
              <Text style={[styles.editMenuText, { color: "#aaa" }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Settings Menu */}
      <Modal
        visible={showMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />

            <View style={styles.menuUserRow}>
              <Image
                source={{ uri: getAvatarSource(user.avatar) }}
                style={styles.menuAvatar}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.menuUserName}>{user.name}</Text>
                <Text style={styles.menuUserHandle}>{user.handle}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowMenu(false)}>
                <X size={22} color="#aaa" />
              </TouchableOpacity>
            </View>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                navigation.navigate("Leaderboard");
              }}
            >
              <Lock size={22} color="#fff" />
              <Text style={styles.menuText}>Leaderboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                navigation.navigate("Withdraw");
              }}
            >
              <IndianRupee size={22} color="#fff" />
              <Text style={styles.menuText}>Withdraw</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                navigation.navigate("ChannelPage");
              }}
            >
              <Play size={22} color="#fff" />
              <Text style={styles.menuText}>Your channel</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem}>
              <HelpCircle size={22} color="#fff" />
              <Text style={styles.menuText}>Help & feedback</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                handleLogout();
              }}
            >
              <LogOut size={22} color="#ff4444" />
              <Text style={[styles.menuText, { color: "#ff4444" }]}>
                Sign out
              </Text>
            </TouchableOpacity>

            <View style={{ height: 30 }} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={isEditOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, styles.editModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={closeEdit}>
                <X size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.editModalScroll}
              contentContainerStyle={styles.editModalScrollContent}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {editError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorBoxText}>{editError}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Avatar</Text>
              <View style={styles.avatarEditRow}>
                <Image
                  key={avatarUri || "default"}
                  source={{
                    uri: avatarUri ? avatarUri : getAvatarSource(user.avatar),
                  }}
                  style={styles.editAvatar}
                />
                <TouchableOpacity
                  style={styles.pickAvatarBtn}
                  onPress={pickAvatar}
                >
                  <Upload size={16} color="#fff" />
                  <Text style={styles.pickAvatarText}>
                    {avatarUri ? "Change" : "Choose image"}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={editForm.name}
                onChangeText={(t) => setEditForm({ ...editForm, name: t })}
                placeholder="Your name"
                placeholderTextColor="#71717a"
              />

              <Text style={styles.label}>Email</Text>
              <View style={styles.phoneInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={editForm.email}
                  onChangeText={(email) => {
                    setEditForm((previous) => ({ ...previous, email }));
                    setEmailOtp("");
                    setEmailOtpSent(false);
                    setEditError(null);
                  }}
                  placeholder="your@email.com"
                  placeholderTextColor="#71717a"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!phoneVerifyLoading && !editLoading}
                />
                {isEditEmailVerified ? (
                  <View style={styles.verifiedBadge}>
                    <ShieldCheck size={14} color="#4ade80" />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.verifyPhoneBtn}
                    onPress={requestEmailOtp}
                    disabled={
                      phoneVerifyLoading ||
                      editLoading ||
                      !editForm.email.trim()
                    }
                  >
                    {phoneVerifyLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.verifyPhoneText}>
                        {emailOtpSent ? "Resend" : "Verify"}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              {!isEditEmailVerified && emailOtpSent ? (
                <View style={styles.phoneOtpRow}>
                  <TextInput
                    style={[styles.input, styles.phoneOtpInput]}
                    value={emailOtp}
                    onChangeText={(value) =>
                      setEmailOtp(value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="Email code"
                    placeholderTextColor="#71717a"
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!phoneVerifyLoading}
                  />
                  <TouchableOpacity
                    style={styles.confirmPhoneBtn}
                    onPress={verifyEmailOtp}
                    disabled={phoneVerifyLoading || emailOtp.length !== 6}
                  >
                    {phoneVerifyLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.verifyPhoneText}>Confirm</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}
              {!isEditEmailVerified ? (
                <Text style={styles.metadataHint}>
                  Verify this email address before saving your profile.
                </Text>
              ) : null}

              <View style={styles.phoneLabelRow}>
                <Text style={styles.label}>Phone number</Text>
                {user.phoneVerified && editForm.phone === user.phone ? (
                  <View style={styles.verifiedBadge}>
                    <ShieldCheck size={14} color="#4ade80" />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.phoneInputRow}>
                <View style={styles.phoneInputWrap}>
                  <Phone size={16} color="#71717a" />
                  <TextInput
                    style={styles.phoneInput}
                    value={editForm.phone}
                    onChangeText={(phone) => {
                      setEditForm((previous) => ({ ...previous, phone }));
                      setPhoneOtpSent(false);
                      setPhoneOtp("");
                      setEditError(null);
                    }}
                    placeholder="+919876543210"
                    placeholderTextColor="#71717a"
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    editable={!editLoading && !phoneVerifyLoading}
                  />
                </View>
                <TouchableOpacity
                  style={styles.verifyPhoneBtn}
                  onPress={requestPhoneOtp}
                  disabled={
                    phoneVerifyLoading || editLoading || !editForm.phone.trim()
                  }
                >
                  {phoneVerifyLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.verifyPhoneText}>Verify</Text>
                  )}
                </TouchableOpacity>
              </View>
              {phoneOtpSent && (
                <View style={styles.phoneOtpRow}>
                  <TextInput
                    style={[styles.input, styles.phoneOtpInput]}
                    value={phoneOtp}
                    onChangeText={(value) =>
                      setPhoneOtp(value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="6-digit code"
                    placeholderTextColor="#71717a"
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!phoneVerifyLoading}
                  />
                  <TouchableOpacity
                    style={styles.confirmPhoneBtn}
                    onPress={verifyPhoneOtp}
                    disabled={phoneVerifyLoading || phoneOtp.length !== 6}
                  >
                    {phoneVerifyLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.verifyPhoneText}>Confirm</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              <Text style={styles.metadataHint}>
                Verification code is sent to your mobile number by SMS.
              </Text>

              <Text style={styles.metadataHeading}>Device information</Text>
              <View style={styles.metadataGrid}>
                {[
                  ["Country", editForm.country],
                  ["Timezone", editForm.timezone],
                  ["SIM MCC", editForm.simMcc],
                  ["Advertising ID", editForm.advertisingId],
                ].map(([label, value]) => (
                  <View key={label} style={styles.metadataField}>
                    <Text style={styles.metadataLabel}>{label}</Text>
                    <Text style={styles.metadataValue} numberOfLines={2}>
                      {value || "Not set"}
                    </Text>
                  </View>
                ))}
                <View style={[styles.metadataField, styles.fingerprintField]}>
                  <Text style={styles.metadataLabel}>Device fingerprint</Text>
                  <Text style={styles.metadataValue} numberOfLines={2}>
                    {editForm.deviceFingerprint || "Not available"}
                  </Text>
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={closeEdit}
                  disabled={editLoading}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleEditSubmit}
                  disabled={editLoading}
                >
                  {editLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={isPasswordOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Lock size={18} color="#ff0000" />
                <Text style={styles.modalTitle}>Change Password</Text>
              </View>
              <TouchableOpacity onPress={closePasswordModal}>
                <X size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {passwordError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorBoxText}>{passwordError}</Text>
                </View>
              ) : null}
              {passwordSuccess ? (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>Password updated!</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Current Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={passwordForm.oldPassword}
                  onChangeText={(t) =>
                    setPasswordForm({ ...passwordForm, oldPassword: t })
                  }
                  secureTextEntry={!showPasswords.old}
                  placeholderTextColor="#71717a"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() =>
                    setShowPasswords((p) => ({ ...p, old: !p.old }))
                  }
                >
                  {showPasswords.old ? (
                    <EyeOff size={18} color="#a1a1aa" />
                  ) : (
                    <Eye size={18} color="#a1a1aa" />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>New Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={passwordForm.newPassword}
                  onChangeText={(t) =>
                    setPasswordForm({ ...passwordForm, newPassword: t })
                  }
                  secureTextEntry={!showPasswords.new}
                  placeholderTextColor="#71717a"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() =>
                    setShowPasswords((p) => ({ ...p, new: !p.new }))
                  }
                >
                  {showPasswords.new ? (
                    <EyeOff size={18} color="#a1a1aa" />
                  ) : (
                    <Eye size={18} color="#a1a1aa" />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={passwordForm.confirmPassword}
                  onChangeText={(t) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: t })
                  }
                  secureTextEntry={!showPasswords.confirm}
                  placeholderTextColor="#71717a"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() =>
                    setShowPasswords((p) => ({ ...p, confirm: !p.confirm }))
                  }
                >
                  {showPasswords.confirm ? (
                    <EyeOff size={18} color="#a1a1aa" />
                  ) : (
                    <Eye size={18} color="#a1a1aa" />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={closePasswordModal}
                  disabled={passwordLoading}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handlePasswordSubmit}
                  disabled={passwordLoading || passwordSuccess}
                >
                  {passwordLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalBtnText}>Update Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Video Detail Modal */}
      <Modal visible={!!selectedVideo} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Video Details</Text>
              <TouchableOpacity onPress={() => setSelectedVideo(null)}>
                <X size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            {selectedVideo && (
              <View>
                <Image
                  source={{
                    uri:
                      selectedVideo.thumbnail ||
                      "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400",
                  }}
                  style={styles.detailThumb}
                />
                <Text style={styles.detailTitle}>{selectedVideo.title}</Text>
                <Text style={{ color: "#a1a1aa", marginTop: 8, fontSize: 13 }}>
                  {Number(selectedVideo.views || 0).toLocaleString()} views
                  {"  •  "}👍 {selectedVideo.likes || 0}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.modalBtn,
                    styles.saveBtn,
                    { marginTop: 20, alignItems: "center" },
                  ]}
                  onPress={() => {
                    setSelectedVideo(null);
                    openVideo(selectedVideo);
                  }}
                >
                  <Text style={styles.modalBtnText}>Play Video</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <LogoutWarningModal
        visible={showLogoutWarning}
        onCancel={() => setShowLogoutWarning(false)}
        onConfirm={confirmLogout}
      />

      {route.name !== "You" && (
        <AdminBottomTabs navigation={navigation} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f0f" },
  center: {
    flex: 1,
    backgroundColor: "#0f0f0f",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: { color: "#aaa", marginTop: 12 },
  errorText: { color: "#f87171", fontSize: 16, textAlign: "center" },
  retryBtn: {
    marginTop: 16,
    backgroundColor: "#ff0000",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: { color: "#fff", fontWeight: "600" },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "ios" ? 54 : 28,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#272727",
  },
  accountsBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#272727",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  accountsText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  topIcons: { flexDirection: "row", gap: 4 },
  iconBtn: { padding: 8 },

  profileHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#333",
  },
  profileInfo: { flex: 1 },
  name: { color: "#fff", fontSize: 22, fontWeight: "700" },
  handle: { color: "#aaa", fontSize: 14, marginTop: 2 },
  pillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },
  pillPrimary: {
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  pillPrimaryText: { color: "#0f0f0f", fontWeight: "600", fontSize: 14 },
  pillSecondary: {
    borderWidth: 1,
    borderColor: "#3f3f3f",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  pillSecondaryText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  pencilBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#3f3f3f",
    backgroundColor: "#272727",
    alignItems: "center",
    justifyContent: "center",
  },
  editMenuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  editMenuSheet: {
    backgroundColor: "#212121",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    paddingHorizontal: 8,
  },
  editMenuHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#555",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 12,
  },
  editMenuTitle: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  editMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  editMenuText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },

  section: { marginTop: 20 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  emptyHint: {
    color: "#71717a",
    textAlign: "center",
    paddingVertical: 24,
    fontSize: 14,
  },

  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  backBtn: { padding: 4 },
  listHeaderTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },

  historyCard: { width: 160 },
  historyThumb: {
    width: 160,
    height: 90,
    borderRadius: 10,
    backgroundColor: "#272727",
  },
  historyRemoveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(127, 29, 29, 0.9)",
    position: "absolute",
    top: 6,
    right: 6,
  },
  historyRowRemoveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7f1d1d",
    marginLeft: 8,
  },
  durationBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  historyTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 6,
    lineHeight: 17,
  },
  historyChannel: { color: "#aaa", fontSize: 12, marginTop: 2 },

  libraryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
  },
  libraryIconBox: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  libraryThumb: { width: 56, height: 56 },
  libraryInfo: { flex: 1 },
  libraryTitle: { color: "#fff", fontSize: 15, fontWeight: "500" },
  librarySub: { color: "#aaa", fontSize: 13, marginTop: 2 },

  videosHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sortText: { color: "#aaa", fontSize: 13 },
  videoRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  videoRowContent: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  watchLaterRemoveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: "#7f1d1d",
  },
  videoThumb: {
    width: 140,
    height: 78,
    borderRadius: 8,
    backgroundColor: "#272727",
  },
  videoInfo: { flex: 1, justifyContent: "center" },
  videoTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 18,
  },
  videoMeta: { color: "#aaa", fontSize: 12, marginTop: 4 },
  channelHint: { color: "#71717a", fontSize: 11, marginTop: 2 },

  earningsRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  earnCard: {
    flex: 1,
    backgroundColor: "#181818",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#272727",
  },
  earnLabel: { color: "#aaa", fontSize: 12 },
  earnValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },

  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  menuSheet: {
    backgroundColor: "#212121",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    maxHeight: "80%",
  },
  menuHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#555",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  menuUserRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  menuAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#333",
  },
  menuUserName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  menuUserHandle: {
    color: "#aaa",
    fontSize: 13,
    marginTop: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuText: {
    color: "#fff",
    fontSize: 15,
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#333",
    marginVertical: 6,
    marginHorizontal: 16,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#181818",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "90%",
    padding: 20,
    borderWidth: 1,
    borderColor: "#272727",
  },
  editModalContent: {
    height: "90%",
  },
  editModalScroll: {
    flexShrink: 1,
  },
  editModalScrollContent: {
    paddingBottom: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  errorBox: {
    backgroundColor: "#450a0a",
    borderWidth: 1,
    borderColor: "#991b1b",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorBoxText: { color: "#fca5a5", fontSize: 13 },
  successBox: {
    backgroundColor: "#052e16",
    borderWidth: 1,
    borderColor: "#166534",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  successText: { color: "#86efac", fontSize: 13 },
  label: {
    color: "#aaa",
    fontSize: 12,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
    marginBottom: 4,
  },
  avatarEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  editAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: "#3f3f46",
  },
  pickAvatarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#272727",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3f3f46",
  },
  pickAvatarText: { color: "#fff", fontSize: 13 },
  phoneLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
  },
  verifiedText: {
    color: "#4ade80",
    fontSize: 12,
    fontWeight: "600",
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  phoneInputWrap: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 10,
  },
  phoneInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    paddingVertical: 10,
  },
  verifyPhoneBtn: {
    minWidth: 74,
    height: 44,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#272727",
    borderRadius: 10,
  },
  verifyPhoneText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  phoneOtpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  phoneOtpInput: {
    flex: 1,
    marginBottom: 0,
  },
  confirmPhoneBtn: {
    minWidth: 84,
    height: 44,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#166534",
    borderRadius: 10,
  },
  metadataHint: {
    color: "#71717a",
    fontSize: 12,
    marginTop: 6,
  },
  metadataHeading: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 8,
  },
  metadataGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metadataField: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: "46%",
    padding: 10,
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "#272727",
    borderRadius: 10,
  },
  fingerprintField: {
    flexBasis: "100%",
  },
  metadataLabel: {
    color: "#71717a",
    fontSize: 11,
    marginBottom: 4,
  },
  metadataValue: {
    color: "#d4d4d8",
    fontSize: 12,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  eyeBtn: { position: "absolute", right: 12, padding: 4 },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 24,
    marginBottom: 8,
  },
  modalBtn: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  cancelBtn: { backgroundColor: "#272727" },
  saveBtn: { backgroundColor: "#ff0000" },
  modalBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  detailThumb: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: "#272727",
  },
  detailTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 14,
  },
});
