import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  TextInput,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Search,
} from "lucide-react-native";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_ORIGIN } from "../../config/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const BACKEND_URL = API_ORIGIN;
const API_BASE = `${BACKEND_URL}/api/uservideo`;

const PAGE_SIZE = 20;

const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;
const CARD_HEIGHT = CARD_WIDTH * (9 / 16);

const SHORT_WIDTH = (SCREEN_WIDTH - 48) / 2;
const SHORT_HEIGHT = SHORT_WIDTH * (16 / 9);

// ────────────────────────────────────────────────
// Normalize helpers
// ────────────────────────────────────────────────
const normalizeVideo = (video: Record<string, any> = {}) => ({
  id: video._id || video.id,
  title: video.title || "Untitled video",
  thumb: video.thumbnail
    ? /^https?:\/\//i.test(video.thumbnail)
      ? video.thumbnail.replace(/\\/g, "/")
      : `${BACKEND_URL}/${String(video.thumbnail).replace(/\\/g, "/")}`
    : "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&h=225&fit=crop",
  thumbnail: video.thumbnail
    ? /^https?:\/\//i.test(video.thumbnail)
      ? video.thumbnail.replace(/\\/g, "/")
      : `${BACKEND_URL}/${String(video.thumbnail).replace(/\\/g, "/")}`
    : "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&h=225&fit=crop",
  views: Number(video.views ?? video.viewCount ?? 0),
  videoUrl: video.videoUrl
    ? /^https?:\/\//i.test(video.videoUrl)
      ? video.videoUrl.replace(/\\/g, "/")
      : `${BACKEND_URL}/${String(video.videoUrl).replace(/\\/g, "/")}`
    : "",
  videoType: video.videoType || null,
  raw: video,
  isShort: false,
});

const normalizeShort = (video: Record<string, any> = {}) => ({
  id: video._id || video.id,
  title: video.title || "Untitled short",
  thumbnail: video.thumbnail
    ? /^https?:\/\//i.test(video.thumbnail)
      ? video.thumbnail.replace(/\\/g, "/")
      : `${BACKEND_URL}/${String(video.thumbnail).replace(/\\/g, "/")}`
    : "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&h=225&fit=crop",
  views: Number(video.views ?? video.viewCount ?? 0),
  videoUrl: video.videoUrl
    ? /^https?:\/\//i.test(video.videoUrl)
      ? video.videoUrl.replace(/\\/g, "/")
      : `${BACKEND_URL}/${String(video.videoUrl).replace(/\\/g, "/")}`
    : "",
  videoType: video.videoType || "short",
  raw: video,
  isShort: true,
});

const normalizeChannel = (channel: Record<string, any> = {}) => ({
  id: channel._id || channel.id,
  name: channel.name || "Channel",
  avatar:
    channel.channelImage || channel.avatar || channel.image
      ? /^https?:\/\//i.test(
          channel.channelImage || channel.avatar || channel.image,
        )
        ? (channel.channelImage || channel.avatar || channel.image).replace(
            /\\/g,
            "/",
          )
        : `${BACKEND_URL}/${String(
            channel.channelImage || channel.avatar || channel.image,
          ).replace(/\\/g, "/")}`
      : "https://via.placeholder.com/120",
  subscribersCount: Number(channel.subscribersCount || 0),
  channelImage: channel.channelImage || channel.avatar || channel.image,
  raw: channel,
});

// ────────────────────────────────────────────────
// Cards
// ────────────────────────────────────────────────
function MovieCard({ item, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress(item)}
      style={styles.movieCard}
    >
      <Image
        source={{ uri: item.thumb || item.thumbnail }}
        style={styles.movieImage}
        resizeMode="cover"
      />
      <View style={styles.movieOverlay}>
        <Text style={styles.movieTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.movieViews}>
          {item.views?.toLocaleString() || 0} views
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ShortCard({ item, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress(item)}
      style={styles.shortCard}
    >
      <Image
        source={{ uri: item.thumbnail || item.thumb }}
        style={styles.shortImage}
        resizeMode="cover"
      />
      <View style={styles.shortOverlay}>
        <Text style={styles.shortTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.shortViews}>
          {item.views?.toLocaleString() || 0} views
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ────────────────────────────────────────────────
// Main Screen
// ────────────────────────────────────────────────
export default function SearchPage() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  // query aata hai route params se
  const initialQuery = route.params?.q || route.params?.query || "";

  const [query, setQuery] = useState(initialQuery);
  const [searchText, setSearchText] = useState(initialQuery);
  const [page, setPage] = useState(1);

  const [videoResults, setVideoResults] = useState([]);
  const [shortResults, setShortResults] = useState([]);
  const [channelResults, setChannelResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  // Search API call
  useEffect(() => {
    if (!query.trim()) {
      setVideoResults([]);
      setShortResults([]);
      setChannelResults([]);
      setTotal(0);
      setError(null);
      return;
    }

    let active = true;

    const doSearch = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = await AsyncStorage.getItem("token");

        const res = await fetch(
          `${API_BASE}/search?q=${encodeURIComponent(query)}&page=${page}&limit=${PAGE_SIZE}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );

        if (!res.ok) throw new Error(`Search failed (${res.status})`);

        const data = await res.json();

        if (!active) return;

        // Flexible response handling
        const videos = Array.isArray(data.videos)
          ? data.videos
          : Array.isArray(data.data?.videos)
            ? data.data.videos
            : Array.isArray(data.results)
              ? data.results.filter(
                  (v) => !v.isShort && v.videoType !== "short",
                )
              : [];

        const shorts = Array.isArray(data.shorts)
          ? data.shorts
          : Array.isArray(data.data?.shorts)
            ? data.data.shorts
            : Array.isArray(data.results)
              ? data.results.filter((v) => v.isShort || v.videoType === "short")
              : [];

        const channels = Array.isArray(data.channels)
          ? data.channels
          : Array.isArray(data.data?.channels)
            ? data.data.channels
            : [];

        setVideoResults(videos.map(normalizeVideo));
        setShortResults(shorts.map(normalizeShort));
        setChannelResults(channels.map(normalizeChannel));
        setTotal(
          Number(data.total) || videos.length + shorts.length + channels.length,
        );
      } catch (err) {
        if (active) {
          setError(err.message || "Search failed");
          setVideoResults([]);
          setShortResults([]);
          setChannelResults([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    doSearch();

    return () => {
      active = false;
    };
  }, [query, page]);

  const handleSearch = () => {
    const q = searchText.trim();
    if (!q) return;
    setQuery(q);
    setSearchText("");
    setPage(1);
  };

  const handleVideoClick = (item) => {
    navigation.navigate("VideoDetail", { id: item.id, item });
  };

  const handleShortClick = (item) => {
    navigation.navigate("MainTabs", {
      screen: "Shorts",
      params: { video: item },
    });
  };

  const handleChannelClick = (channel) => {
    if (!channel?.id) return;
    navigation.navigate("SubscribedChannels", { id: channel.id });
  };

  const handleAddToWatchLater = async (item) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Toast.show({ type: "error", text1: "Please login first" });
        return;
      }

      const res = await fetch(`${API_BASE}/watch-later/${item.id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (data.success) {
        Toast.show({
          type: "success",
          text1: data.message || "Added to Watch Later",
        });
      } else {
        Toast.show({
          type: "error",
          text1: data.message || "Failed to add",
        });
      }
    } catch (err) {
      Toast.show({ type: "error", text1: "Something went wrong" });
    }
  };

  // ──── Empty query ────
  if (!query.trim()) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        {/* Header with Search */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.searchBox}>
            <Search size={18} color="#aaaaaa" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search videos, shorts..."
              placeholderTextColor="#666"
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoFocus
            />
          </View>
        </View>

        <View style={styles.center}>
          <Text style={styles.emptyText}>
            Search for videos, shorts and channels.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.searchBox}>
          <Search size={18} color="#aaaaaa" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search videos, shorts & channels"
            placeholderTextColor="#666"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Results Header */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle} numberOfLines={1}>
          Results for "{query}"
        </Text>
        <Text style={styles.resultsCount}>
          {total.toLocaleString()} results
        </Text>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF0000" />
          <Text style={styles.loadingText}>Searching for "{query}"...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : videoResults.length === 0 &&
        shortResults.length === 0 &&
        channelResults.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No results found for "{query}".</Text>
        </View>
      ) : (
        <FlatList
          data={[{ type: "content" }]}
          keyExtractor={() => "main"}
          renderItem={() => null}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
          ListHeaderComponent={
            <>
              {/* Channels Section */}
              {channelResults.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Channels</Text>
                  <View style={styles.channelList}>
                    {channelResults.map((channel) => (
                      <TouchableOpacity
                        key={channel.id}
                        style={styles.channelRow}
                        activeOpacity={0.8}
                        onPress={() => handleChannelClick(channel)}
                      >
                        <Image
                          source={{ uri: channel.avatar }}
                          style={styles.channelAvatar}
                        />
                        <View style={styles.channelInfo}>
                          <Text style={styles.channelName} numberOfLines={1}>
                            {channel.name}
                          </Text>
                          <Text style={styles.channelMeta}>
                            {channel.subscribersCount.toLocaleString()}{" "}
                            subscribers
                          </Text>
                        </View>
                        <ChevronRight size={18} color="#aaaaaa" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Videos Section */}
              {videoResults.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Videos</Text>
                  <View style={styles.videosGrid}>
                    {videoResults.map((item) => (
                      <MovieCard
                        key={item.id}
                        item={item}
                        onPress={handleVideoClick}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* Shorts Section */}
              {shortResults.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Shorts</Text>
                  <View style={styles.shortsGrid}>
                    {shortResults.map((item) => (
                      <ShortCard
                        key={item.id}
                        item={item}
                        onPress={handleShortClick}
                      />
                    ))}
                  </View>
                </View>
              )}
            </>
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                  onPress={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft size={16} color={page <= 1 ? "#555" : "#fff"} />
                  <Text
                    style={[
                      styles.pageBtnText,
                      page <= 1 && styles.pageBtnTextDisabled,
                    ]}
                  >
                    Previous
                  </Text>
                </TouchableOpacity>

                <Text style={styles.pageInfo}>
                  Page {page} of {totalPages}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.pageBtn,
                    page >= totalPages && styles.pageBtnDisabled,
                  ]}
                  onPress={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page >= totalPages}
                >
                  <Text
                    style={[
                      styles.pageBtnText,
                      page >= totalPages && styles.pageBtnTextDisabled,
                    ]}
                  >
                    Next
                  </Text>
                  <ChevronRight
                    size={16}
                    color={page >= totalPages ? "#555" : "#fff"}
                  />
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 50,
    paddingBottom: 60,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1f1f1f",
    gap: 10,
  },
  backBtn: {
    padding: 6,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    paddingVertical: 0,
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  resultsTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  resultsCount: {
    color: "#aaaaaa",
    fontSize: 13,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    color: "#aaaaaa",
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: "#f87171",
    fontSize: 15,
    textAlign: "center",
  },
  emptyText: {
    color: "#aaaaaa",
    fontSize: 15,
    textAlign: "center",
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  channelList: {
    gap: 10,
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161616",
    borderRadius: 12,
    padding: 12,
  },
  channelAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#252525",
  },
  channelInfo: {
    flex: 1,
    marginLeft: 12,
  },
  channelName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  channelMeta: {
    color: "#aaaaaa",
    fontSize: 12,
    marginTop: 4,
  },
  videosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  shortsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },

  // Movie Card
  movieCard: {
    width: CARD_WIDTH,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#18181b",
    marginBottom: 4,
  },
  movieImage: {
    width: "100%",
    height: CARD_HEIGHT,
  },
  movieOverlay: {
    padding: 8,
  },
  movieTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
  },
  movieViews: {
    color: "#aaaaaa",
    fontSize: 11,
    marginTop: 3,
  },

  // Short Card
  shortCard: {
    width: SHORT_WIDTH,
    height: SHORT_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#18181b",
  },
  shortImage: {
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
    color: "#cccccc",
    fontSize: 11,
    marginTop: 4,
  },

  // Pagination
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 16,
  },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#272727",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 4,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
  pageBtnTextDisabled: {
    color: "#555",
  },
  pageInfo: {
    color: "#aaaaaa",
    fontSize: 13,
  },
});
