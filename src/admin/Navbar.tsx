import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_ORIGIN } from "../../config/api";
import { showToast } from "../utils/notifications";
// import LogoutWarningModal from "../components/LogoutWarningModal";
import LogoutWarningModal from "../components/LogoutWarningModal";

const { width } = Dimensions.get("window");
const API_BASE_URL = API_ORIGIN;
const HINTS_URL = `${API_BASE_URL}/api/uservideo/search/hints`;
const DEFAULT_AVATAR_URL =
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400";

  
const resolveAvatarUrl = (avatar) => {
  if (!avatar) return "";
  const normalized = String(avatar).replace(/\\/g, "/").trim();
  if (/^(https?|file|content|data):/i.test(normalized)) return normalized;
  return normalized.startsWith("/")
    ? `${API_BASE_URL}${normalized}`
    : `${API_BASE_URL}/${normalized}`;
};

export default function Navbar({ onMenuPress, points = 0 }) {
  const navigation = useNavigation<any>();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const profileRequestInFlight = useRef(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [hints, setHints] = useState([]);
  const [showHints, setShowHints] = useState(false);
  const [hintsLoading, setHintsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const redirectToLogin = () => {
    const rootNavigation = navigation.getParent()?.getParent();
    if (rootNavigation?.replace) {
      rootNavigation.replace("Login");
    } else {
      navigation.replace("Login");
    }
  };

  // ===== Trust Score (same logic as web) =====
  const parsedTrustScore = Number(user?.trustScore);
  const trustScore = Number.isFinite(parsedTrustScore)
    ? Math.max(0, Math.min(100, parsedTrustScore))
    : 50;
  const trustTier =
    user?.trustTier ||
    (trustScore >= 70 ? "premium" : trustScore >= 40 ? "medium" : "restricted");

  const fetchProfile = useCallback(async (token) => {
    if (!token) return;
    if (profileRequestInFlight.current === token) return;

    profileRequestInFlight.current = token;
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profile = res.data?.user || res.data;

      if (!res.data?.success || !profile || typeof profile !== "object") {
        throw new Error("Login data was not returned");
      }

      const resolvedAvatar =
        resolveAvatarUrl(profile.avatar) || DEFAULT_AVATAR_URL;
      setUser({ ...profile, avatar: resolvedAvatar });
    } catch (err) {
      await AsyncStorage.multiRemove(["token", "user"]);
      setUser(null);
      setIsLoggedIn(false);
      redirectToLogin();
    } finally {
      if (profileRequestInFlight.current === token) {
        profileRequestInFlight.current = null;
      }
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem("token").then((token) => {
        if (!active) return;

        setIsLoggedIn(Boolean(token));
        if (token) {
          fetchProfile(token);
        } else {
          setUser(null);
        }
      });
      return () => {
        active = false;
      };
    }, [fetchProfile]),
  );

  // Search hints
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setHints([]);
      setShowHints(false);
      setHintsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setHintsLoading(true);
      try {
        const res = await axios.get(HINTS_URL, { params: { q } });
        const data = res.data?.data || res.data?.hints || res.data || [];
        setHints(Array.isArray(data) ? data : []);
        setShowHints(true);
      } catch {
        setHints([]);
        setShowHints(true);
      } finally {
        setHintsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = useCallback(
    (query) => {
      const q = (typeof query === "string" ? query : searchQuery).trim();
      if (!q) return;
      setShowHints(false);
      setIsListening(false);
      navigation.navigate("Search", { q });
      setSearchQuery("");
    },
    [searchQuery, navigation],
  );

  const handleMicClick = () => {
    // Voice search placeholder
    // Install @react-native-voice/voice or expo-speech for real implementation
    showToast(
      "info",
      "Voice Search",
      "Install @react-native-voice/voice for voice search support.",
    );
  };

  const handleSignOut = () => setShowLogoutWarning(true);

  const confirmSignOut = async () => {
    setShowLogoutWarning(false);
    try {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        await axios
          .post(
            `${API_BASE_URL}/api/logout`,
            {},
            { headers: { Authorization: `Bearer ${token}` } },
          )
          .catch(() => {});
      }
    } catch {
    } finally {
      await AsyncStorage.multiRemove(["token", "user"]);
      setUser(null);
      setIsLoggedIn(false);
      setIsDropdownOpen(false);
      redirectToLogin();
    }
  };

  const onHintClick = (hint) => {
    const text =
      typeof hint === "string"
        ? hint
        : hint.text || hint.title || hint.name || "";
    setSearchQuery(text);
    setShowHints(false);
    handleSearch(text);
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />
      <View style={styles.navbar}>
        {/* Top Row: Logo + Search icon + Avatar / Sign in */}
        <View style={styles.topRow}>
          <View style={styles.logoSection}>
            <Image
              source={require("../../assets/VidBuxApp-logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
              accessibilityLabel="VidBuxApp"
            />
            <Text style={styles.logoText}>VidBuxApp</Text>

            {/* Search icon next to logo */}
            <View style={styles.badgesRow}>
              <View style={styles.pointsBadge}>
                <Text style={styles.star}>★</Text>
                <Text style={styles.pointsText}>
                  {Number(points).toFixed(1)}
                </Text>
                <Text style={styles.ptsLabel}>pts</Text>
              </View>

              {isLoggedIn && (
                <View style={styles.trustBadge}>
                  <Text style={styles.trustIcon}>🛡️</Text>
                  <Text style={styles.trustScoreText}>{trustScore}</Text>
                  <Text style={styles.trustLabel}>trust</Text>
                </View>
              )}
            </View>
          </View>

          {/* Right: Avatar / Sign in */}
          <View style={styles.right}>
            {isLoggedIn ? (
              <TouchableOpacity
                onPress={() => setIsDropdownOpen(true)}
                style={styles.avatarBtn}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : user?.avatar ? (
                  <Image
                    source={{ uri: user.avatar }}
                    style={styles.avatar}
                    onError={(event) =>
                      console.log("[Navbar] avatar load failed", {
                        uri: user.avatar,
                        error: event.nativeEvent.error,
                      })
                    }
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.signInBtn}
                onPress={() => navigation.navigate("Login")}
              >
                <Text style={styles.signInText}>Sign in</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Badges Row: Points + Trust Score (below logo) */}

        {/* Full-width Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={[
              styles.searchInput,
              isListening && { borderColor: "#ef4444" },
            ]}
            placeholder={
              isListening ? "Listening..." : "Search videos, channels..."
            }
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => handleSearch(searchQuery)}
            onFocus={() =>
              searchQuery.trim() && hints.length > 0 && setShowHints(true)
            }
            returnKeyType="search"
          />
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={() => handleSearch(searchQuery)}
            activeOpacity={0.7}
          >
            <Text style={styles.searchIcon}>🔍</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Hints Dropdown */}
      {showHints &&
        searchQuery.trim() &&
        (hintsLoading || hints.length > 0) && (
          <View style={styles.hintsBox}>
            <Text style={styles.hintsTitle}>
              {hintsLoading
                ? "Finding matching results..."
                : "Matching results"}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {hints.map((hint, i) => {
                const text =
                  typeof hint === "string"
                    ? hint
                    : hint.text || hint.title || hint.name || "";
                const type = hint.type || "";
                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.hintItem}
                    onPress={() => onHintClick(hint)}
                  >
                    <Text style={styles.hintIcon}>🔍</Text>
                    <Text style={styles.hintText} numberOfLines={1}>
                      {text}
                    </Text>
                    {type ? <Text style={styles.hintType}>{type}</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

      {/* Profile Dropdown Modal */}
      <Modal
        visible={isDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDropdownOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDropdownOpen(false)}
        >
          <View style={styles.dropdown}>
            {/* User Info */}
            <View style={styles.dropdownHeader}>
              <View style={styles.dropdownAvatar}>
                {user?.avatar ? (
                  <Image
                    source={{ uri: resolveAvatarUrl(user.avatar) }}
                    style={styles.dropdownAvatarImg}
                    onError={(event) =>
                      console.log("[Navbar] dropdown avatar load failed", {
                        uri: user.avatar,
                        error: event.nativeEvent.error,
                      })
                    }
                  />
                ) : (
                  <Text style={styles.dropdownAvatarText}>
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user?.name || "User"}
                </Text>
                <Text style={styles.userEmail} numberOfLines={1}>
                  {user?.email || "@username"}
                </Text>
                <Text style={styles.userPoints}>
                  ★ {Number(points).toFixed(0)} pts
                </Text>

                {/* Trust Score in dropdown */}
                <View style={styles.trustRow}>
                  <Text style={styles.trustIconSmall}>🛡️</Text>
                  <Text style={styles.trustScoreDropdown}>
                    Trust Score: {trustScore}/100
                  </Text>
                  <Text style={styles.trustTierText}>({trustTier})</Text>
                </View>

                <TouchableOpacity
                  style={styles.viewChannelBtn}
                  onPress={() => {
                    setIsDropdownOpen(false);
                    navigation.navigate("ChannelScreen", {
                      handle: user?._id || "me",
                    });
                  }}
                >
                  <Text style={styles.viewChannelText}>View your channel</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Menu Items */}
            <ScrollView style={{ maxHeight: 400 }}>
              <MenuItem
                icon="👤"
                label="My Profile"
                onPress={() => {
                  setIsDropdownOpen(false);
                  navigation.navigate("Profile");
                }}
              />
              <MenuItem
                icon="🎬"
                label="Vidoo Studio"
                onPress={() => {
                  setIsDropdownOpen(false);
                  navigation.navigate("Studio");
                }}
              />

              {/* Settings expandable */}
              {isSettingsOpen && (
                <View style={styles.subMenu}>
                  <MenuItem
                    icon="🕐"
                    label="History"
                    small
                    onPress={() => {
                      setIsDropdownOpen(false);
                      navigation.navigate("Profile", { tab: "history" });
                    }}
                  />
                  <MenuItem
                    icon="❤️"
                    label="Liked Videos"
                    small
                    onPress={() => {
                      setIsDropdownOpen(false);
                      navigation.navigate("LikedVideos");
                    }}
                  />
                  <MenuItem
                    icon="⏰"
                    label="Watch Later"
                    small
                    onPress={() => {
                      setIsDropdownOpen(false);
                      navigation.navigate("WatchLater");
                    }}
                  />
                  <MenuItem
                    icon="📹"
                    label="Your Videos"
                    small
                    onPress={() => {
                      setIsDropdownOpen(false);
                      navigation.navigate("YourVideos");
                    }}
                  />
                </View>
              )}

              <MenuItem
                icon="💰"
                label="Withdraw Rewards"
                onPress={() => {
                  setIsDropdownOpen(false);
                  navigation.navigate("Withdraw");
                }}
              />
              <MenuItem
                icon="🏆"
                label="Leaderboard"
                onPress={() => {
                  setIsDropdownOpen(false);
                  navigation.navigate("Leaderboard");
                }}
              />

              <View style={styles.divider} />

              <MenuItem icon="❓" label="FAQ" />
              <MenuItem
                icon="©️"
                label="Copyright Center"
                onPress={() => {
                  setIsDropdownOpen(false);
                  navigation.navigate("Copyright");
                }}
              />
              <MenuItem icon="💬" label="Feedback" />
              <MenuItem icon="📞" label="Customer Support" />
              <MenuItem
                icon="📄"
                label="Terms and Conditions"
                onPress={() => {
                  setIsDropdownOpen(false);
                  navigation.navigate("LegalSidebar");
                }}
              />
              <MenuItem
                icon="🔒"
                label="Advance Settings"
                onPress={() => {
                  setIsDropdownOpen(false);
                  navigation.navigate("LegalSidebar");
                }}
              />

              <TouchableOpacity
                style={[
                  styles.menuItem,
                  { borderTopWidth: 1, borderTopColor: "#27272a" },
                ]}
                onPress={handleSignOut}
              >
                <Text style={[styles.menuIcon, { color: "#f87171" }]}>🚪</Text>
                <Text style={[styles.menuLabel, { color: "#f87171" }]}>
                  Sign out
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
      <LogoutWarningModal
        visible={showLogoutWarning}
        onCancel={() => setShowLogoutWarning(false)}
        onConfirm={confirmSignOut}
      />
    </>
  );
}

function MenuItem({ icon, label, onPress = () => {}, small = false }) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, small && { paddingLeft: 36 }]}
      onPress={onPress}
    >
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  navbar: {
    backgroundColor: "#0f0f0f",
    borderBottomWidth: 1,
    borderBottomColor: "#1f1f1f",
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "ios" ? 48 : 40,
    paddingBottom: 12,
    zIndex: 100,
  },

  /* ===== Top Row: Logo + Avatar ===== */
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  logoSection: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 5,
  },
  logoImage: {
    width: 38,
    height: 38,
  },
  logoText: {
    color: "#ef4444",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  logoSearchBtn: {
    marginLeft: 3,
    width: 36,
    height: 36,
    borderRadius: 17,
    backgroundColor: "#1f1f1f",
    borderWidth: 1,
    borderColor: "#2d2d2d",
    alignItems: "center",
    justifyContent: "center",
  },
  logoSearchIcon: {
    fontSize: 15,
  },

  /* ===== Badges below logo ===== */
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    paddingLeft: 2,
  },
  pointsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(234,179,8,0.35)",
    gap: 4,
  },
  star: {
    color: "#facc15",
    fontSize: 13,
  },
  pointsText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  ptsLabel: {
    color: "#a1a1aa",
    fontSize: 11,
    fontWeight: "500",
  },

  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.4)",
    gap: 4,
  },
  trustIcon: {
    fontSize: 12,
  },
  trustScoreText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  trustLabel: {
    color: "#a1a1aa",
    fontSize: 11,
    fontWeight: "500",
  },

  /* ===== Full-width Search ===== */
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: "#2d2d2d",
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    color: "#fff",
    fontSize: 15,
    minHeight: 40,
  },
  searchBtn: {
    backgroundColor: "#1f1f1f",
    borderWidth: 1,
    borderColor: "#2d2d2d",
    borderLeftWidth: 0,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 48,
    minHeight: 40,
  },
  searchIcon: {
    fontSize: 17,
  },

  /* ===== Right side ===== */
  right: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  signInBtn: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
  },
  signInText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },

  /* ===== Hints ===== */
  hintsBox: {
    position: "absolute",
    top: Platform.OS === "ios" ? 155 : 145,
    left: 12,
    right: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2d2d2d",
    maxHeight: 280,
    zIndex: 200,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  hintsTitle: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hintItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
  },
  hintIcon: {
    fontSize: 14,
    color: "#9ca3af",
  },
  hintText: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
  },
  hintType: {
    color: "#6b7280",
    fontSize: 11,
  },

  /* ===== Dropdown Modal ===== */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: Platform.OS === "ios" ? 60 : 50,
    paddingRight: 12,
  },
  dropdown: {
    width: width * 0.85,
    maxWidth: 320,
    backgroundColor: "#0f0f0f",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2d2d2d",
    overflow: "hidden",
  },
  dropdownHeader: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1f1f1f",
    gap: 12,
  },
  dropdownAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  dropdownAvatarImg: {
    width: "100%",
    height: "100%",
  },
  dropdownAvatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  userName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  userEmail: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 2,
  },
  userPoints: {
    color: "#facc15",
    fontSize: 12,
    marginTop: 4,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 4,
  },
  trustIconSmall: {
    fontSize: 12,
  },
  trustScoreDropdown: {
    color: "#93c5fd",
    fontSize: 12,
  },
  trustTierText: {
    color: "#9ca3af",
    fontSize: 12,
    textTransform: "capitalize",
  },
  viewChannelBtn: {
    marginTop: 8,
    backgroundColor: "#272727",
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: "center",
  },
  viewChannelText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuIcon: {
    fontSize: 18,
    width: 24,
  },
  menuLabel: {
    color: "#e5e5e5",
    fontSize: 14,
    flex: 1,
  },
  subMenu: {
    backgroundColor: "#1a1a1a",
  },
  divider: {
    height: 1,
    backgroundColor: "#1f1f1f",
    marginVertical: 4,
  },
});
