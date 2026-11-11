import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Platform,
  ActivityIndicator,
  ListRenderItem,
  Share,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Image,
} from "react-native";

import { VideoView, useVideoPlayer } from "expo-video";

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  RouteProp,
  useIsFocused,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { API_ORIGIN, API_USERVIDEO } from "../../config/api";
import {
  addSelectedShort,
  incrementShortComments,
  mergeShortsPage,
  updateShortViews,
} from "../store/videosSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { getViewSocket } from "../utils/viewSocket";
import { showToast } from "../utils/notifications";

const { height, width } = Dimensions.get("window");

/* =========================================================
   TYPES
========================================================= */

type ShortItem = {
  id: string;
  title: string;
  description?: string;
  views: number;
  likes: number;
  comments: number;
  videoUrl: string;
  thumbnail?: string;
  isLiked?: boolean;
  isSubscribed?: boolean;
  subscribersCount: number;
  channel?: any;
  channelOwnerId?: string;
  raw?: any;
};

type ShortComment = {
  _id?: string;
  id?: string;

  text?: string;
  comment?: string;
  commentText?: string;

  createdAt?: string;

  user?: {
    _id?: string;
    id?: string;
    name?: string;
    username?: string;
    image?: string;
    avatar?: string;
    profileImage?: string;
  };

  author?: {
    _id?: string;
    id?: string;
    name?: string;
    username?: string;
    image?: string;
    avatar?: string;
    profileImage?: string;
  };

  userName?: string;
  userImage?: string;
};

type ShortsRouteParams = {
  Shorts:
    | {
        video?: Record<string, any>;
      }
    | undefined;
};

type ShortsViewToken = {
  item: Record<string, any>;
  index: number | null;
  isViewable: boolean;
};

/* =========================================================
   URL HELPER
========================================================= */

const toVideoUrl = (value: unknown) => {
  if (!value) {
    return "";
  }

  const normalized = String(value).replace(/\\/g, "/");

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (normalized.startsWith("/uploads/")) {
    return `${API_ORIGIN}${normalized}`;
  }

  return `${API_ORIGIN}/${normalized.replace(/^\/+/, "")}`;
};

const getEntityId = (value: any) => {
  if (!value) return null;
  if (typeof value === "object") {
    return value._id || value.id || value.userId || value.ownerId || null;
  }
  return value;
};

const getChannelOwnerId = (item: ShortItem) => {
  const channel = item.channel || item.raw?.channel;
  return getEntityId(
    channel?.ownerId ||
      channel?.userId ||
      channel?.user ||
      channel?.owner ||
      item.channelOwnerId ||
      item.raw?.channelOwnerId ||
      item.raw?.ownerId ||
      item.raw?.userId ||
      item.raw?.creatorId ||
      item.raw?.uploadedBy,
  );
};

/* =========================================================
   NORMALIZE SHORT
========================================================= */

const normalizeShort = (video: Record<string, any> = {}): ShortItem => {
  const id = String(
    video._id || video.id || `short-${Date.now()}-${Math.random()}`,
  );

  return {
    id,

    title: video.title || video.name || "Untitled Short",
    description: String(video.description || ""),

    views: Number(video.views) || Number(video.viewCount) || 0,

    likes: Number(video.likesCount) || Number(video.likes) || 0,

    comments: Array.isArray(video.comments)
      ? video.comments.length
      : Number(video.comments) || 0,

    videoUrl: toVideoUrl(
      video.videoUrl || video.video || video.url || video.file,
    ),

    thumbnail: toVideoUrl(video.thumbnail || video.thumb || video.poster || ""),

    isLiked: video.userReaction === "like" || video.isLiked === true,
    isSubscribed: Boolean(video.isSubscribed),
    subscribersCount: Number(
      video.subscribersCount ?? video.channel?.subscribedBy?.length ?? 0,
    ),

    channel: video.channel,
    channelOwnerId:
      video.channelOwnerId ||
      video.channel?.ownerId ||
      video.channel?.userId ||
      video.channel?.user?._id ||
      video.channel?.user?.id ||
      video.ownerId ||
      video.userId ||
      video.creatorId ||
      video.uploadedBy ||
      undefined,

    raw: video,
  };
};

/* =========================================================
   PAYLOAD HELPER
========================================================= */

const getArrayFromPayload = (payload: unknown): Record<string, any>[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const data = payload as {
      videos?: unknown;
      data?: unknown;
      shorts?: unknown;
      results?: unknown;
    };

    if (Array.isArray(data.videos)) {
      return data.videos;
    }

    if (Array.isArray(data.shorts)) {
      return data.shorts;
    }

    if (Array.isArray(data.results)) {
      return data.results;
    }

    if (Array.isArray(data.data)) {
      return data.data;
    }
  }

  return [];
};

/* =========================================================
   FORMAT COUNT
========================================================= */

const formatCount = (value: number) => {
  const n = Number(value) || 0;

  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }

  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  return String(n);
};

const formatViews = (value: number) => {
  return `${formatCount(value)} views`;
};

const INITIAL_SHORTS_BATCH = 10;
const NEXT_THUMBNAIL_PREFETCH_COUNT = 4;

const fetchShortsPage = async (
  page: number,
  token: string | null,
  limit = INITIAL_SHORTS_BATCH,
) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    _: String(Date.now()),
  });
  const response = await fetch(
    `${API_USERVIDEO}/trending-shorts?${params.toString()}`,
    {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  if (!response.ok) {
    throw new Error(
      `Could not load Shorts page ${page} (HTTP ${response.status}).`,
    );
  }

  const data = await response.json();
  if (data?.success === false) {
    throw new Error(data.message || `Could not load Shorts page ${page}.`);
  }
  return data;
};

const getGuestId = async () => {
  const storageKey = "shorts_guest_id";
  const existing = await AsyncStorage.getItem(storageKey);
  if (existing) return existing;

  const guestId = `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await AsyncStorage.setItem(storageKey, guestId);
  return guestId;
};

/* =========================================================
   VIDEO COMPONENT
========================================================= */

const ShortVideo = memo(function ShortVideo({
  item,
  isActive,
  muted,
  onProgress,
}: {
  item: ShortItem;
  isActive: boolean;
  muted: boolean;
  onProgress: (
    item: ShortItem,
    currentTime: number,
    duration: number,
  ) => void;
}) {
  const navigation = useNavigation<any>();
  const [paused, setPaused] = useState(false);
  const [hasRenderedFirstFrame, setHasRenderedFirstFrame] = useState(false);

  const player = useVideoPlayer(item.videoUrl, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = muted;
    videoPlayer.bufferOptions = {
      minBufferForPlayback: 2,
      preferredForwardBufferDuration: 10,
    };
    // Critical: without this, timeUpdate never fires
    videoPlayer.timeUpdateEventInterval = 0.5;
  });

  useEffect(() => {
    setHasRenderedFirstFrame(false);
  }, [item.videoUrl]);

  useEffect(() => {
    const pauseIfActive = () => {
      if (!isActive) return;

      try {
        player.pause();
        player.muted = true;
      } catch (error) {
        console.warn("Short video pause on navigation error:", error);
      }
    };

    const removeBlurListener = navigation.addListener("blur", pauseIfActive);
    const removeBeforeRemoveListener = navigation.addListener(
      "beforeRemove",
      pauseIfActive,
    );

    return () => {
      removeBlurListener();
      removeBeforeRemoveListener();
    };
  }, [isActive, navigation, player]);

  /* -------------------------------------------------------
     PLAY / PAUSE
  ------------------------------------------------------- */
  useEffect(() => {
    try {
      if (isActive && !paused) {
        player.muted = muted;
        player.play();
      } else {
        player.pause();
        if (!isActive) player.muted = true;
      }
    } catch (error) {
      console.warn("Video play/pause error:", error);
    }
  }, [isActive, muted, paused, player, item.videoUrl]);

  useEffect(() => {
    if (!isActive) {
      setPaused(false);
    }
  }, [isActive]);

  /* -------------------------------------------------------
     VIDEO PROGRESS
  ------------------------------------------------------- */

  useEffect(() => {
    const subscription = player.addListener("timeUpdate", (event: any) => {
      const currentTime = Number(event?.currentTime) || 0;
      // duration comes from player, not from the timeUpdate event payload
      const duration = Number(player.duration) || 0;

      if (duration > 0) {
        onProgress(item, currentTime, duration);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [item, onProgress, player]);

  if (!item.videoUrl) {
    return (
      <View style={styles.videoError}>
        <Ionicons name="videocam-off-outline" size={50} color="#777" />
        <Text style={styles.videoErrorText}>Video unavailable</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={styles.videoTapArea}
      onPress={() => {
        if (!isActive) return;
        setPaused((previous) => !previous);
      }}
    >
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        surfaceType="textureView"
        nativeControls={false}
        onFirstFrameRender={() => setHasRenderedFirstFrame(true)}
      />
      {!hasRenderedFirstFrame && item.thumbnail ? (
        <Image
          source={{ uri: item.thumbnail }}
          style={styles.video}
          resizeMode="contain"
          pointerEvents="none"
        />
      ) : null}
      {!hasRenderedFirstFrame ? (
        <View style={styles.videoLoading} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : null}
      {isActive && paused && (
        <TouchableOpacity
          activeOpacity={0.85}
          hitSlop={12}
          style={styles.playPauseIndicator}
          onPress={(event) => {
            event.stopPropagation();
            setPaused(false);
          }}
        >
          <Ionicons name="play" size={34} color="#fff" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
});

/* =========================================================
   COMMENT AVATAR
========================================================= */

function CommentAvatar({ comment }: { comment: ShortComment }) {
  const image =
    comment.user?.image ||
    comment.user?.avatar ||
    comment.user?.profileImage ||
    comment.author?.image ||
    comment.author?.avatar ||
    comment.author?.profileImage ||
    comment.userImage;

  if (image) {
    return (
      <Image
        source={{
          uri: toVideoUrl(image),
        }}
        style={styles.commentAvatarImage}
      />
    );
  }

  return (
    <View style={styles.commentAvatar}>
      <Ionicons name="person" size={17} color="#fff" />
    </View>
  );
}

/* =========================================================
   MAIN SCREEN
========================================================= */

export default function ShortsScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const route = useRoute<RouteProp<ShortsRouteParams, "Shorts">>();
  const isFocused = useIsFocused();

  const selectedVideo = route?.params?.video;
  const shortsData = useAppSelector((state) => state.appVideos.shorts);
  const shortsPage = useAppSelector((state) => state.appVideos.shortsPage);
  const hasMore = useAppSelector((state) => state.appVideos.shortsHasMore);
  const [pageHeight, setPageHeight] = useState(height);

  const [detailsItem, setDetailsItem] = useState<ShortItem | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);

  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const [likeCount, setLikeCount] = useState<Record<string, number>>({});
  const [subscribed, setSubscribed] = useState<Record<string, boolean>>({});
  const [subscriberCount, setSubscriberCount] = useState<
    Record<string, number>
  >({});

  const [muted, setMuted] = useState(true);

  const [loading, setLoading] = useState(
    !selectedVideo && shortsData.length === 0,
  );
  const [loadingMore, setLoadingMore] = useState(false);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserLoaded, setCurrentUserLoaded] = useState(false);

  /* COMMENTS */

  const [comments, setComments] = useState<ShortComment[]>([]);

  const [commentsVisible, setCommentsVisible] = useState(false);

  const [commentsLoading, setCommentsLoading] = useState(false);

  const [commentText, setCommentText] = useState("");

  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const [commentForVideo, setCommentForVideo] = useState<ShortItem | null>(
    null,
  );

  const viewReportedRef = useRef<Record<string, number>>({});
  const historyReportedRef = useRef<Record<string, boolean>>({});

  const listRef = useRef<FlatList<ShortItem>>(null);
  const loadRequestRef = useRef(0);
  const initialLoadStarted = useRef(false);
  const inFlightPageRef = useRef<number | null>(null);
  const shortsPageRef = useRef(shortsPage);
  const hasMoreRef = useRef(hasMore);
  shortsPageRef.current = shortsPage;
  hasMoreRef.current = hasMore;

  useEffect(() => {
    if (!selectedVideo) return;
    const selected = normalizeShort({
      ...(selectedVideo.raw || {}),
      ...selectedVideo,
    });
    dispatch(addSelectedShort(selected));
    setCurrentIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    setLoading(false);
  }, [dispatch, selectedVideo]);

  useEffect(() => {
    setLiked((previous) => {
      const next = { ...previous };
      shortsData.forEach((item: ShortItem) => {
        if (next[item.id] === undefined) next[item.id] = Boolean(item.isLiked);
      });
      return next;
    });
    setLikeCount((previous) => {
      const next = { ...previous };
      shortsData.forEach((item: ShortItem) => {
        if (next[item.id] === undefined) next[item.id] = item.likes;
      });
      return next;
    });
    setSubscribed((previous) => {
      const next = { ...previous };
      shortsData.forEach((item: ShortItem) => {
        if (next[item.id] === undefined)
          next[item.id] = Boolean(item.isSubscribed);
      });
      return next;
    });
    setSubscriberCount((previous) => {
      const next = { ...previous };
      shortsData.forEach((item: ShortItem) => {
        if (next[item.id] === undefined)
          next[item.id] = item.subscribersCount;
      });
      return next;
    });
  }, [shortsData]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem("user")
      .then((storedUser) => {
        if (!active || !storedUser) return;
        const user = JSON.parse(storedUser);
        setCurrentUserId(getEntityId(user));
      })
      .catch((error) => {
        console.warn("Current user lookup error:", error);
      })
      .finally(() => {
        if (active) setCurrentUserLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const normalizeVideoBatch = useCallback(
    (videos: Record<string, any>[]) => {
      let normalized = videos.map(normalizeShort);

      if (selectedVideo) {
        const selected = normalizeShort({
          ...(selectedVideo.raw || {}),
          ...selectedVideo,
        });
        normalized = [
          selected,
          ...normalized.filter((item) => item.id !== selected.id),
        ];
      }

      return normalized;
    },
    [selectedVideo],
  );

  const loadShorts = useCallback(
    async (reset = false) => {
      if (inFlightPageRef.current !== null || (!reset && !hasMoreRef.current)) {
        return;
      }

      const requestId = ++loadRequestRef.current;
      const targetPage = reset ? 1 : shortsPageRef.current + 1;
      inFlightPageRef.current = targetPage;

      try {
        if (reset) {
          setLoading(!selectedVideo);
        } else {
          setLoadingMore(true);
        }

        const token = await AsyncStorage.getItem("token");
        if (requestId !== loadRequestRef.current) return;

        const response = await fetch(
          `${API_USERVIDEO}/trending-shorts?page=${targetPage}&limit=${INITIAL_SHORTS_BATCH}&_=${Date.now()}`,
          {
            cache: "no-store",
            headers: token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {},
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json().catch(() => ({}));
        if (requestId !== loadRequestRef.current) return;
        if (data?.success === false) {
          throw new Error(data.message || "Could not load Shorts.");
        }

        const videos = getArrayFromPayload(data);
        const nextBatch = normalizeVideoBatch(videos);

        if (!nextBatch.length) {
          shortsPageRef.current = targetPage;
          hasMoreRef.current = false;
          dispatch(
            mergeShortsPage({
              videos: [],
              page: targetPage,
              reset,
              hasMore: false,
            }),
          );
          return;
        }

        const total = Number(data?.total);
        const hasMoreResults =
          Number.isFinite(total) && total > 0
            ? targetPage * INITIAL_SHORTS_BATCH < total
            : videos.length === INITIAL_SHORTS_BATCH;
        shortsPageRef.current = targetPage;
        hasMoreRef.current = hasMoreResults;
        void Promise.all(
          nextBatch
            .slice(0, NEXT_THUMBNAIL_PREFETCH_COUNT)
            .map((item) =>
              item.thumbnail
                ? Image.prefetch(item.thumbnail).catch(() => false)
                : Promise.resolve(false),
            ),
        );
        dispatch(
          mergeShortsPage({
            videos: nextBatch,
            page: targetPage,
            reset,
            hasMore: hasMoreResults,
          }),
        );

        setLiked((previous) => ({
          ...previous,
          ...Object.fromEntries(
            nextBatch.map((item) => [item.id, Boolean(item.isLiked)]),
          ),
        }));
        setLikeCount((previous) => ({
          ...previous,
          ...Object.fromEntries(nextBatch.map((item) => [item.id, item.likes])),
        }));
        setSubscribed((previous) => ({
          ...previous,
          ...Object.fromEntries(
            nextBatch.map((item) => [item.id, Boolean(item.isSubscribed)]),
          ),
        }));
        setSubscriberCount((previous) => ({
          ...previous,
          ...Object.fromEntries(
            nextBatch.map((item) => [item.id, item.subscribersCount]),
          ),
        }));

        if (reset) {
          setCurrentIndex(0);
          setLoading(false);
        }
      } catch (error) {
        console.warn("Shorts load error:", error);

        showToast(
          "error",
          "Shorts could not fully load",
          error instanceof Error ? error.message : "Please try again.",
        );
      } finally {
        if (requestId === loadRequestRef.current) {
          inFlightPageRef.current = null;
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [dispatch, normalizeVideoBatch, selectedVideo],
  );

  useEffect(() => {
    if (
      !initialLoadStarted.current &&
      !shortsData.length &&
      !selectedVideo
    ) {
      initialLoadStarted.current = true;
      loadShorts(true);
    }
    return () => {
      loadRequestRef.current += 1;
    };
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (inFlightPageRef.current !== null || !hasMoreRef.current) {
      return;
    }

    await loadShorts(false);
  }, [loadShorts]);

  useEffect(() => {
    const item = shortsData[currentIndex];
    if (!item || historyReportedRef.current[item.id]) return;

    AsyncStorage.getItem("token").then((token) => {
      if (!token || historyReportedRef.current[item.id]) return;
      historyReportedRef.current[item.id] = true;
      fetch(`${API_USERVIDEO}/history/${item.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch((error) => {
        historyReportedRef.current[item.id] = false;
        console.warn("Short history save error:", error);
      });
    });
  }, [currentIndex, shortsData]);

  useEffect(() => {
    let active = true;
    let currentSocket;
    let viewHandler;

    getViewSocket().then((socket) => {
      if (!active || !socket) return;
      currentSocket = socket;
      const handleViewCountUpdated = ({ videoId, views }) => {
        dispatch(updateShortViews({ id: videoId, views }));
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
  }, [dispatch]);

  /* =======================================================
     VIEWABILITY
  ======================================================= */

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ShortsViewToken[] }) => {
      const visible = viewableItems.find(
        (item) => item.isViewable && item.index != null,
      );

      if (visible && visible.index != null) {
        setCurrentIndex(visible.index);

        if (visible.index === shortsData.length - 1) {
          handleLoadMore();
        }
      }
    },
    [handleLoadMore, shortsData.length],
  );

  const handleMomentumScrollEnd = useCallback(
    (event: {
      nativeEvent: { contentOffset: { y: number } };
    }) => {
      const nextIndex = Math.max(
        0,
        Math.min(
          shortsData.length - 1,
          Math.round(event.nativeEvent.contentOffset.y / pageHeight),
        ),
      );
      setCurrentIndex(nextIndex);
      if (nextIndex === shortsData.length - 1) {
        handleLoadMore();
      }
    },
    [handleLoadMore, pageHeight, shortsData.length],
  );

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 80,
    }),
    [],
  );

  /* =======================================================
     LIKE
  ======================================================= */

  const toggleLike = async (item: ShortItem) => {
    const token = await AsyncStorage.getItem("token");

    if (!token) {
      navigation.navigate("Login");
      return;
    }

    if (loadingAction === `like-${item.id}`) {
      return;
    }

    const previous = Boolean(liked[item.id]);

    const previousCount = likeCount[item.id] ?? item.likes;

    const optimistic = !previous;

    setLiked((prev) => ({
      ...prev,
      [item.id]: optimistic,
    }));

    setLikeCount((prev) => ({
      ...prev,
      [item.id]: Math.max(0, previousCount + (optimistic ? 1 : -1)),
    }));

    setLoadingAction(`like-${item.id}`);

    try {
      const response = await fetch(`${API_USERVIDEO}/${item.id}/like`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Like failed");
      }

      if (typeof data.likes === "number") {
        setLikeCount((prev) => ({
          ...prev,
          [item.id]: data.likes,
        }));
      }

      if (typeof data.liked === "boolean") {
        setLiked((prev) => ({
          ...prev,
          [item.id]: data.liked,
        }));
      }
    } catch (error) {
      console.warn("Like error:", error);

      setLiked((prev) => ({
        ...prev,
        [item.id]: previous,
      }));

      setLikeCount((prev) => ({
        ...prev,
        [item.id]: previousCount,
      }));

      showToast("error", "Error", "Unable to update like.");
    } finally {
      setLoadingAction(null);
    }
  };

  /* =======================================================
     VIEW TRACKING
  ======================================================= */

  const trackView = useCallback(
    async (item: ShortItem, currentTime: number, duration: number) => {
      if (!duration || duration <= 0 || !item.id) {
        return;
      }

      const percent = Math.min(100, Math.round((currentTime / duration) * 100));

      const previous = viewReportedRef.current[item.id] || 0;

      let checkpoint = 0;

      if (percent >= 80 && previous < 80) {
        checkpoint = 80;
      } else if (percent >= 25 && previous < 25) {
        checkpoint = 25;
      } else if (percent >= 1 && previous < 1) {
        checkpoint = 1;
      }

      if (!checkpoint) {
        return;
      }

      viewReportedRef.current[item.id] = checkpoint;

      try {
        const token = await AsyncStorage.getItem("token");
        const guestId = token ? null : await getGuestId();

        const response = await fetch(`${API_USERVIDEO}/${item.id}/view`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
          body: JSON.stringify({
            watchedPercent: checkpoint,
            duration,
            watchSeconds: currentTime,
            guestId,
          }),
        });

        const data = await response.json();

        if (data.success && typeof data.views === "number") {
          dispatch(updateShortViews({ id: item.id, views: data.views }));
        } else {
          // allow retry if backend rejected
          viewReportedRef.current[item.id] = previous;
        }
      } catch (error) {
        viewReportedRef.current[item.id] = previous;
        console.warn("View tracking error:", error);
      }
    },
    [dispatch],
  );

  /* =======================================================
     SHARE
  ======================================================= */

  const handleShare = async (item: ShortItem) => {
    try {
      const shareUrl = `vidbuxapp://shorts/${item.id}`;

      await Share.share({
        title: item.title || "VidBuxApp Short",

        message: `${item.title || "Watch this short"}\n\n${shareUrl}`,
      });
    } catch (error) {
      console.warn("Share error:", error);
    }
  };

  const handleCopyright = (item: ShortItem) => {
    Alert.alert(
      "Copyright",
      "Do you want to report a copyright issue for this short?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report copyright",
          onPress: () =>
            navigation.navigate("CopyrightClaim", {
              videoId: item.id,
              title: item.title,
            }),
        },
      ],
    );
  };

  /* =======================================================
     GET CHANNEL ID
  ======================================================= */

  const getChannelId = (item: ShortItem) => {
    const channel = item.channel || item.raw?.channel;

    if (!channel) {
      return item.raw?.channelId || item.raw?.channel_id || null;
    }

    if (typeof channel === "string") {
      return channel;
    }

    return channel._id || channel.id || channel.channelId || null;
  };

  /* =======================================================
     SUBSCRIBE
  ======================================================= */

  const handleSubscribe = async (item: ShortItem) => {
    if (
      currentUserId &&
      String(currentUserId) === String(getChannelOwnerId(item))
    ) {
      return;
    }

    const token = await AsyncStorage.getItem("token");

    if (!token) {
      navigation.navigate("Login");
      return;
    }

    const channelId = getChannelId(item);

    if (!channelId) {
      showToast("error", "Error", "Channel not found.");

      return;
    }

    try {
      setLoadingAction(`subscribe-${item.id}`);
      const response = await fetch(`${API_USERVIDEO}/subscribe/${channelId}`, {
        method: "POST",

        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSubscribed((previous) => ({
          ...previous,
          [item.id]: Boolean(data.subscribed),
        }));
        setSubscriberCount((previous) => ({
          ...previous,
          [item.id]: Number(data.subscribersCount) || 0,
        }));
      } else {
        showToast("error", "Error", data.message || "Failed to subscribe");
      }
    } catch (error) {
      console.warn("Subscribe error:", error);

      showToast("error", "Error", "Something went wrong.");
    } finally {
      setLoadingAction(null);
    }
  };

  /* =======================================================
     LOAD COMMENTS
  ======================================================= */

  const loadComments = async (item: ShortItem) => {
    setCommentForVideo(item);
    setCommentsVisible(true);
    setCommentsLoading(true);

    try {
      const token = await AsyncStorage.getItem("token");

      const response = await fetch(`${API_USERVIDEO}/${item.id}/comments`, {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      });

      const data = await response.json().catch(() => ({}));

      const list = Array.isArray(data?.comments)
        ? data.comments
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];

      setComments(list);
    } catch (error) {
      console.warn("Comments load error:", error);

      setComments([]);

      showToast("error", "Error", "Unable to load comments.");
    } finally {
      setCommentsLoading(false);
    }
  };

  /* =======================================================
     CLOSE COMMENTS
  ======================================================= */

  const closeComments = () => {
    setCommentsVisible(false);
    setCommentText("");
    setCommentForVideo(null);
  };

  /* =======================================================
     SUBMIT COMMENT
  ======================================================= */

  const handleCommentSubmit = async () => {
    const text = commentText.trim();

    const item = commentForVideo || shortsData[currentIndex];

    if (!text || !item || commentSubmitting) {
      return;
    }

    const token = await AsyncStorage.getItem("token");

    if (!token) {
      navigation.navigate("Login");
      return;
    }

    setCommentSubmitting(true);

    try {
      const rawUser = await AsyncStorage.getItem("user");

      let user: any = null;

      try {
        user = rawUser ? JSON.parse(rawUser) : null;
      } catch {}

      const userName = user?.name || user?.username || user?.fullName || "User";

      const userImage = user?.image || user?.avatar || user?.profileImage || "";

      const response = await fetch(`${API_USERVIDEO}/${item.id}/comment`, {
        method: "POST",

        headers: {
          Authorization: `Bearer ${token}`,

          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          commentText: text,

          userName,

          userImage,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to post comment");
      }

      /* ---------------------------------------------
           NEW COMMENT
        --------------------------------------------- */

      const newComment: ShortComment = {
        _id: data?.comment?._id || data?.data?._id || String(Date.now()),

        text,

        commentText: text,

        createdAt: new Date().toISOString(),

        user: {
          name: userName,
          username: user?.username,
          image: userImage,
        },
      };

      setComments((previous) => [newComment, ...previous]);

      setCommentText("");

      /* ---------------------------------------------
           UPDATE COMMENT COUNT
        --------------------------------------------- */

      dispatch(incrementShortComments(item.id));
    } catch (error: any) {
      console.warn("Comment submit error:", error);

      showToast(
        "error",
        "Comment Failed",
        error?.message || "Please try again.",
      );
    } finally {
      setCommentSubmitting(false);
    }
  };

  /* =======================================================
     COMMENT USERNAME
  ======================================================= */

  const getCommentUsername = (comment: ShortComment) => {
    return (
      comment.user?.name ||
      comment.user?.username ||
      comment.author?.name ||
      comment.author?.username ||
      comment.userName ||
      "User"
    );
  };

  /* =======================================================
     COMMENT TEXT
  ======================================================= */

  const getCommentText = (comment: ShortComment) => {
    return comment.text || comment.commentText || comment.comment || "";
  };

  /* =======================================================
     RENDER COMMENT
  ======================================================= */

  const renderComment = ({ item: comment }: { item: ShortComment }) => {
    return (
      <View style={styles.commentItem}>
        <CommentAvatar comment={comment} />

        <View style={styles.commentBody}>
          <Text style={styles.commentAuthor}>
            {getCommentUsername(comment)}
          </Text>

          <Text style={styles.commentValue}>{getCommentText(comment)}</Text>

          <View style={styles.commentMeta}>
            <TouchableOpacity>
              <Text style={styles.commentReply}>Reply</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.commentLikeButton}>
              <Ionicons name="heart-outline" size={17} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  /* =======================================================
     RENDER VIDEO ITEM
  ======================================================= */

  const renderItem: ListRenderItem<ShortItem> = useCallback(
    ({ item, index }) => {
      const isActive = index === currentIndex;
      const shouldPreload =
        isFocused && (isActive || index === currentIndex + 1);

      const currentLikes = likeCount[item.id] ?? item.likes;
      const channelId = getChannelId(item);
      const channelName =
        item.channel?.name || item.raw?.channel?.name || "VidBuxApp";
      const isOwnChannel =
        currentUserId != null &&
        String(currentUserId) === String(getChannelOwnerId(item));

      return (
        <View style={[styles.videoContainer, { height: pageHeight }]}>
          {/* VIDEO */}

          {shouldPreload ? (
            <ShortVideo
              item={item}
              isActive={isActive}
              muted={muted}
              onProgress={trackView}
            />
          ) : item.thumbnail ? (
            <Image
              source={{ uri: item.thumbnail }}
              style={styles.video}
              resizeMode="contain"
            />
          ) : null}

          {/* DARK OVERLAY */}

          <View pointerEvents="none" style={styles.overlay} />

          {/* TOP BAR */}

          <View style={styles.topBar}>
            <Text style={styles.shortsHeader}>Shorts</Text>

            <TouchableOpacity
              style={styles.topIcon}
              onPress={() => handleCopyright(item)}
            >
              <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* BOTTOM LEFT */}

          <View style={styles.bottomLeft}>
            {/* CHANNEL */}

            <View style={styles.channelRow}>
              <TouchableOpacity
                style={styles.channelLink}
                disabled={!channelId}
                onPress={() => {
                  if (channelId) {
                    navigation.navigate("SubscribedChannels", {
                      id: channelId,
                    });
                  }
                }}
                accessibilityRole="link"
                accessibilityLabel={`Open ${channelName} channel`}
              >
                <View style={styles.channelAvatar}>
                  <Ionicons name="person" size={18} color="#fff" />
                </View>
                <Text style={styles.channelName} numberOfLines={1}>
                  {channelName}
                </Text>
              </TouchableOpacity>

              {channelId && currentUserLoaded && !isOwnChannel && (
                <TouchableOpacity
                  style={styles.subscribeBtn}
                  onPress={() => handleSubscribe(item)}
                  disabled={loadingAction === `subscribe-${item.id}`}
                >
                  <Text style={styles.subscribeText}>
                    {loadingAction === `subscribe-${item.id}`
                      ? "..."
                      : subscribed[item.id]
                        ? "Unsubscribe"
                        : "Subscribe"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.subscriberCount}>
              {formatCount(subscriberCount[item.id] ?? item.subscribersCount)}{" "}
              subscribers
            </Text>

            {/* TITLE */}

            <TouchableOpacity
              onPress={() => setDetailsItem(item)}
              accessibilityRole="button"
              accessibilityLabel={`Show details for ${item.title}`}
            >
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
            </TouchableOpacity>

            {/* VIEWS */}

            <Text style={styles.views}>{formatViews(item.views)}</Text>

            {/* AUDIO */}

            <View style={styles.audioRow}>
              <MaterialCommunityIcons
                name="music-note"
                size={16}
                color="#fff"
              />

              <Text style={styles.audioText}>Original Audio</Text>
            </View>
          </View>

          {/* RIGHT ACTIONS */}

          <View style={styles.rightButtons}>
            {/* LIKE */}

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => toggleLike(item)}
            >
              <Ionicons
                name={liked[item.id] ? "heart" : "heart-outline"}
                size={34}
                color={liked[item.id] ? "#ff2d55" : "#fff"}
              />

              <Text style={styles.iconText}>{formatCount(currentLikes)}</Text>
            </TouchableOpacity>

            {/* COMMENTS */}

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => loadComments(item)}
            >
              <Ionicons name="chatbubble-outline" size={31} color="#fff" />

              <Text style={styles.iconText}>{formatCount(item.comments)}</Text>
            </TouchableOpacity>

            {/* SHARE */}

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => handleShare(item)}
            >
              <Ionicons name="share-social-outline" size={32} color="#fff" />

              <Text style={styles.iconText}>Share</Text>
            </TouchableOpacity>

            {/* MUTE */}

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setMuted((prev) => !prev)}
            >
              <Ionicons
                name={muted ? "volume-mute" : "volume-high"}
                size={31}
                color="#fff"
              />
            </TouchableOpacity>

            {/* MORE */}

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => handleCopyright(item)}
            >
              <Ionicons name="ellipsis-horizontal" size={30} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* PROGRESS */}

          {isActive && <View style={styles.progressIndicator} />}
        </View>
      );
    },
    [
      currentIndex,
      currentUserId,
      currentUserLoaded,
      handleCopyright,
      handleShare,
      handleSubscribe,
      isFocused,
      liked,
      loadingAction,
      likeCount,
      loadComments,
      muted,
      navigation,
      pageHeight,
      subscribed,
      subscriberCount,
      toggleLike,
      trackView,
    ],
  );

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        <ActivityIndicator size="large" color="#fff" />

        <Text style={styles.loadingText}>Loading shorts...</Text>
      </View>
    );
  }

  /* =======================================================
     EMPTY
  ======================================================= */

  if (!shortsData.length) {
    return (
      <View style={styles.loaderWrap}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        <Ionicons name="videocam-off-outline" size={50} color="#777" />

        <Text style={styles.emptyText}>No shorts available yet.</Text>
      </View>
    );
  }

  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        const nextHeight = Math.round(event.nativeEvent.layout.height);
        if (nextHeight > 0 && nextHeight !== pageHeight) {
          setPageHeight(nextHeight);
        }
      }}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000"
        translucent={false}
      />

      <FlatList
        ref={listRef}
        data={shortsData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={pageHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews
        maxToRenderPerBatch={2}
        windowSize={6}
        initialNumToRender={2}
        getItemLayout={(_, index) => ({
          length: pageHeight,
          offset: pageHeight * index,
          index,
        })}
      />

      {loadingMore ? (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingMoreText}>Loading more Shorts...</Text>
        </View>
      ) : null}

      <Modal
        visible={Boolean(detailsItem)}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsItem(null)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.commentsBackdrop}
            onPress={() => setDetailsItem(null)}
            accessibilityLabel="Close video details"
          />
          {detailsItem ? (
            <View style={styles.detailsSheet}>
              <View style={styles.commentsHandle} />
              <View style={styles.detailsHeader}>
                <Text style={styles.detailsHeading}>Description</Text>
                <TouchableOpacity
                  onPress={() => setDetailsItem(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Close description"
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={25} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.detailsContent}
              >
                <Text style={styles.detailsTitle}>{detailsItem.title}</Text>
                <View style={styles.detailsStats}>
                  <Text style={styles.detailsStat}>
                    {formatCount(
                      likeCount[detailsItem.id] ?? detailsItem.likes,
                    )}{" "}
                    likes
                  </Text>
                  <Text style={styles.detailsStat}>
                    {formatViews(detailsItem.views)}
                  </Text>
                  {detailsItem.raw?.createdAt ? (
                    <Text style={styles.detailsStat}>
                      {new Date(detailsItem.raw.createdAt).toLocaleDateString()}
                    </Text>
                  ) : null}
                </View>
                {getChannelId(detailsItem) ? (
                  <TouchableOpacity
                    onPress={() => {
                      const channelId = getChannelId(detailsItem);
                      setDetailsItem(null);
                      if (channelId) {
                        navigation.navigate("SubscribedChannels", {
                          id: channelId,
                        });
                      }
                    }}
                    accessibilityRole="link"
                    style={styles.detailsChannelLink}
                  >
                    <Text style={styles.detailsChannelName}>
                      {detailsItem.channel?.name ||
                        detailsItem.raw?.channel?.name ||
                        "VidBuxApp"}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <Text style={styles.detailsDescription}>
                  {detailsItem.description?.trim() ||
                    "No description available."}
                </Text>
                {Array.isArray(detailsItem.raw?.hashtags) &&
                detailsItem.raw.hashtags.length > 0 ? (
                  <View style={styles.detailsHashtags}>
                    {detailsItem.raw.hashtags.map(
                      (tag: string, index: number) => (
                        <Text
                          key={`${tag}-${index}`}
                          style={styles.detailsHashtag}
                        >
                          #{tag}
                        </Text>
                      ),
                    )}
                  </View>
                ) : null}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* =================================================
          YOUTUBE STYLE COMMENTS BOTTOM SHEET
      ================================================= */}

      <Modal
        visible={commentsVisible}
        transparent
        animationType="slide"
        onRequestClose={closeComments}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* BACKDROP */}

          <TouchableOpacity
            activeOpacity={1}
            style={styles.commentsBackdrop}
            onPress={closeComments}
          />

          {/* SHEET */}

          <View style={styles.commentsSheet}>
            {/* HANDLE */}

            <View style={styles.commentsHandle} />

            {/* HEADER */}

            <View style={styles.commentsHeader}>
              <Text style={styles.commentsTitle}>
                Comments {comments.length > 0 ? `(${comments.length})` : ""}
              </Text>

              <TouchableOpacity
                onPress={closeComments}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={25} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* COMMENTS */}

            {commentsLoading ? (
              <View style={styles.commentsState}>
                <ActivityIndicator size="large" color="#fff" />

                <Text style={styles.commentsStateText}>
                  Loading comments...
                </Text>
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.commentsState}>
                <View style={styles.emptyCommentIcon}>
                  <Ionicons name="chatbubble-outline" size={34} color="#fff" />
                </View>

                <Text style={styles.noCommentsTitle}>No comments yet</Text>

                <Text style={styles.noCommentsSubtitle}>
                  Be the first to comment
                </Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(comment, index) =>
                  String(comment._id || comment.id || index)
                }
                renderItem={renderComment}
                style={styles.commentsList}
                contentContainerStyle={styles.commentsContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            )}

            {/* INPUT */}

            <View style={styles.commentInputContainer}>
              <View style={styles.inputAvatar}>
                <Ionicons name="person" size={17} color="#fff" />
              </View>

              <View style={styles.commentInputWrapper}>
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Add a comment..."
                  placeholderTextColor="#94a3b8"
                  style={styles.commentInput}
                  multiline
                  maxLength={500}
                  returnKeyType="default"
                />

                {commentText.trim().length > 0 && (
                  <Text style={styles.characterCount}>
                    {commentText.length}
                    /500
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.commentSend,
                  (!commentText.trim() || commentSubmitting) &&
                    styles.commentSendDisabled,
                ]}
                onPress={handleCommentSubmit}
                disabled={!commentText.trim() || commentSubmitting}
              >
                {commentSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={19} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  loaderWrap: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    color: "#aaa",
    marginTop: 12,
    fontSize: 14,
  },

  emptyText: {
    color: "#aaa",
    marginTop: 15,
    fontSize: 15,
  },

  /* VIDEO */

  videoContainer: {
    width,
    height,
    backgroundColor: "#000",
    position: "relative",
  },

  video: {
    ...StyleSheet.absoluteFill,
  },

  videoLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },

  videoTapArea: {
    ...StyleSheet.absoluteFill,
  },

  playPauseIndicator: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 64,
    height: 64,
    marginLeft: -32,
    marginTop: -32,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  videoError: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },

  videoErrorText: {
    color: "#aaa",
    marginTop: 10,
    fontSize: 14,
  },

  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.16)",
  },

  /* TOP */

  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 55 : 25,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  shortsHeader: {
    color: "#fff",
    fontSize: 21,
    fontWeight: "800",
  },

  topIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  /* BOTTOM */

  bottomLeft: {
    position: "absolute",
    left: 16,
    right: 82,
    bottom: Platform.OS === "ios" ? 110 : 80,
  },

  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  channelLink: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },

  channelAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  channelName: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  subscribeBtn: {
    marginLeft: 10,
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  subscribeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  title: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 5,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: {
      width: 1,
      height: 1,
    },
    textShadowRadius: 3,
  },

  views: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    marginBottom: 8,
  },

  subscriberCount: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    marginBottom: 8,
  },

  audioRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  audioText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    marginLeft: 6,
  },

  /* RIGHT BUTTONS */

  rightButtons: {
    position: "absolute",
    right: 10,
    bottom: Platform.OS === "ios" ? 115 : 85,
    alignItems: "center",
  },

  iconBtn: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 52,
    marginBottom: 20,
  },

  iconText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: {
      width: 1,
      height: 1,
    },
    textShadowRadius: 2,
  },

  progressIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.8)",
  },

  loadingMore: {
    position: "absolute",
    top: Platform.OS === "ios" ? 104 : 74,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.65)",
  },

  loadingMoreText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  /* =====================================================
       COMMENTS MODAL
    ===================================================== */

  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },

  commentsBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  commentsSheet: {
    height: Platform.OS === "ios" ? height * 0.72 : height * 0.75,

    backgroundColor: "#111318",

    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,

    overflow: "hidden",
  },

  detailsSheet: {
    height: Platform.OS === "ios" ? height * 0.55 : height * 0.58,
    backgroundColor: "#111318",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },

  detailsHeader: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 18,
    paddingRight: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#262b35",
  },

  detailsHeading: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },

  detailsContent: {
    padding: 18,
    paddingBottom: 32,
  },

  detailsTitle: {
    color: "#fff",
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "700",
  },

  detailsStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 14,
    rowGap: 8,
    marginTop: 13,
  },

  detailsStat: {
    color: "#b8c0cc",
    fontSize: 13,
  },

  detailsChannelLink: {
    alignSelf: "flex-start",
    marginTop: 16,
  },

  detailsChannelName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  detailsDescription: {
    color: "#e5e7eb",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
  },

  detailsHashtags: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 10,
    rowGap: 6,
    marginTop: 14,
  },

  detailsHashtag: {
    color: "#7dd3fc",
    fontSize: 14,
    fontWeight: "600",
  },

  commentsHandle: {
    width: 42,
    height: 4,
    borderRadius: 10,
    backgroundColor: "#64748b",

    alignSelf: "center",
    marginTop: 9,
    marginBottom: 4,
  },

  commentsHeader: {
    height: 55,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    paddingHorizontal: 18,

    borderBottomWidth: 1,
    borderBottomColor: "#262b35",
  },

  commentsTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },

  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  commentsList: {
    flex: 1,
  },

  commentsContent: {
    paddingTop: 10,
    paddingBottom: 20,
  },

  /* COMMENT */

  commentItem: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },

  commentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#334155",

    alignItems: "center",
    justifyContent: "center",

    marginRight: 11,
  },

  commentAvatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#334155",
    marginRight: 11,
  },

  commentBody: {
    flex: 1,
  },

  commentAuthor: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },

  commentValue: {
    color: "#f8fafc",
    fontSize: 14,
    lineHeight: 20,
  },

  commentMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },

  commentReply: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },

  commentLikeButton: {
    marginLeft: 18,
  },

  /* EMPTY COMMENTS */

  commentsState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 30,
  },

  commentsStateText: {
    color: "#94a3b8",
    marginTop: 12,
    fontSize: 14,
  },

  emptyCommentIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#262b35",
    alignItems: "center",
    justifyContent: "center",
  },

  noCommentsTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 16,
  },

  noCommentsSubtitle: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 5,
  },

  /* INPUT */

  commentInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",

    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,

    backgroundColor: "#151820",

    borderTopWidth: 1,
    borderTopColor: "#262b35",
  },

  inputAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#334155",

    alignItems: "center",
    justifyContent: "center",

    marginRight: 8,
    marginBottom: 2,
  },

  commentInputWrapper: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,

    backgroundColor: "#222733",

    borderRadius: 21,

    paddingLeft: 15,
    paddingRight: 10,

    justifyContent: "center",
  },

  commentInput: {
    color: "#fff",
    fontSize: 14,
    minHeight: 42,
    maxHeight: 85,
    paddingVertical: 10,
    paddingRight: 25,
  },

  characterCount: {
    position: "absolute",
    right: 10,
    bottom: 4,
    color: "#64748b",
    fontSize: 9,
  },

  commentSend: {
    width: 42,
    height: 42,
    borderRadius: 21,

    backgroundColor: "#ff2d55",

    alignItems: "center",
    justifyContent: "center",

    marginLeft: 8,
    marginBottom: 1,
  },

  commentSendDisabled: {
    backgroundColor: "#3b404b",
  },
});
