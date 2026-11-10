import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  FlatList,
} from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { VideoView, useVideoPlayer } from "expo-video";
import { BadgeCheck, ChevronRight } from "lucide-react-native";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Navbar from "./Navbar";
import TopicChips from "./TopicChips";
import { getViewSocket } from "../utils/viewSocket";
import { API_ORIGIN } from "../../config/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SHORT_GAP = 10;
const SHORT_WIDTH = (SCREEN_WIDTH - 32 - SHORT_GAP) / 2;
const SHORT_HEIGHT = SHORT_WIDTH * (16 / 9);

const BACKEND_URL = API_ORIGIN;
const API_BASE = `${BACKEND_URL}/api/uservideo`;
const LIMIT = 5;

const hasMorePages = (
  payload: any,
  page: number,
  limit: number,
  count: number,
) => {
  if (typeof payload?.hasMore === "boolean") return payload.hasMore;
  const total = Number(payload?.total ?? payload?.pagination?.total);
  if (Number.isFinite(total)) return total > page * limit;
  return count >= limit;
};

function AutoplayPreview({ uri, style }: { uri: string; style: any }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={style}
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
    />
  );
}

const toMediaUrl = (value: any, fallback: string) => {
  if (!value) return fallback;
  const path = String(value).replace(/\\/g, "/");
  if (/^https?:\/\//i.test(path)) return path;
  return `${BACKEND_URL.replace(/\/$/, "")}/${path.replace(/^\/+/, "")}`;
};

const normalizeVideo = (video: any = {}) => ({
  id: video._id || video.id,
  title: video.title || "Untitled video",
  thumb: toMediaUrl(
    video.thumbnail,
    "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&h=225&fit=crop"
  ),
  thumbnail: toMediaUrl(
    video.thumbnail,
    "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&h=225&fit=crop"
  ),
  views: Number(video.views ?? video.viewCount ?? 0),
  videoUrl: toMediaUrl(video.videoUrl, ""),
  videoType: video.videoType || null,
  channel: video.channel || null,
  createdAt: video.createdAt || null,
  duration: video.duration ?? video.durationSeconds,
  uploadDate: video.uploadDate || video.createdAt || null,
  watchedPercent: Number(video.watchedPercent || 0),
  raw: video,
});

const normalizeShort = (video: any = {}) => ({
  ...normalizeVideo(video),
  isShort: true,
  videoType: "short",
});

const normalizeChannel = (channel: any = {}) => ({
  id: channel._id || channel.id || channel.channelId,
  title: channel.name || channel.channelName || "Subscribed Channel",
  thumb:
    channel.channelImage ||
    channel.avatar ||
    channel.image ||
    "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&h=225&fit=crop",
  isChannel: true,
  videoType: "channel",
  raw: channel,
});

function AdPlayback({
  videoId,
  advertisement,
}: {
  videoId: string;
  advertisement: { mediaUrl: string; networkId: string; networkName: string };
}) {
  const [started, setStarted] = useState(false);
  const impressionTracked = useRef(false);
  const player = useVideoPlayer(advertisement.mediaUrl, (instance) => {
    instance.loop = false;
    instance.muted = true;
  });

  const trackEvent = useCallback(
    (event: string) => {
      fetch(`${BACKEND_URL}/v1/player/ad-impression`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          networkId: advertisement.networkId,
          event,
        }),
      }).catch((error) => {
        console.warn(`Could not track ad ${event}:`, error);
      });
    },
    [advertisement.networkId, videoId],
  );

  useEffect(() => {
    const subscription = player.addListener("playToEnd", () =>
      trackEvent("complete"),
    );
    return () => subscription.remove();
  }, [player, trackEvent]);

  return (
    <View style={styles.adCard}>
      <View style={styles.adHeader}>
        <Text style={styles.adLabel}>Sponsored</Text>
        <Text style={styles.adNetwork}>
          {advertisement.networkName || "Advertisement"}
        </Text>
      </View>
      {started ? (
        <VideoView
          player={player}
          style={styles.adVideo}
          contentFit="contain"
          nativeControls
          allowsPictureInPicture={false}
        />
      ) : (
        <TouchableOpacity
          style={styles.adPlay}
          onPress={() => {
            setStarted(true);
            if (!impressionTracked.current) {
              impressionTracked.current = true;
              trackEvent("impression");
            }
            player.play();
          }}
          accessibilityRole="button"
          accessibilityLabel="Play sponsored video"
        >
          <Text style={styles.adPlayText}>Play advertisement</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function FeedAdvertisement({ videoId }: { videoId: string }) {
  const [advertisement, setAdvertisement] = useState<{
    mediaUrl: string;
    networkId: string;
    networkName: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadAdvertisement = async () => {
      try {
        const response = await fetch(
          `${BACKEND_URL}/v1/player/manifest/${encodeURIComponent(videoId)}`,
        );
        if (!response.ok) {
          throw new Error(`Ad manifest request failed (${response.status})`);
        }
        const payload = await response.json();
        if (!payload.adAvailable || !payload.ad?.vastXml) return;

        const mediaFiles = Array.from(
          payload.ad.vastXml.matchAll(
            /<MediaFile\b([^>]*)>([\s\S]*?)<\/MediaFile>/gi,
          ),
          ([, attributes, content]) => ({
            attributes,
            url: content
              .replace(/<!\[CDATA\[|\]\]>/g, "")
              .trim()
              .replace(/&amp;/g, "&"),
          }),
        );
        const mediaFile =
          mediaFiles.find(
            ({ attributes, url }) =>
              url && /type=["']video\/mp4["']/i.test(attributes),
          ) ||
          mediaFiles.find(
            ({ attributes, url }) =>
              url &&
              (/type=["']video\//i.test(attributes) ||
                /\.(mp4|webm)(?:[?#]|$)/i.test(url)),
          );
        if (!mediaFile || cancelled) return;

        setAdvertisement({
          mediaUrl: mediaFile.url,
          networkId: payload.ad.networkId,
          networkName: payload.ad.networkName,
        });
      } catch (error) {
        console.warn("Could not load feed advertisement:", error);
      }
    };

    loadAdvertisement();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  if (!advertisement) return null;
  return <AdPlayback videoId={videoId} advertisement={advertisement} />;
}

const getArray = (payload: any) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.videos)) return payload.videos;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.channels)) return payload.channels;
  if (Array.isArray(payload?.subscribedChannels)) return payload.subscribedChannels;
  return [];
};

const fetchWithAuth = async (endpoint: string, params: any = {}) => {
  const token = await AsyncStorage.getItem("token");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  ).toString();

  const res = await fetch(`${API_BASE}/${endpoint}${query ? `?${query}` : ""}`, {
    headers,
  });
  if (!res.ok) throw new Error(`${endpoint} failed (${res.status})`);
  const data = await res.json();
  if (data?.success === false) throw new Error(data.message || "Failed");
  return data;
};

const fetchAllCategoryPages = async (
  endpoint: string,
  categoryId: string | null,
) => {
  const pageSize = 20;
  const items: any[] = [];
  let page = 1;

  while (true) {
    const payload = await fetchWithAuth(endpoint, {
      page,
      limit: pageSize,
      category: categoryId || undefined,
    });
    const pageItems = getArray(payload);
    items.push(...pageItems);

    if (
      pageItems.length === 0 ||
      !hasMorePages(payload, page, pageSize, pageItems.length)
    ) {
      return items;
    }
    page += 1;
  }
};

const formatViews = (v: number = 0) => {
  if (v >= 1_000_000)
    return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M views`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K views`;
  return `${v.toLocaleString()} views`;
};

const formatDuration = (value: any) => {
  if (typeof value === "string" && value.includes(":")) return value;
  const sec = Number(value);
  if (!Number.isFinite(sec) || sec <= 0) return "";
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};

const formatUploadTime = (value: any) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
};

// ====================== Normal Video Card ======================
const VideoFeedRow = React.memo(function VideoFeedRow({
  item,
  isActive,
  onPress,
}: {
  item: any;
  isActive: boolean;
  onPress: (item: any) => void;
}) {
  const progress = Math.min(100, Math.max(0, item.watchedPercent || 0));
  const durationText = formatDuration(item.duration);
  const channel = item.channel || {};
  const channelName =
    channel?.name || channel?.channelName || item.channelName || "Unknown Channel";
  const avatarUrl =
    channel?.avatar ||
    channel?.profileImage ||
    channel?.channelImage ||
    channel?.image ||
    "";
  const isVerified = Boolean(channel?.isVerified || channel?.verified);

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => onPress(item)}
      style={styles.card}
    >
      <View style={styles.thumbWrapper}>
        {isActive ? (
          <AutoplayPreview uri={item.videoUrl} style={styles.thumb} />
        ) : (
          <Image
            source={{ uri: item.thumb || item.thumbnail }}
            style={styles.thumb}
            resizeMode="cover"
          />
        )}

        {durationText ? (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{durationText}</Text>
          </View>
        ) : null}

        {progress > 0 && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        )}

        {isActive && (
          <View style={styles.mutedBadge}>
            <Text style={styles.mutedText}>🔇</Text>
          </View>
        )}
      </View>

      <View style={styles.infoRow}>
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image
              source={{ uri: toMediaUrl(avatarUrl, "") }}
              style={styles.avatarImg}
            />
          ) : (
            <Text style={styles.avatarText}>
              {channelName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.channelRow}>
            <Text style={styles.channelName} numberOfLines={1}>
              {channelName}
            </Text>
            {isVerified && (
              <BadgeCheck size={14} color="#aaa" style={{ marginLeft: 4 }} />
            )}
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {formatViews(item.views)}
            {item.uploadDate || item.createdAt
              ? ` • ${formatUploadTime(item.uploadDate || item.createdAt)}`
              : ""}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ====================== Short Card (Grid) ======================
const ShortCard = React.memo(function ShortCard({
  item,
  onPress,
}: {
  item: any;
  onPress: (item: any) => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress(item)}
      style={styles.shortCard}
    >
      <View style={styles.shortThumbWrapper}>
        <Image
          source={{ uri: item.thumbnail || item.thumb }}
          style={styles.shortThumb}
          resizeMode="cover"
        />
        <View style={styles.shortOverlay}>
          <Text style={styles.shortTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.shortViews}>
            {formatViews(item.views)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ====================== Main ======================
export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();

  const [recommended, setRecommended] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [latest, setLatest] = useState<any[]>([]);
  const [trendingShorts, setTrendingShorts] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [topShorts, setTopShorts] = useState<any[]>([]);

  const [moreRecommended, setMoreRecommended] = useState<any[]>([]);
  const [moreTrending, setMoreTrending] = useState<any[]>([]);
  const [moreLatest, setMoreLatest] = useState<any[]>([]);
  const [moreTrendingShorts, setMoreTrendingShorts] = useState<any[]>([]);
  const [moreTopShorts, setMoreTopShorts] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);

  const isShort = (item: any) => {
    const t = item?.videoType ?? item?.raw?.videoType ?? [];
    const types = (Array.isArray(t) ? t : [t]).map((x) => String(x).toLowerCase());
    return item?.isShort || types.some((x) => x.includes("short"));
  };

  const loadAll = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      const [
        allRecommended,
        allTrending,
        allLatest,
        allTrendingShorts,
        allTopShorts,
        subData,
      ] = await Promise.all([
        fetchAllCategoryPages("recommended", selectedCategoryId),
        fetchAllCategoryPages("trending", selectedCategoryId),
        fetchAllCategoryPages("latest", selectedCategoryId),
        fetchAllCategoryPages("trending-shorts", selectedCategoryId),
        fetchAllCategoryPages("top-shorts", selectedCategoryId),
        token ? fetchWithAuth("subscribed-channels") : Promise.resolve([]),
      ]);
      if (requestId !== loadRequestIdRef.current) return;

      const splitFirstBatch = (videos: any[], normalize: (video: any) => any) => {
        const normalized = videos.map(normalize);
        const firstBatch = normalized.slice(0, LIMIT);
        const firstBatchIds = new Set(
          firstBatch.map((item) => String(item.id)),
        );
        const more = normalized.slice(LIMIT).filter((item) => {
          const id = String(item.id);
          if (!item.id || firstBatchIds.has(id)) return false;
          firstBatchIds.add(id);
          return true;
        });
        return { firstBatch, more };
      };

      const recommendedBatches = splitFirstBatch(allRecommended, normalizeVideo);
      const trendingBatches = splitFirstBatch(allTrending, normalizeVideo);
      const latestBatches = splitFirstBatch(allLatest, normalizeVideo);
      const trendingShortBatches = splitFirstBatch(
        allTrendingShorts,
        normalizeShort,
      );
      const topShortBatches = splitFirstBatch(allTopShorts, normalizeShort);
      const subs = getArray(subData).map(normalizeChannel).slice(0, LIMIT);

      setRecommended(recommendedBatches.firstBatch);
      setTrending(trendingBatches.firstBatch);
      setLatest(latestBatches.firstBatch);
      setTrendingShorts(trendingShortBatches.firstBatch);
      setSubscriptions(subs);
      setTopShorts(topShortBatches.firstBatch);
      setMoreRecommended(recommendedBatches.more);
      setMoreTrending(trendingBatches.more);
      setMoreLatest(latestBatches.more);
      setMoreTrendingShorts(trendingShortBatches.more);
      setMoreTopShorts(topShortBatches.more);
    } catch (e) {
      if (requestId !== loadRequestIdRef.current) return;
      console.warn(e);
      Toast.show({ type: "error", text1: "Failed to load feed" });
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false);
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    let active = true;
    let socket: any;
    let handler: any;

    getViewSocket().then((s) => {
      if (!active || !s) return;
      socket = s;
      handler = ({ videoId, views }: any) => {
        const upd = (list: any[]) =>
          list.map((i) =>
            String(i.id) === String(videoId) ? { ...i, views } : i
          );
        setRecommended(upd);
        setTrending(upd);
        setLatest(upd);
        setMoreRecommended(upd);
        setMoreTrending(upd);
        setMoreLatest(upd);
        setTrendingShorts((p) => upd(p));
        setTopShorts((p) => upd(p));
        setMoreTrendingShorts((p) => upd(p));
        setMoreTopShorts((p) => upd(p));
      };
      socket.on("view-count-updated", handler);
    });

    return () => {
      active = false;
      if (socket && handler) socket.off("view-count-updated", handler);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    setActiveVideoId(null);
    await loadAll();
    setRefreshing(false);
  };

  const handleItemClick = useCallback(
    (item: any) => {
      setActiveVideoId(null);
      if (item?.isChannel) {
        navigation.navigate("SubscribedChannels", { id: item.id });
        return;
      }
      if (isShort(item)) {
        navigation.navigate("MainTabs", {
          screen: "Shorts",
          params: { video: item },
        });
        return;
      }
      navigation.navigate("VideoDetail", { id: item.id, item, video: item });
    },
    [navigation]
  );

  const handleSectionPress = useCallback(
    (type: string) => {
      navigation.navigate("ViewAll", { type });
    },
    [navigation]
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 250,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length > 0) {
      const most = viewableItems.reduce((a: any, b: any) =>
        (b?.percentVisible ?? 0) > (a?.percentVisible ?? 0) ? b : a
      );
      const item = most?.item;
      if (item?.id && !isShort(item) && item.videoUrl) {
        setActiveVideoId(item.id);
      } else {
        setActiveVideoId(null);
      }
    } else {
      setActiveVideoId(null);
    }
  }).current;

  // ====================== List Data ======================
  const listData = useMemo(() => {
    if (loading) return [{ id: "loading", type: "loading" }];

    const sections = [
      { id: "recommended", title: "Recommended for you", type: "recommended", data: recommended, isShorts: false },
      { id: "trending", title: "Trending Videos", type: "trending", data: trending, isShorts: false },
      { id: "latest", title: "Latest Videos", type: "latest", data: latest, isShorts: false },
      { id: "trending-shorts", title: "Trending Shorts", type: "shorts", data: trendingShorts, isShorts: true },
      { id: "subscriptions", title: "From your Subscriptions", type: "subscriptions", data: subscriptions, isShorts: false },
      { id: "top-shorts", title: "Top Shorts", type: "shorts", data: topShorts, isShorts: true },
      { id: "more-recommended", title: "Recommended for you", type: "recommended", data: moreRecommended, isShorts: false },
      { id: "more-trending", title: "Trending Videos", type: "trending", data: moreTrending, isShorts: false },
      { id: "more-latest", title: "Latest Videos", type: "latest", data: moreLatest, isShorts: false },
      { id: "more-trending-shorts", title: "Trending Shorts", type: "shorts", data: moreTrendingShorts, isShorts: true },
      { id: "more-top-shorts", title: "Top Shorts", type: "top-shorts", data: moreTopShorts, isShorts: true },
    ];

    return sections.flatMap((section, sectionIndex) => {
      if (!section.data || section.data.length === 0) return [];

      const header = {
        id: `${section.id}-header`,
        type: "section-header",
        title: section.title,
        sectionType: section.type,
      };

      if (section.isShorts) {
        const gridRows = [];
        for (let index = 0; index < section.data.length; index += 2) {
          gridRows.push({
            id: `${section.id}-grid-${index / 2}`,
            type: "shorts-grid",
            data: section.data.slice(index, index + 2),
          });
        }
        return [header, ...gridRows];
      }

      // Normal videos
      return [
        header,
        ...section.data.map((item) => ({
          ...item,
          type: "video",
          rowKey: `${section.id}:${String(item.id)}`,
        })),
        ...(sectionIndex === 2 || sectionIndex === 7
          ? [
              {
                id: `${section.id}-ad`,
                type: "feed-ad",
                videoId: `app-feed-${section.id}`,
              },
            ]
          : []),
      ];
    });
  }, [
    loading,
    recommended,
    trending,
    latest,
    trendingShorts,
    subscriptions,
    topShorts,
    moreRecommended,
    moreTrending,
    moreLatest,
    moreTrendingShorts,
    moreTopShorts,
  ]);

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      if (item.type === "loading") {
        return <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />;
      }

      if (item.type === "section-header") {
        return (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => handleSectionPress(item.sectionType)}
            >
              <Text style={styles.sectionTitle}>{item.title}</Text>
              <ChevronRight size={20} color="#a1a1aa" />
            </TouchableOpacity>
          </View>
        );
      }

      // ===== Shorts Grid =====
      if (item.type === "shorts-grid") {
        return (
          <View style={styles.shortsGrid}>
            {item.data.map((short: any) => (
              <ShortCard
                key={short.id}
                item={short}
                onPress={handleItemClick}
              />
            ))}
          </View>
        );
      }

      if (item.type === "feed-ad") {
        return <FeedAdvertisement videoId={item.videoId} />;
      }

      // ===== Normal Video =====
      return (
        <VideoFeedRow
          item={item}
          isActive={isFocused && activeVideoId === item.id && !!item.videoUrl}
          onPress={handleItemClick}
        />
      );
    },
    [activeVideoId, handleItemClick, handleSectionPress, isFocused]
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <Navbar onMenuPress={() => {}} points={0} />

      <TopicChips
        onTopicChange={(_, categoryId) =>
          setSelectedCategoryId(
            categoryId && categoryId !== "all" ? String(categoryId) : null,
          )
        }
      />

      <FlatList
        data={listData}
        keyExtractor={(item) => item.rowKey || item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            colors={["#fff"]}
          />
        }
      />
    </View>
  );
}

// ====================== Styles ======================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  listContent: {
    paddingBottom: 80,
  },
  section: {
    marginBottom: 8,
  },
  adCard: {
    marginHorizontal: 12,
    marginVertical: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    backgroundColor: "#09090b",
  },
  adHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  adLabel: {
    color: "#a1a1aa",
    fontSize: 12,
  },
  adNetwork: {
    color: "#a1a1aa",
    fontSize: 12,
  },
  adVideo: {
    width: "100%",
    height: SCREEN_WIDTH * 0.56,
    backgroundColor: "#000",
  },
  adPlay: {
    minHeight: SCREEN_WIDTH * 0.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#18181b",
  },
  adPlayText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 12,
    marginTop: 16,
    gap: 6,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  // ===== Normal Video Card =====
  card: {
    marginBottom: 18,
  },
  thumbWrapper: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#111",
    position: "relative",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  durationBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  progressTrack: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#f00",
  },
  mutedBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mutedText: {
    color: "#fff",
    fontSize: 13,
  },
  infoRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  textCol: {
    flex: 1,
  },
  title: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: 3,
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  channelName: {
    color: "#aaa",
    fontSize: 13,
  },
  meta: {
    color: "#aaa",
    fontSize: 13,
    marginTop: 2,
  },

  // ===== Shorts Grid =====
  shortsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: SHORT_GAP,
    marginBottom: 20,
  },
  shortCard: {
    width: SHORT_WIDTH,
  },
  shortThumbWrapper: {
    width: SHORT_WIDTH,
    height: SHORT_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#18181b",
  },
  shortThumb: {
    width: "100%",
    height: "100%",
  },
  shortOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  shortTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
  },
  shortViews: {
    color: "#ccc",
    fontSize: 11,
    marginTop: 4,
  },
});