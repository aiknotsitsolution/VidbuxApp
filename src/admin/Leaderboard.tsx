import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { API_ORIGIN as BACKEND_URL } from "../../config/api";
import Navbar from "./Navbar";
import AdminBottomTabs from "./AdminBottomTabs";

// ---------------- Types ----------------
interface Creator {
  id: string | number;
  rank: number;
  name?: string;
  channelName?: string;
  avatar?: string;
  totalSubscribers?: number;
  rewardPoints?: number;
}

interface VideoItem {
  viewCount: number;
  id: string | number;
  rank: number;
  title?: string;
  creatorName?: string;
  thumbnail?: string;
  views?: number;
}

// ---------------- Helper ----------------
const resolveMediaUrl = (value?: string | null): string => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  const normalized = value.replace(/\\/g, "/");
  if (normalized.startsWith("uploads/")) {
    return `${BACKEND_URL}/${normalized}`;
  }
  if (normalized.includes("uploads/")) {
    return `${BACKEND_URL}/${normalized.split("uploads/").pop()}`;
  }
  if (normalized.startsWith("/uploads/")) {
    return `${BACKEND_URL}${normalized}`;
  }
  return `${BACKEND_URL}/${normalized}`;
};

// ---------------- Component ----------------
const Leaderboard: React.FC = () => {
  const navigation = useNavigation<any>();
  const [topCreators, setTopCreators] = useState<Creator[]>([]);
  const [topVideos, setTopVideos] = useState<VideoItem[]>([]);
  const [videoType, setVideoType] = useState<"long" | "short">("long");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchLeaderboard = async () => {
      try {
        const token = await AsyncStorage.getItem("token");

        if (!token) {
          if (active) {
            setError("Please login to view the leaderboard.");
            setLoading(false);
          }
          return;
        }

        setLoading(true);
        setError(null);

        const res = await fetch(
          `${BACKEND_URL}/api/leaderboard?videoType=${videoType}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!res.ok) {
          throw new Error(`Failed to load leaderboard (${res.status})`);
        }

        const data = await res.json();

        if (!active) return;

        if (!data.success) {
          throw new Error(data.message || "Failed to load leaderboard");
        }

        setTopCreators(data.data?.topCreators || []);
        setTopVideos(data.data?.topVideos || []);
      } catch (err: any) {
        if (active) {
          setError(err.message || "Failed to load leaderboard data.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchLeaderboard();

    return () => {
      active = false;
    };
  }, [videoType]);

  // ---------- Rank badge style helper ----------
  const getRankStyle = (rank: number) => {
    if (rank === 1) return styles.rankGold;
    if (rank === 2) return styles.rankSilver;
    if (rank === 3) return styles.rankBronze;
    return styles.rankDefault;
  };

  // ---------- Render ----------
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Top Navbar */}
      <Navbar onMenuPress={() => {}} points={0} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>LEADERBOARD</Text>
          <Text style={styles.subtitle}>
            Top Creators & Most Viewed Content • February 2026
          </Text>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#ef4444" />
            <Text style={styles.loadingText}>Loading leaderboard...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {/* ========== TOP CREATORS ========== */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>🏆 TOP CREATORS</Text>
              </View>

              {topCreators.length === 0 ? (
                <Text style={styles.emptyText}>No creators yet.</Text>
              ) : (
                topCreators.map((creator) => (
                  <View key={creator.id} style={styles.row}>
                    {/* Rank */}
                    <View
                      style={[styles.rankBadge, getRankStyle(creator.rank)]}
                    >
                      <Text style={styles.rankText}>{creator.rank}</Text>
                    </View>

                    {/* Avatar */}
                    {creator.avatar ? (
                      <Image
                        source={{ uri: resolveMediaUrl(creator.avatar) }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarLetter}>
                          {(creator.name || "?").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    {/* Name + Channel */}
                    <View style={styles.info}>
                      <Text style={styles.name} numberOfLines={1}>
                        {creator.name || "Unknown"}
                      </Text>
                      <Text style={styles.channel} numberOfLines={1}>
                        {creator.channelName}
                      </Text>
                    </View>

                    {/* Followers */}
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>
                        {Number(creator.totalSubscribers || 0).toLocaleString()}
                      </Text>
                      <Text style={styles.statLabel}>followers</Text>
                    </View>

                    {/* Points */}
                    <View style={[styles.statBox, { minWidth: 70 }]}>
                      <Text style={[styles.statValue, { color: "#f87171" }]}>
                        {Number(creator.rewardPoints || 0).toLocaleString()}
                      </Text>
                      <Text style={styles.statLabel}>points</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* ========== TOP VIEWS ========== */}
            <View style={styles.card}>
              <View style={styles.videoHeader}>
                <View style={styles.videoHeadingBlock}>
                  <Text style={styles.cardKicker}>TRENDING NOW</Text>
                  <Text style={styles.cardTitle}>Top views</Text>
                  <Text style={styles.cardSubtitle}>
                    The content your audience is watching most
                  </Text>
                </View>
                <View style={styles.typeToggle}>
                  <TouchableOpacity
                    onPress={() => {
                      setVideoType("long");
                      setLoading(true);
                      setError(null);
                    }}
                    style={[
                      styles.typeButton,
                      videoType === "long" && styles.typeButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        videoType === "long" && styles.typeButtonTextActive,
                      ]}
                    >
                      Videos
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setVideoType("short");
                      setLoading(true);
                      setError(null);
                    }}
                    style={[
                      styles.typeButton,
                      videoType === "short" && styles.typeButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        videoType === "short" && styles.typeButtonTextActive,
                      ]}
                    >
                      Shorts
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {topVideos.length === 0 ? (
                <Text style={styles.emptyText}>No videos yet.</Text>
              ) : (
                topVideos.map((item) => (
                  <View key={item.id} style={styles.videoRow}>
                    {/* Rank */}
                    <View style={[styles.videoRank, getRankStyle(item.rank)]}>
                      <Text style={styles.rankText}>{item.rank}</Text>
                    </View>

                    {/* Thumbnail */}
                    {item.thumbnail ? (
                      <Image
                        source={{ uri: resolveMediaUrl(item.thumbnail) }}
                        style={styles.videoThumbnail}
                      />
                    ) : (
                      <View style={styles.videoThumbnailPlaceholder}>
                        <Text style={styles.thumbPlaceholderText}>
                          No thumb
                        </Text>
                      </View>
                    )}

                    {/* Title + Creator */}
                    <View style={styles.videoInfo}>
                      <Text style={styles.videoTitle} numberOfLines={2}>
                        {item.title || "Untitled video"}
                      </Text>
                      <Text style={styles.channel} numberOfLines={1}>
                        {item.creatorName || "Unknown creator"}
                      </Text>
                    </View>

                    {/* Views */}
                    <View style={styles.viewsBox}>
                      <Text style={styles.viewsValue}>
                        {Number(
                          item.views ?? item.viewCount ?? 0,
                        ).toLocaleString()}
                      </Text>
                      <Text style={styles.statLabel}>views</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Keep creating fire content to reach the top!
        </Text>
      </ScrollView>

      <AdminBottomTabs navigation={navigation} />
    </View>
  );
};

// ====================== STYLES ======================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    paddingBottom: 96,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#dc2626",
    letterSpacing: 1,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#9ca3af",
    textAlign: "center",
  },
  centerBox: {
    paddingVertical: 60,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#9ca3af",
    fontSize: 15,
  },
  errorText: {
    color: "#f87171",
    fontSize: 16,
    textAlign: "center",
  },
  grid: {
    gap: 24,
  },
  card: {
    backgroundColor: "#0a0a0a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    overflow: "hidden",
  },
  cardHeader: {
    backgroundColor: "rgba(127, 29, 29, 0.45)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(127, 29, 29, 0.4)",
  },
  videoHeader: {
    paddingHorizontal: 16,
    paddingVertical: 17,
    backgroundColor: "#161a22",
    borderBottomWidth: 1,
    borderBottomColor: "#252b36",
    gap: 14,
  },
  videoHeadingBlock: {
    flex: 1,
  },
  cardKicker: {
    color: "#f59e0b",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ef4444",
  },
  cardSubtitle: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 4,
  },
  typeToggle: {
    flexDirection: "row",
    alignSelf: "flex-start",
    padding: 3,
    borderRadius: 10,
    backgroundColor: "#0d1016",
    borderWidth: 1,
    borderColor: "#303846",
  },
  typeButton: {
    minWidth: 78,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },
  typeButtonActive: {
    backgroundColor: "#dc354d",
  },
  typeButtonText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  typeButtonTextActive: {
    color: "#fff",
  },
  emptyText: {
    textAlign: "center",
    color: "#9ca3af",
    paddingVertical: 28,
    fontSize: 15,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f1f1f",
    gap: 12,
  },
  videoRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 88,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#20252e",
    gap: 10,
  },
  videoRank: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  rankGold: {
    backgroundColor: "#ca8a04",
    borderWidth: 2,
    borderColor: "#eab308",
  },
  rankSilver: {
    backgroundColor: "#6b7280",
    borderWidth: 2,
    borderColor: "#9ca3af",
  },
  rankBronze: {
    backgroundColor: "#b45309",
    borderWidth: 2,
    borderColor: "#d97706",
  },
  rankDefault: {
    backgroundColor: "#374151",
  },
  rankText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "#374151",
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "#374151",
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: "#9ca3af",
    fontSize: 20,
    fontWeight: "600",
  },
  videoThumbnail: {
    width: 86,
    height: 54,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#3a4657",
  },
  videoThumbnailPlaceholder: {
    width: 86,
    height: 54,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#3a4657",
    backgroundColor: "#1c2531",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbPlaceholderText: {
    color: "#6b7280",
    fontSize: 11,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  videoTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  videoInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  channel: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 2,
  },
  statBox: {
    alignItems: "flex-end",
  },
  statValue: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  statLabel: {
    color: "#6b7280",
    fontSize: 11,
    marginTop: 1,
  },
  viewsBox: {
    minWidth: 58,
    alignItems: "flex-end",
  },
  viewsValue: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  footer: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 13,
    marginTop: 28,
    marginBottom: 16,
  },
});

export default Leaderboard;
