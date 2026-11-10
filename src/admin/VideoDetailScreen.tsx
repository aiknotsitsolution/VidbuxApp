import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Platform,
  StatusBar,
  TextInput,
  Alert,
  FlatList,
  Pressable,
  Modal,
} from "react-native";
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEvent } from "expo";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import * as ScreenOrientation from "expo-screen-orientation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getViewSocket } from "../utils/viewSocket";
import { API_ORIGIN } from "../../config/api";
import { showToast } from "../utils/notifications";
import Navbar from "./Navbar";
import AdminBottomTabs from "./AdminBottomTabs";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BACKEND_URL = API_ORIGIN;
const API_BASE = `${BACKEND_URL}/api/uservideo`;

const AUTOPLAY_KEY = "videoo.autoplay";
const AUTOPLAY_COUNTDOWN_SECONDS = 5;

const FALLBACK_VIDEO = {
  id: 1,
  title: "Big Buck Bunny",
  channel: "Blender Foundation",
  description: "This video is being loaded from the server.",
  views: 0,
  videoUrl:
    "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  thumbnail:
    "https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
};

const formatTime = (seconds) => {
  if (!seconds || Number.isNaN(Number(seconds))) return "0:00";
  const safe = Math.max(0, Math.floor(Number(seconds)));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const formatCount = (value) => {
  const n = Number(value) || 0;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return `${n}`;
};

const resolveMediaUrl = (value) => {
  if (!value) return "";
  if (typeof value === "object") {
    value = value.url || value.uri || value.src || value.path || "";
  }
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const normalized = String(value).replace(/\\/g, "/");
  if (normalized.startsWith("uploads/")) return `${BACKEND_URL}/${normalized}`;
  if (normalized.includes("uploads/"))
    return `${BACKEND_URL}/${normalized.split("uploads/").pop()}`;
  if (normalized.startsWith("/uploads/")) return `${BACKEND_URL}${normalized}`;
  return `${BACKEND_URL}/${normalized}`;
};

const isShortVideo = (video) => {
  const types = Array.isArray(video?.videoType)
    ? video.videoType
    : [video?.videoType];
  return types.some((type) => String(type).toLowerCase() === "short");
};

const getGuestId = async () => {
  const storageKey = "video_guest_id";
  const existing = await AsyncStorage.getItem(storageKey);
  if (existing) return existing;

  const guestId = `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await AsyncStorage.setItem(storageKey, guestId);
  return guestId;
};

export default function VideoDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isFocused = useIsFocused();
  const routeId = route?.params?.id ?? route?.params?.videoId ?? 1;
  const routeVideo = route?.params?.item ?? route?.params?.video ?? null;

  // ==================== STATE ====================
  const [loading, setLoading] = useState(true);
  const [videoDetails, setVideoDetails] = useState(
    routeVideo || FALLBACK_VIDEO,
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [watchedPercent, setWatchedPercent] = useState(
    Math.max(0, Math.min(100, Number(routeVideo?.watchedPercent) || 0)),
  );
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [likesCount, setLikesCount] = useState(
    Number(routeVideo?.likesCount ?? routeVideo?.likes ?? 0),
  );
  const [dislikesCount, setDislikesCount] = useState(
    Number(routeVideo?.dislikesCount ?? routeVideo?.dislikes ?? 0),
  );
  const [liked, setLiked] = useState(Boolean(routeVideo?.isLiked));
  const [disliked, setDisliked] = useState(Boolean(routeVideo?.isDisliked));
  const [isWatchLater, setIsWatchLater] = useState(
    Boolean(
      routeVideo?.isWatchLater ??
      routeVideo?.inWatchLater ??
      routeVideo?.isInWatchLater,
    ),
  );
  const [watchLaterLoading, setWatchLaterLoading] = useState(false);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [subscribeLoading, setSubscribeLoading] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const [suggestedVideos, setSuggestedVideos] = useState([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);

  const [autoplay, setAutoplay] = useState(true);
  const [upNextOverlay, setUpNextOverlay] = useState(null);
  const [countdownLeft, setCountdownLeft] = useState(null);

  // ==================== REFS ====================
  const controlsTimer = useRef(null);
  const lastTap = useRef(0);
  const lastTapSide = useRef(null);
  const countdownTimerRef = useRef(null);
  const nextTargetRef = useRef(null);
  const playedVideoIdsRef = useRef(new Set());
  const resumeApplied = useRef(false);
  const lastProgressSent = useRef({ time: 0, percent: 0, timestamp: 0 });
  const viewRequestInFlight = useRef(false);
  const latestTimeRef = useRef(0);
  const latestDurationRef = useRef(0);
  const isScreenFocusedRef = useRef(isFocused);

  useEffect(() => {
    if (!isShortVideo(routeVideo)) return;
    navigation.replace("MainTabs", {
      screen: "Shorts",
      params: { video: routeVideo },
    });
  }, [navigation, routeVideo]);

  useEffect(() => {
    let active = true;
    let currentSocket;
    let viewHandler;

    getViewSocket().then((socket) => {
      if (!active || !socket) return;
      currentSocket = socket;
      const handleViewCountUpdated = ({ videoId, views }) => {
        if (String(videoId) !== String(routeId)) return;
        setVideoDetails((previous) => ({ ...previous, views: Number(views) }));
      };
      socket.on("view-count-updated", handleViewCountUpdated);
      viewHandler = handleViewCountUpdated;
    });

    return () => {
      active = false;
      if (currentSocket && viewHandler) {
        currentSocket.off("view-count-updated", viewHandler);
      }
    };
  }, [routeId]);

  const saveWatchProgress = useCallback(
    async (time, videoDuration) => {
      if (
        !routeId ||
        !videoDuration ||
        time <= 0 ||
        viewRequestInFlight.current
      ) {
        return;
      }

      let percent = Math.max(
        1,
        Math.min(100, Math.round((time / videoDuration) * 100)),
      );

      if (percent >= 95) percent = 100;

      if (percent < 1) return;

      const previous = lastProgressSent.current;
      const timeDelta = time - previous.time;
      const percentDelta = Math.abs(percent - previous.percent);
      const isDuplicateBurst =
        previous.time > 0 &&
        timeDelta < 12 &&
        percentDelta < 3 &&
        Date.now() - previous.timestamp < 12000;

      if (isDuplicateBurst) return;

      lastProgressSent.current = { time, percent, timestamp: Date.now() };
      viewRequestInFlight.current = true;
      try {
        const token = await AsyncStorage.getItem("token");
        const guestId = token ? null : await getGuestId();

        if (token) {
          await fetch(`${API_BASE}/history/${routeId}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }

        const res = await fetch(`${API_BASE}/${routeId}/view`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            watchedPercent: percent,
            duration: videoDuration,
            watchSeconds: time,
            guestId,
          }),
        });

        if (!res.ok) {
          console.warn("Watch progress save failed:", res.status);
          return;
        }

        const data = await res.json().catch(() => ({}));
        if (typeof data.views === "number") {
          setVideoDetails((previous) => ({ ...previous, views: data.views }));
        }
      } catch (error) {
        console.warn("Watch progress save error:", error);
      } finally {
        viewRequestInFlight.current = false;
      }
    },
    [routeId],
  );

  // ==================== MEDIA URLS ====================
  const resolvedVideoUrl = useMemo(() => {
    const candidate =
      videoDetails?.videoUrl ||
      videoDetails?.video ||
      videoDetails?.videofile ||
      videoDetails?.uri ||
      FALLBACK_VIDEO.videoUrl;
    return resolveMediaUrl(candidate) || FALLBACK_VIDEO.videoUrl;
  }, [videoDetails]);

  const resolvedThumbnail = useMemo(() => {
    const candidate =
      videoDetails?.thumbnail ||
      videoDetails?.thumb ||
      videoDetails?.poster ||
      FALLBACK_VIDEO.thumbnail;
    return resolveMediaUrl(candidate) || FALLBACK_VIDEO.thumbnail;
  }, [videoDetails]);

  // ==================== PLAYER ====================
  const player = useVideoPlayer(resolvedVideoUrl, (p) => {
    p.loop = false;
    p.muted = false;
    p.timeUpdateEventInterval = 0.5; // ← MUST ADD THIS
  });

  useEffect(() => {
    if (!player) return;

    const subscription = player.addListener("statusChange", (event) => {
      if (event.status === "error") {
        console.warn("Video playback error:", event.error || "Unknown error");
      }
    });

    return () => subscription.remove();
  }, [player]);

  // ==================== HELPERS ====================
  const cancelCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    nextTargetRef.current = null;
    setUpNextOverlay(null);
    setCountdownLeft(null);
  }, []);

  useEffect(() => {
    isScreenFocusedRef.current = isFocused;
    if (isFocused || !player) return;

    player.pause();
    setIsPlaying(false);
    cancelCountdown();
  }, [isFocused, player, cancelCountdown]);

  const handleBack = useCallback(() => {
    player?.pause();
    setIsPlaying(false);
    cancelCountdown();
    navigation.goBack();
  }, [player, cancelCountdown, navigation]);

  const getNextUpNext = useCallback(() => {
    if (!suggestedVideos || suggestedVideos.length === 0) return null;
    const currentId = String(routeId);
    const filtered = suggestedVideos.filter(
      (v) => String(v._id || v.id) !== currentId,
    );
    return filtered[0] || null;
  }, [suggestedVideos, routeId]);

  const startCountdown = useCallback((next) => {
    if (countdownTimerRef.current) return;
    nextTargetRef.current = next;
    setUpNextOverlay(next);
    setCountdownLeft(AUTOPLAY_COUNTDOWN_SECONDS);

    countdownTimerRef.current = setInterval(() => {
      setCountdownLeft((prev) =>
        Math.max(0, (prev ?? AUTOPLAY_COUNTDOWN_SECONDS) - 1),
      );
    }, 1000);
  }, []);

  const handleVideoEnded = useCallback(() => {
    // Force full watch percent on end
    const finalTime =
      latestDurationRef.current > 0
        ? latestDurationRef.current
        : latestTimeRef.current;

    saveWatchProgress(finalTime, latestDurationRef.current || finalTime);

    const next = getNextUpNext();
    if (!next) {
      setUpNextOverlay(null);
      setCountdownLeft(null);
      return;
    }

    if (autoplay) {
      startCountdown(next);
    } else {
      nextTargetRef.current = next;
      setUpNextOverlay(next);
      setCountdownLeft(null);
    }
  }, [getNextUpNext, autoplay, startCountdown, saveWatchProgress]);
  // Unlock orientation
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      ).catch(() => {});
    };
  }, []);

  // Fullscreen orientation
  useEffect(() => {
    if (isFullscreen) {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE,
      ).catch(() => {});
      StatusBar.setHidden(true);
    } else {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      ).catch(() => {});
      StatusBar.setHidden(false);
    }
    return () => {
      StatusBar.setHidden(false);
    };
  }, [isFullscreen]);

  // Load autoplay preference
  useEffect(() => {
    (async () => {
      try {
        const value = await AsyncStorage.getItem(AUTOPLAY_KEY);
        if (value !== null) setAutoplay(value !== "false");
      } catch {}
    })();
  }, []);

  // Persist autoplay
  useEffect(() => {
    AsyncStorage.setItem(AUTOPLAY_KEY, String(autoplay)).catch(() => {});
  }, [autoplay]);

  // Reload video when URL changes
  useEffect(() => {
    if (!player || !resolvedVideoUrl || !isFocused) return;
    const load = async () => {
      try {
        await player.replaceAsync(resolvedVideoUrl);
        if (isScreenFocusedRef.current) {
          player.play();
          setIsPlaying(true);
        }
      } catch (e) {
        console.warn("Video load error:", e);
      }
      if (!isScreenFocusedRef.current) return;
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(true);
      resumeApplied.current = false;
      lastProgressSent.current = { time: 0, percent: 0, timestamp: 0 };
      latestTimeRef.current = 0;
      latestDurationRef.current = 0;
      cancelCountdown();
    };
    load();
  }, [player, resolvedVideoUrl, cancelCountdown, isFocused]);

  // Mute
  useEffect(() => {
    if (!player) return;
    try {
      player.muted = isMuted;
    } catch (e) {}
  }, [player, isMuted]);

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      cancelCountdown();
    };
  }, [cancelCountdown]);

  // ==================== PLAYER EVENTS ====================
  const timeUpdate = useEvent(player, "timeUpdate", {
    currentTime: 0,
    bufferedPosition: 0,
    currentLiveTimestamp: 0,
    currentOffsetFromLive: 0,
  });

  useEffect(() => {
    const t = Number(timeUpdate?.currentTime || 0);
    const d = Number(player.duration) || 0;
    setCurrentTime(t);
    if (d > 0) setDuration(d);
    latestTimeRef.current = t;
    if (d > 0) latestDurationRef.current = d;
  }, [player, timeUpdate]);

  useEffect(() => {
    if (!player) return;

    const subscription = player.addListener("playToEnd", handleVideoEnded);
    return () => subscription.remove();
  }, [player, handleVideoEnded]);

  // Auto-advance when countdown reaches 0
  useEffect(() => {
    if (countdownLeft === null) return;
    if (countdownLeft <= 0) {
      const target = nextTargetRef.current;
      cancelCountdown();
      if (target) {
        openSuggestedVideo(target);
      }
    }
  }, [countdownLeft, cancelCountdown]);

  // Track played videos
  useEffect(() => {
    return () => {
      if (routeId) playedVideoIdsRef.current.add(String(routeId));
    };
  }, [routeId]);

  // ==================== FETCH DATA ====================
  useEffect(() => {
    const fetchAll = async () => {
      if (!routeId) return;
      setWatchedPercent(0);
      resumeApplied.current = false;
      const token = await AsyncStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/${routeId}`, { headers });
        const data = await res.json().catch(() => ({}));
        const payload = data?.video || data;
        if (payload) {
          if (isShortVideo(payload)) {
            navigation.replace("MainTabs", {
              screen: "Shorts",
              params: { video: payload },
            });
            return;
          }
          setVideoDetails((prev) => ({ ...prev, ...payload }));
          setLikesCount(Number(payload.likesCount ?? payload.likes ?? 0));
          setDislikesCount(
            Number(payload.dislikesCount ?? payload.dislikes ?? 0),
          );
          setLiked(Boolean(payload.isLiked || payload.userReaction === "like"));
          setDisliked(
            Boolean(payload.isDisliked || payload.userReaction === "dislike"),
          );
          setIsWatchLater(
            Boolean(
              payload.isWatchLater ??
              payload.inWatchLater ??
              payload.isInWatchLater,
            ),
          );
          setWatchedPercent(
            Math.max(0, Math.min(100, Number(payload.watchedPercent) || 0)),
          );
          setIsSubscribed(Boolean(payload.isSubscribed));
          setSubscribersCount(
            Number(
              payload.channel?.subscribersCount ||
                payload.subscribersCount ||
                0,
            ),
          );
        }
      } catch (e) {
        console.warn("Video details error:", e);
      } finally {
        setLoading(false);
      }

      try {
        setCommentsLoading(true);
        const res = await fetch(`${API_BASE}/${routeId}/comments`, {
          headers,
        });
        const data = await res.json().catch(() => ({}));
        setComments(Array.isArray(data?.comments) ? data.comments : []);
      } catch (e) {
        console.warn("Comments error:", e);
      } finally {
        setCommentsLoading(false);
      }

      try {
        setSuggestedLoading(true);
        let res = await fetch(`${API_BASE}/${routeId}/related`, { headers });
        let data = await res.json().catch(() => ({}));

        let list = [];
        if (Array.isArray(data?.videos)) list = data.videos;
        else if (Array.isArray(data?.data)) list = data.data;

        if (list.length === 0) {
          res = await fetch(`${API_BASE}?limit=15&exclude=${routeId}`, {
            headers,
          });
          data = await res.json().catch(() => ({}));
          if (Array.isArray(data?.videos)) list = data.videos;
          else if (Array.isArray(data?.data)) list = data.data;
          else if (Array.isArray(data)) list = data;
        }

        const currentId = String(routeId);
        const watched = playedVideoIdsRef.current;
        list = list.filter((v) => {
          const vidId = String(v._id || v.id);
          return vidId !== currentId && !watched.has(vidId) && !isShortVideo(v);
        });

        setSuggestedVideos(list.slice(0, 12));
      } catch (e) {
        console.warn("Suggested error:", e);
      } finally {
        setSuggestedLoading(false);
      }
    };

    fetchAll();
  }, [routeId]);

  // Resume from last saved position
  useEffect(() => {
    if (!player || !duration || resumeApplied.current || watchedPercent <= 0) {
      return;
    }

    const resumeAt = Math.min(duration, (watchedPercent / 100) * duration);
    if (resumeAt < duration - 2) {
      player.currentTime = resumeAt;
      setCurrentTime(resumeAt);
    }
    resumeApplied.current = true;
  }, [player, duration, watchedPercent]);

  // Save progress
  useEffect(() => {
    if (!routeId || !duration || !currentTime) return;
    const percent = Math.min(100, Math.round((currentTime / duration) * 100));
    setWatchedPercent(percent);
    const previous = lastProgressSent.current;
    if (
      percent < 1 ||
      (previous.time > 0 &&
        currentTime - previous.time < 12 &&
        Math.abs(percent - previous.percent) < 3)
    ) {
      return;
    }

    saveWatchProgress(currentTime, duration);
  }, [currentTime, duration, routeId, saveWatchProgress]);

  useEffect(() => {
    return () => {
      saveWatchProgress(latestTimeRef.current, latestDurationRef.current);
    };
  }, [saveWatchProgress]);

  // ==================== CONTROLS ====================
  useEffect(() => {
    if (!showControls) return;
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3500);
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [showControls, isPlaying, isFullscreen]);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
  }, []);

  const handleTogglePlayPause = useCallback(() => {
    if (!player || !isScreenFocusedRef.current) return;
    try {
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
      } else {
        player.play();
        setIsPlaying(true);
      }
    } catch (e) {
      console.warn("Play/pause error:", e);
    }
    showControlsTemporarily();
  }, [player, isPlaying, showControlsTemporarily]);

  // Double tap seek / single tap toggle controls
  const handleSideTap = useCallback(
    (side) => {
      const now = Date.now();
      if (now - lastTap.current < 280 && lastTapSide.current === side) {
        // Double tap → seek
        if (player && duration) {
          const offset = side === "left" ? -10 : 10;
          const newTime = Math.max(0, Math.min(duration, currentTime + offset));
          try {
            player.currentTime = newTime;
            setCurrentTime(newTime);
          } catch (e) {}
        }
        showControlsTemporarily();
      } else {
        // Single tap → toggle controls
        setShowControls((prev) => !prev);
      }
      lastTap.current = now;
      lastTapSide.current = side;
    },
    [player, duration, currentTime, showControlsTemporarily],
  );

  const handleSeek = useCallback(
    (value) => {
      if (!player || !duration) return;
      try {
        const seekTo = Math.max(0, Math.min(duration, value * duration));
        player.currentTime = seekTo;
        setCurrentTime(seekTo);
      } catch (e) {}
      showControlsTemporarily();
    },
    [player, duration, showControlsTemporarily],
  );

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  // ==================== ACTIONS ====================
  const handleLike = async () => {
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      navigation.navigate("Login");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/${routeId}/like`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Unable to update like.");
      }

      setLikesCount(Number(data.likes ?? data.likesCount ?? likesCount));
      setDislikesCount(
        Number(data.dislikes ?? data.dislikesCount ?? dislikesCount),
      );
      setLiked(
        typeof data.liked === "boolean"
          ? data.liked
          : data.reaction === "like" || data.userReaction === "like",
      );
      setDisliked(
        typeof data.disliked === "boolean"
          ? data.disliked
          : data.reaction === "dislike" || data.userReaction === "dislike",
      );
    } catch (e) {
      showToast("error", "Error", "Unable to update like. Please try again.");
    }
  };

  const handleDislike = async () => {
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      navigation.navigate("Login");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/${routeId}/dislike`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Unable to update dislike.");
      }

      setLikesCount(Number(data.likes ?? data.likesCount ?? likesCount));
      setDislikesCount(
        Number(data.dislikes ?? data.dislikesCount ?? dislikesCount),
      );
      setLiked(
        typeof data.liked === "boolean"
          ? data.liked
          : data.reaction === "like" || data.userReaction === "like",
      );
      setDisliked(
        typeof data.disliked === "boolean"
          ? data.disliked
          : data.reaction === "dislike" || data.userReaction === "dislike",
      );
    } catch (e) {
      showToast(
        "error",
        "Error",
        "Unable to update dislike. Please try again.",
      );
    }
  };

  const handleWatchLater = async () => {
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      navigation.navigate("Login");
      return;
    }

    setWatchLaterLoading(true);
    try {
      const res = await fetch(`${API_BASE}/watch-later/${routeId}`, {
        method: isWatchLater ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Could not update Watch Later.");
      }

      const nextIsWatchLater = isWatchLater
        ? false
        : Boolean(data.added ?? data.isWatchLater ?? true);
      setIsWatchLater(nextIsWatchLater);
      showToast(
        "success",
        "Watch Later",
        data.message ||
          (nextIsWatchLater
            ? "Added to Watch Later"
            : "Removed from Watch Later"),
      );
    } catch (e) {
      showToast(
        "error",
        "Watch Later",
        "Something went wrong. Please try again.",
      );
    } finally {
      setWatchLaterLoading(false);
    }
  };

  const handleSubscribe = async () => {
    const channelId = videoDetails?.channel?._id || videoDetails?.channel?.id;
    if (!channelId) return;

    const token = await AsyncStorage.getItem("token");
    if (!token) {
      navigation.navigate("Login");
      return;
    }

    setSubscribeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/subscribe/${channelId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        setIsSubscribed(Boolean(data.subscribed));
        if (typeof data.subscribersCount === "number") {
          setSubscribersCount(data.subscribersCount);
        }
      }
    } catch (e) {
    } finally {
      setSubscribeLoading(false);
    }
  };

  const openChannel = () => {
    const channel = videoDetails?.channel;
    const channelId =
      (typeof channel === "object"
        ? channel?._id || channel?.id || channel?.channelId
        : null) || videoDetails?.channelId;
    if (!channelId) return;

    const routeNames = navigation.getState()?.routeNames || [];
    if (routeNames.includes("SubscribedChannels")) {
      navigation.navigate("SubscribedChannels", { id: channelId });
      return;
    }

    if (routeNames.includes("AdminPanel")) {
      navigation.navigate("AdminPanel", {
        screen: "SubscribedChannels",
        params: { id: channelId },
      });
    }
  };

  const handleCopyrightReport = () => {
    Alert.alert(
      "Copyright",
      "Do you want to report a copyright issue for this video?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report copyright",
          onPress: () =>
            navigation.navigate("CopyrightClaim", {
              videoId: String(routeId),
              title: videoDetails?.title || FALLBACK_VIDEO.title,
            }),
        },
      ],
    );
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim() || !routeId) return;
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      navigation.navigate("Login");
      return;
    }
    try {
      setCommentLoading(true);
      const res = await fetch(`${API_BASE}/${routeId}/comment`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ commentText: commentText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        setComments((prev) => [
          {
            _id: Date.now().toString(),
            text: commentText.trim(),
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        setCommentText("");
      }
    } catch (e) {
    } finally {
      setCommentLoading(false);
    }
  };

  const openSuggestedVideo = (item) => {
    cancelCountdown();
    setIsFullscreen(false);
    const id = item._id || item.id;
    navigation.replace("VideoDetail", {
      id,
      videoId: id,
      item,
      video: item,
    });
  };

  const handleReplay = () => {
    if (player && isScreenFocusedRef.current) {
      player.currentTime = 0;
      player.play();
      setIsPlaying(true);
    }
    cancelCountdown();
  };

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  // ==================== SHARED PLAYER UI ====================
  const renderPlayerControls = (fullscreenMode = false) => (
    <>
      {/* Left / Right double-tap zones */}
      <View style={styles.tapZones} pointerEvents="box-none">
        <Pressable
          style={styles.tapZone}
          onPress={() => handleSideTap("left")}
        />
        <Pressable
          style={styles.tapZone}
          onPress={() => handleSideTap("right")}
        />
      </View>

      {/* UP NEXT OVERLAY */}
      {upNextOverlay && (
        <View style={styles.upNextOverlay}>
          <View style={styles.upNextCard}>
            {countdownLeft !== null && (
              <View style={styles.countdownRow}>
                <Ionicons name="play-skip-forward" size={16} color="#fff" />
                <Text style={styles.countdownText}>
                  Up next in {countdownLeft}s
                </Text>
              </View>
            )}

            <View style={styles.upNextBody}>
              <Image
                source={{
                  uri:
                    resolveMediaUrl(
                      upNextOverlay.thumbnail ||
                        upNextOverlay.thumb ||
                        upNextOverlay.poster,
                    ) || FALLBACK_VIDEO.thumbnail,
                }}
                style={styles.upNextThumb}
              />
              <View style={styles.upNextMeta}>
                <Text style={styles.upNextTitle} numberOfLines={2}>
                  {upNextOverlay.title || "Next Video"}
                </Text>
                <Text style={styles.upNextChannel} numberOfLines={1}>
                  {upNextOverlay.channel?.name ||
                    upNextOverlay.channel ||
                    "Channel"}
                </Text>
              </View>
            </View>

            <View style={styles.upNextActions}>
              <TouchableOpacity style={styles.upNextBtn} onPress={handleReplay}>
                <Ionicons name="refresh" size={16} color="#fff" />
                <Text style={styles.upNextBtnText}>Replay</Text>
              </TouchableOpacity>

              {countdownLeft !== null ? (
                <TouchableOpacity
                  style={styles.upNextBtn}
                  onPress={cancelCountdown}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                  <Text style={styles.upNextBtnText}>Cancel</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.upNextBtn, styles.upNextBtnPrimary]}
                  onPress={() => openSuggestedVideo(upNextOverlay)}
                >
                  <Ionicons name="play-skip-forward" size={16} color="#000" />
                  <Text style={[styles.upNextBtnText, { color: "#000" }]}>
                    Play Next
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      {/* CONTROLS OVERLAY - YouTube style */}
      {showControls && !upNextOverlay && (
        <View style={styles.playerControls} pointerEvents="box-none">
          {/* Top bar */}
          <View
            style={[
              styles.topBar,
              fullscreenMode && { paddingTop: Platform.OS === "ios" ? 20 : 12 },
            ]}
          >
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                if (fullscreenMode) {
                  setIsFullscreen(false);
                } else {
                  handleBack();
                }
              }}
            >
              <Ionicons
                name={fullscreenMode ? "chevron-down" : "arrow-back"}
                size={22}
                color="#fff"
              />
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setIsMuted((p) => !p)}
            >
              <Ionicons
                name={isMuted ? "volume-mute" : "volume-high"}
                size={22}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          {/* Center controls: rewind | play/pause | forward */}
          <View style={styles.centerControls}>
            <TouchableOpacity
              style={styles.centerSideBtn}
              onPress={() => {
                if (player && duration) {
                  const newTime = Math.max(0, currentTime - 10);
                  player.currentTime = newTime;
                  setCurrentTime(newTime);
                  showControlsTemporarily();
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="play-back" size={28} color="#fff" />
              <Text style={styles.seekLabel}>10</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.centerPlay}
              onPress={handleTogglePlayPause}
              activeOpacity={0.85}
            >
              <View style={styles.playCircle}>
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={40}
                  color="#fff"
                  style={!isPlaying ? { marginLeft: 4 } : undefined}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.centerSideBtn}
              onPress={() => {
                if (player && duration) {
                  const newTime = Math.min(duration, currentTime + 10);
                  player.currentTime = newTime;
                  setCurrentTime(newTime);
                  showControlsTemporarily();
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="play-forward" size={28} color="#fff" />
              <Text style={styles.seekLabel}>10</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom: time + slider + fullscreen */}
          <View style={styles.bottomControls}>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </Text>
              <TouchableOpacity
                style={styles.fullscreenBtn}
                onPress={toggleFullscreen}
              >
                <Ionicons
                  name={fullscreenMode ? "contract" : "expand"}
                  size={22}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>

            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={progress}
              onSlidingComplete={handleSeek}
              onValueChange={() => showControlsTemporarily()}
              minimumTrackTintColor="#ff0000"
              maximumTrackTintColor="rgba(255,255,255,0.35)"
              thumbTintColor="#ff0000"
            />
          </View>
        </View>
      )}
    </>
  );

  // ==================== RENDER SUGGESTED ====================
  const renderSuggestedItem = ({ item }) => {
    const thumb =
      resolveMediaUrl(item.thumbnail || item.thumb || item.poster) ||
      FALLBACK_VIDEO.thumbnail;

    return (
      <TouchableOpacity
        style={styles.suggestedCard}
        activeOpacity={0.85}
        onPress={() => openSuggestedVideo(item)}
      >
        <Image source={{ uri: thumb }} style={styles.suggestedThumb} />
        <View style={styles.suggestedInfo}>
          <Text style={styles.suggestedTitle} numberOfLines={2}>
            {item.title || "Untitled"}
          </Text>
          <Text style={styles.suggestedMeta} numberOfLines={1}>
            {item.channel?.name || item.channel || "Channel"}
          </Text>
          <Text style={styles.suggestedViews}>
            {formatCount(item.views)} views
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ==================== MAIN RENDER ====================
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#0f0f0f"
        hidden={isFullscreen}
      />

      {/* ===== NORMAL (portrait) PLAYER ===== */}
      {!isFullscreen && (
        <>
          <Navbar onMenuPress={() => {}} points={0} />
          <ScrollView
            style={styles.detailScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled
          >
            <View style={styles.videoWrapper}>
              <VideoView
                player={player}
                style={styles.videoPlayer}
                contentFit="contain"
                nativeControls={false}
                allowsPictureInPicture={false}
              />
              {renderPlayerControls(false)}
            </View>

            {/* INFO */}
            <View style={styles.infoSection}>
              <Text style={styles.title} numberOfLines={2}>
                {videoDetails?.title || FALLBACK_VIDEO.title}
              </Text>

              <Text style={styles.meta}>
                {formatCount(
                  videoDetails?.views ?? videoDetails?.viewCount ?? 0,
                )}{" "}
                views
                {videoDetails?.createdAt
                  ? `  •  ${new Date(videoDetails.createdAt).toLocaleDateString()}`
                  : ""}
              </Text>

              <View style={styles.channelRow}>
                <TouchableOpacity
                  style={styles.channelIdentity}
                  onPress={openChannel}
                  disabled={
                    !(
                      videoDetails?.channel?._id ||
                      videoDetails?.channel?.id ||
                      videoDetails?.channel?.channelId ||
                      videoDetails?.channelId
                    )
                  }
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Open channel"
                >
                  <Image
                    source={{
                      uri:
                        resolveMediaUrl(videoDetails?.channel?.channelImage) ||
                        resolvedThumbnail,
                    }}
                    style={styles.channelAvatar}
                  />
                  <View style={styles.channelInfo}>
                    <Text style={styles.channelName} numberOfLines={1}>
                      {videoDetails?.channel?.name ||
                        videoDetails?.channel ||
                        "Channel"}
                    </Text>
                    <Text style={styles.subscribersText}>
                      {formatCount(subscribersCount)} subscribers
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.subscribeBtn,
                    isSubscribed && styles.subscribedBtn,
                  ]}
                  onPress={handleSubscribe}
                  disabled={subscribeLoading}
                >
                  {subscribeLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={isSubscribed ? "#fff" : "#0f0f0f"}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.subscribeText,
                        isSubscribed && styles.subscribedText,
                      ]}
                    >
                      {isSubscribed ? "Subscribed" : "Subscribe"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.actionRow}
              >
                <TouchableOpacity
                  style={[styles.actionBtn, liked && styles.actionBtnActive]}
                  onPress={handleLike}
                >
                  <Ionicons
                    name={liked ? "thumbs-up" : "thumbs-up-outline"}
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.actionText}>
                    {formatCount(likesCount)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, disliked && styles.actionBtnActive]}
                  onPress={handleDislike}
                >
                  <Ionicons
                    name={disliked ? "thumbs-down" : "thumbs-down-outline"}
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.actionText}>
                    {formatCount(dislikesCount)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    isWatchLater && styles.actionBtnActive,
                  ]}
                  onPress={handleWatchLater}
                  disabled={watchLaterLoading}
                >
                  {watchLaterLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons
                      name={isWatchLater ? "bookmark" : "bookmark-outline"}
                      size={18}
                      color="#fff"
                    />
                  )}
                  <Text style={styles.actionText}>
                    {isWatchLater
                      ? "Remove from Watch Later"
                      : "Save to Watch Later"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn}>
                  <Ionicons name="share-outline" size={18} color="#fff" />
                  <Text style={styles.actionText}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={handleCopyrightReport}
                >
                  <Ionicons name="shield-outline" size={18} color="#fff" />
                  <Text style={styles.actionText}>Report</Text>
                </TouchableOpacity>
              </ScrollView>

              <View style={styles.descriptionBox}>
                <Text style={styles.description} numberOfLines={3}>
                  {videoDetails?.description || FALLBACK_VIDEO.description}
                </Text>
              </View>
            </View>

            {/* UP NEXT */}
            <View style={styles.suggestedSection}>
              <View style={styles.suggestedHeader}>
                <Text style={styles.sectionTitle}>Up next</Text>
                <View style={styles.autoplayRow}>
                  <Text style={styles.autoplayLabel}>Autoplay</Text>
                  <TouchableOpacity
                    style={[
                      styles.switch,
                      autoplay ? styles.switchOn : styles.switchOff,
                    ]}
                    onPress={() => setAutoplay((p) => !p)}
                  >
                    <View
                      style={[
                        styles.switchThumb,
                        autoplay && styles.switchThumbOn,
                      ]}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {suggestedLoading ? (
                <ActivityIndicator
                  color="#fff"
                  style={{ marginVertical: 24 }}
                />
              ) : suggestedVideos.length > 0 ? (
                <FlatList
                  data={suggestedVideos}
                  keyExtractor={(item) => String(item._id || item.id)}
                  renderItem={renderSuggestedItem}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                />
              ) : (
                <Text style={styles.emptyText}>No suggestions available</Text>
              )}
            </View>

            {/* COMMENTS */}
            <View style={styles.commentsCard}>
              <Text style={styles.sectionTitle}>
                Comments • {comments.length}
              </Text>

              <View style={styles.commentInputRow}>
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  style={styles.commentInput}
                  placeholder="Add a comment..."
                  placeholderTextColor="#888"
                  multiline
                />
                <TouchableOpacity
                  style={[
                    styles.postBtn,
                    (!commentText.trim() || commentLoading) && { opacity: 0.5 },
                  ]}
                  onPress={handleCommentSubmit}
                  disabled={!commentText.trim() || commentLoading}
                >
                  {commentLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.postBtnText}>Post</Text>
                  )}
                </TouchableOpacity>
              </View>

              {commentsLoading ? (
                <ActivityIndicator
                  color="#fff"
                  style={{ marginVertical: 14 }}
                />
              ) : comments.length > 0 ? (
                comments.map((c) => (
                  <View key={c._id || c.id} style={styles.commentItem}>
                    <Text style={styles.commentText}>
                      {c.text || c.comment}
                    </Text>
                    <Text style={styles.commentMeta}>
                      {c.createdAt
                        ? new Date(c.createdAt).toLocaleDateString()
                        : "Just now"}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No comments yet.</Text>
              )}
            </View>

            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </ScrollView>
          <AdminBottomTabs navigation={navigation} />
        </>
      )}

      {/* ===== FULLSCREEN PLAYER (Modal) ===== */}
      <Modal
        visible={isFullscreen}
        animationType="fade"
        supportedOrientations={[
          "landscape",
          "landscape-left",
          "landscape-right",
        ]}
        onRequestClose={() => setIsFullscreen(false)}
      >
        <View style={styles.fullscreenContainer}>
          <VideoView
            player={player}
            style={styles.fullscreenVideo}
            contentFit="contain"
            nativeControls={false}
            allowsPictureInPicture={false}
          />
          {renderPlayerControls(true)}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  detailScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 112,
  },
  // ========== PLAYER ==========
  videoWrapper: {
    width: SCREEN_WIDTH,
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
    position: "relative",
    overflow: "hidden",
  },
  videoPlayer: {
    ...StyleSheet.absoluteFill,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    position: "relative",
  },
  fullscreenVideo: {
    ...StyleSheet.absoluteFill,
  },
  tapZones: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
  },
  tapZone: {
    flex: 1,
  },
  playerControls: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "ios" ? 48 : 16,
  },
  iconBtn: {
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  centerControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 36,
  },
  centerSideBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    height: 56,
  },
  seekLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    marginTop: -2,
  },
  centerPlay: {
    alignSelf: "center",
  },
  playCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  bottomControls: {
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === "ios" ? 16 : 12,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  timeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  fullscreenBtn: {
    padding: 6,
  },
  slider: {
    width: "100%",
    height: 28,
  },

  // ========== UP NEXT OVERLAY ==========
  upNextOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  upNextCard: {
    width: "88%",
    backgroundColor: "#212121",
    borderRadius: 12,
    padding: 16,
  },
  countdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  countdownText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  upNextBody: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  upNextThumb: {
    width: 120,
    height: 68,
    borderRadius: 8,
    backgroundColor: "#333",
  },
  upNextMeta: {
    flex: 1,
    justifyContent: "center",
  },
  upNextTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  upNextChannel: {
    color: "#aaa",
    fontSize: 12,
    marginTop: 4,
  },
  upNextActions: {
    flexDirection: "row",
    gap: 10,
  },
  upNextBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  upNextBtnPrimary: {
    backgroundColor: "#fff",
  },
  upNextBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  // ========== INFO ==========
  infoSection: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 8,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },
  meta: {
    color: "#aaa",
    fontSize: 13,
    marginTop: 6,
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 12,
  },
  channelIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  channelAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#333",
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  subscribersText: {
    color: "#aaa",
    fontSize: 12,
    marginTop: 2,
  },
  subscribeBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    minWidth: 100,
    alignItems: "center",
  },
  subscribedBtn: {
    backgroundColor: "#272727",
  },
  subscribeText: {
    color: "#0f0f0f",
    fontWeight: "700",
    fontSize: 13,
  },
  subscribedText: {
    color: "#fff",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    paddingRight: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#272727",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  actionBtnActive: {
    backgroundColor: "#3f3f3f",
  },
  actionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  descriptionBox: {
    marginTop: 14,
    backgroundColor: "#272727",
    borderRadius: 12,
    padding: 12,
  },
  description: {
    color: "#ddd",
    fontSize: 14,
    lineHeight: 20,
  },

  // ========== SUGGESTED ==========
  suggestedSection: {
    marginTop: 8,
    paddingHorizontal: 12,
  },
  suggestedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  autoplayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  autoplayLabel: {
    color: "#aaa",
    fontSize: 13,
  },
  switch: {
    width: 40,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  switchOn: {
    backgroundColor: "#3ea6ff",
  },
  switchOff: {
    backgroundColor: "#555",
  },
  switchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#fff",
  },
  switchThumbOn: {
    alignSelf: "flex-end",
  },
  suggestedCard: {
    flexDirection: "row",
    gap: 12,
  },
  suggestedThumb: {
    width: 168,
    height: 94,
    borderRadius: 8,
    backgroundColor: "#222",
  },
  suggestedInfo: {
    flex: 1,
    justifyContent: "center",
  },
  suggestedTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 18,
  },
  suggestedMeta: {
    color: "#aaa",
    fontSize: 12,
    marginTop: 4,
  },
  suggestedViews: {
    color: "#aaa",
    fontSize: 12,
    marginTop: 2,
  },

  // ========== COMMENTS ==========
  commentsCard: {
    marginHorizontal: 12,
    marginTop: 20,
    backgroundColor: "#181818",
    borderRadius: 12,
    padding: 14,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginTop: 12,
  },
  commentInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    backgroundColor: "#0f0f0f",
    color: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#333",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  postBtn: {
    backgroundColor: "#3ea6ff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 70,
    alignItems: "center",
  },
  postBtnText: {
    color: "#0f0f0f",
    fontWeight: "700",
    fontSize: 13,
  },
  commentItem: {
    backgroundColor: "#0f0f0f",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  commentText: {
    color: "#fff",
    fontSize: 14,
  },
  commentMeta: {
    color: "#aaa",
    fontSize: 12,
    marginTop: 4,
  },
  emptyText: {
    color: "#aaa",
    fontSize: 13,
    marginTop: 12,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
});
