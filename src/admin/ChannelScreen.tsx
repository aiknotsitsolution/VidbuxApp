import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  FlatList,
} from "react-native";
import {
  Edit,
  Video as VideoIcon,
  Plus,
  X,
  Play,
  Users,
  Search,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { API_ORIGIN } from "../../config/api";
import { showToast } from "../utils/notifications";
import Navbar from "./Navbar";
import { useRoute } from "@react-navigation/native";
import AdminBottomTabs from "./AdminBottomTabs";
const { width } = Dimensions.get("window");

const API_BASE = `${API_ORIGIN}/api`;
const API_CATEGORY = `${API_ORIGIN}/api/category`;
const BACKEND_URL = API_ORIGIN;

const STATIC_CATEGORIES = [
  { _id: "1", name: "Gaming" },
  { _id: "2", name: "Education" },
  { _id: "3", name: "Entertainment" },
  { _id: "4", name: "Music" },
  { _id: "5", name: "Technology" },
  { _id: "6", name: "Sports" },
  { _id: "7", name: "Cooking" },
  { _id: "8", name: "Travel" },
  {
    _id: "creative-corner",
    name: "Creative Corner",
    slug: "creative-corner",
    isCreativeCorner: true,
  },
];

export default function ChannelScreen({ navigation }) {
  const route = useRoute();
  const [channels, setChannels] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const [channel, setChannel] = useState(null);
  const [videos, setVideos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Videos");
  const [videoType, setVideoType] = useState("short"); // short or long
  // Create Channel Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannel, setNewChannel] = useState({
    name: "",
    channelDescription: "",
    category: "",
    hashtags: "",
    channelImageUri: null,
    channelBannerUri: null,
    channelImageAsset: null, // ← add this
    channelBannerAsset: null, // ← add this
    contactemail: "",
  });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  // Upload Video Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedUploadChannelId, setSelectedUploadChannelId] = useState("");
  const [videoUri, setVideoUri] = useState(null);
  const [videoName, setVideoName] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [videoCategory, setVideoCategory] = useState("");
  const [videoHashtags, setVideoHashtags] = useState("");
  const [thumbnailUri, setThumbnailUri] = useState(null);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  const getVideoType = (video) => {
    const rawType = video?.videoType;
    const types = Array.isArray(rawType) ? rawType : [rawType];
    return types.map((type) => String(type).toLowerCase());
  };

  const longVideos = videos.filter((video) =>
    getVideoType(video).includes("long"),
  );
  const shortVideos = videos.filter((video) =>
    getVideoType(video).includes("short"),
  );

  const getToken = async () => await AsyncStorage.getItem("token");

  const handleSessionExpired = async () => {
    await AsyncStorage.multiRemove(["token", "user"]);
    navigation.replace("Login");
  };

  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return `${BACKEND_URL}/${path.replace(/\\/g, "/")}`;
  };

  // ================= FETCH CATEGORIES =================
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(API_CATEGORY);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        const apiCategories = Array.isArray(data) ? data : [];
        const hasCreativeCorner = apiCategories.some(
          (category) =>
            category.isCreativeCorner ||
            category.slug === "creative-corner" ||
            category.name?.toLowerCase() === "creative corner",
        );
        setCategories(
          apiCategories.length > 0
            ? hasCreativeCorner
              ? apiCategories
              : [
                  ...apiCategories,
                  STATIC_CATEGORIES.find(
                    (category) => category.isCreativeCorner,
                  ),
                ]
            : STATIC_CATEGORIES,
        );
      } catch (e) {
        setCategories(STATIC_CATEGORIES);
      }
    };
    fetchCategories();
  }, []);

  // ================= FETCH USER CHANNELS =================
  useEffect(() => {
    const fetchChannels = async () => {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        setShowCreateModal(true);
        return;
      }

      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/uservideo/channel`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          await handleSessionExpired();
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch channels");

        const data = await res.json();
        const userChannels = data.channels || [];
        setChannels(userChannels);

        if (userChannels.length > 0) {
          setSelectedChannelId(userChannels[0]._id);
          setChannel(userChannels[0]);
        } else {
          setShowCreateModal(true);
        }
      } catch (err) {
        console.log(err);
        setShowCreateModal(true);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, []);

  // ================= FETCH VIDEOS =================
  useEffect(() => {
    if (!selectedChannelId) return;

    const fetchVideos = async () => {
      const token = await getToken();
      if (!token) return;

      try {
        const res = await fetch(
          `${API_BASE}/uservideo/channel/${selectedChannelId}/videos`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (res.ok) {
          const result = await res.json();
          setVideos(result.videos || []);
        }
      } catch (err) {
        console.log("Videos fetch error", err);
      }
    };

    fetchVideos();
  }, [selectedChannelId]);

  // ================= IMAGE / VIDEO PICKER =================
  // ================= IMAGE / VIDEO PICKER =================
  const pickImage = async (type) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];

      if (type === "avatar") {
        setNewChannel((prev) => ({
          ...prev,
          channelImageUri: asset.uri,
          channelImageAsset: asset, // full asset save kar rahe hain
        }));
      } else if (type === "banner") {
        setNewChannel((prev) => ({
          ...prev,
          channelBannerUri: asset.uri,
          channelBannerAsset: asset,
        }));
      } else if (type === "thumbnail") {
        setThumbnailUri(asset.uri);
        // thumbnail ke liye bhi asset rakh sakte ho agar chahiye
      }
    }
  };

  const pickVideo = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "video/*",
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      setVideoUri(result.assets[0].uri);
    }
  };

  // ================= CREATE CHANNEL =================
  const handleCreateChannel = async () => {
    const token = await getToken();
    if (!token) {
      setCreateError("Please login first");
      return;
    }
    if (!newChannel.name.trim()) {
      setCreateError("Channel name is required");
      return;
    }
    if (!newChannel.category) {
      setCreateError("Please select a category");
      return;
    }

    const selectedCategory = categories.find(
      (category) =>
        String(category._id) === String(newChannel.category) ||
        category.slug === newChannel.category,
    );
    const isCreativeCornerCategory =
      selectedCategory?.isCreativeCorner ||
      selectedCategory?.slug === "creative-corner" ||
      selectedCategory?.name?.toLowerCase() === "creative corner";
    if (isCreativeCornerCategory && !newChannel.hashtags.trim()) {
      setCreateError("Add at least one hashtag for Other (Creative Corner)");
      return;
    }

    try {
      setCreating(true);
      setCreateError("");

      const formData = new FormData();

      formData.append("name", newChannel.name.trim());
      formData.append(
        "channeldescription",
        newChannel.channelDescription || "",
      );
      formData.append("category", newChannel.category);
      formData.append("hashtags", newChannel.hashtags);
      formData.append("contactemail", newChannel.contactemail || "");

      // Avatar
      if (newChannel.channelImageAsset) {
        const asset = newChannel.channelImageAsset;
        formData.append("channelImage", {
          uri: asset.uri,
          type: asset.mimeType || "image/jpeg",
          name: asset.fileName || `avatar_${Date.now()}.jpg`,
        } as any);
      }

      // Banner
      if (newChannel.channelBannerAsset) {
        const asset = newChannel.channelBannerAsset;
        formData.append("channelBanner", {
          uri: asset.uri,
          type: asset.mimeType || "image/jpeg",
          name: asset.fileName || `banner_${Date.now()}.jpg`,
        } as any);
      }

      console.log("Sending with XMLHttpRequest...");

      // ========== XMLHttpRequest (yeh important hai) ==========
      const result: any = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open("POST", `${API_BASE}/uservideo/createchannel`);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        // Content-Type mat set karo

        xhr.onload = () => {
          try {
            const response = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(response);
            } else {
              const requestError: any = new Error(
                response.message || `Error ${xhr.status}`,
              );
              requestError.status = xhr.status;
              reject(requestError);
            }
          } catch (e) {
            reject(new Error("Invalid server response"));
          }
        };

        xhr.onerror = () => reject(new Error("Network error"));
        xhr.ontimeout = () => reject(new Error("Request timeout"));

        xhr.send(formData);
      });

      console.log("Create success →", result);

      // Refresh channels
      const channelsRes = await fetch(`${API_BASE}/uservideo/channel`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (channelsRes.ok) {
        const data = await channelsRes.json();
        const updated = data.channels || [];
        setChannels(updated);
        setSelectedChannelId(result.channel._id);
        setChannel(result.channel);
      }

      // Reset form
      setNewChannel({
        name: "",
        channelDescription: "",
        category: "",
        hashtags: "",
        channelImageUri: null,
        channelBannerUri: null,
        channelImageAsset: null,
        channelBannerAsset: null,
        contactemail: "",
      });
      setShowCreateModal(false);

      setSelectedUploadChannelId(result.channel._id);
      setShowUploadModal(true);

      showToast("success", "Channel created successfully!");
    } catch (error) {
      console.log("Create channel error →", error);
      if (error.status === 401) {
        await handleSessionExpired();
        return;
      }
      setCreateError(error.message || "Failed to create channel");
    } finally {
      setCreating(false);
    }
  };

  // ================= UPLOAD VIDEO =================
  const handleUploadVideo = async () => {
    const token = await getToken();
    if (!token) {
      setUploadError("Please login first");
      return;
    }
    if (!selectedUploadChannelId) {
      setUploadError("Please select a channel");
      return;
    }
    if (!videoUri) {
      setUploadError("Please select a video file");
      return;
    }
    if (!videoName.trim()) {
      setUploadError("Please enter a video title");
      return;
    }
    if (!videoCategory) {
      setUploadError("Please select a category");
      return;
    }
    const selectedVideoCategory = categories.find(
      (category) =>
        String(category._id) === String(videoCategory) ||
        category.slug === videoCategory,
    );
    const isCreativeCornerVideo =
      selectedVideoCategory?.isCreativeCorner ||
      selectedVideoCategory?.slug === "creative-corner" ||
      selectedVideoCategory?.name?.toLowerCase() === "creative corner";
    if (isCreativeCornerVideo && !videoHashtags.trim()) {
      setUploadError("Add at least one hashtag for Creative Corner videos");
      return;
    }
    if (!agreeTerms) {
      setUploadError("Please agree to the terms");
      return;
    }

    try {
      setUploading(true);
      setUploadError("");

      const formData = new FormData();
      formData.append("name", videoName.trim());
      formData.append("description", videoDescription || "");
      formData.append("category", videoCategory);
      formData.append("videoType", videoType); // ← Web jaisa important field
      formData.append("isCreativeCorner", String(isCreativeCornerVideo));
      formData.append("hashtags", videoHashtags);

      // Video file
      formData.append("video", {
        uri: videoUri,
        type: "video/mp4",
        name: `video_${Date.now()}.mp4`,
      } as any);

      // Thumbnail (optional)
      if (thumbnailUri) {
        formData.append("thumbnail", {
          uri: thumbnailUri,
          type: "image/jpeg",
          name: `thumbnail_${Date.now()}.jpg`,
        } as any);
      }

      // ========== XMLHttpRequest (same as create channel) ==========
      const result: any = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `${API_BASE}/uservideo/upload/${selectedUploadChannelId}`,
        );
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.onload = () => {
          try {
            const response = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(response);
            } else {
              reject(new Error(response.message || `Error ${xhr.status}`));
            }
          } catch (e) {
            reject(new Error("Invalid server response"));
          }
        };

        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(formData);
      });

      showToast("success", "Video uploaded successfully!");

      // Refresh videos
      const videosRes = await fetch(
        `${API_BASE}/uservideo/channel/${selectedChannelId}/videos`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (videosRes.ok) {
        const data = await videosRes.json();
        setVideos(data.videos || []);
      }

      // Reset form
      setShowUploadModal(false);
      setVideoUri(null);
      setVideoName("");
      setVideoDescription("");
      setVideoCategory("");
      setVideoHashtags("");
      setVideoType("short");
      setThumbnailUri(null);
      setAgreeTerms(false);
    } catch (error) {
      console.log("Upload error →", error);
      setUploadError(error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ================= LOADING =================
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
        <Text style={styles.loadingText}>Loading channel...</Text>
      </View>
    );
  }

  const currentChannel = channel || {
    name: "Your Channel",
    channelImage: null,
    channelBanner: null,
    channeldescription: "Create your channel to get started.",
    subscribers: 0,
  };

  const selectedChannelCategory = categories.find(
    (category) =>
      String(category._id) === String(newChannel.category) ||
      category.slug === newChannel.category,
  );
  const isCreativeCornerChannel =
    selectedChannelCategory?.isCreativeCorner ||
    selectedChannelCategory?.slug === "creative-corner" ||
    selectedChannelCategory?.name?.toLowerCase() === "creative corner";
  const selectedVideoCategory = categories.find(
    (category) =>
      String(category._id) === String(videoCategory) ||
      category.slug === videoCategory,
  );
  const isCreativeCornerVideo =
    selectedVideoCategory?.isCreativeCorner ||
    selectedVideoCategory?.slug === "creative-corner" ||
    selectedVideoCategory?.name?.toLowerCase() === "creative corner";

  const bannerUrl =
    getImageUrl(currentChannel.channelBanner) ||
    "https://images.unsplash.com/photo-1557683316-973673baf926?w=1200";
  const avatarUrl =
    getImageUrl(currentChannel.channelImage) ||
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400";

  const tabs = ["Videos", "Shorts"];

  const handleVideoPress = (video) => {
    const videoId = video?._id || video?.id;
    const videoTypes = Array.isArray(video?.videoType)
      ? video.videoType
      : [video?.videoType];
    const isShort = videoTypes.some(
      (type) => String(type).toLowerCase() === "short",
    );

    if (isShort) {
      navigation.navigate("MainTabs", {
        screen: "Shorts",
        params: { video },
      });
      return;
    }

    navigation.navigate("VideoDetail", {
      id: videoId,
      item: video,
      video,
    });
  };

  // ================= RENDER VIDEO ITEM =================
  const renderVideo = ({ item }) => {
    const thumb =
      getImageUrl(item.thumbnail) ||
      "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800";

    return (
      <TouchableOpacity
        style={styles.videoCard}
        activeOpacity={0.85}
        onPress={() => handleVideoPress(item)}
      >
        <View style={styles.thumbnailWrapper}>
          <Image source={{ uri: thumb }} style={styles.thumbnail} />
          <View style={styles.playOverlay}>
            <View style={styles.playBtn}>
              <Play size={22} color="#fff" fill="#fff" />
            </View>
          </View>
        </View>
        <Text style={styles.videoTitle} numberOfLines={2}>
          {item.title || item.name}
        </Text>
        <Text style={styles.videoMeta}>
          {Number(item.views ?? item.viewCount ?? 0).toLocaleString()} views
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Navbar onMenuPress={() => {}} points={0} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          route.name === "Create" ? undefined : styles.stackContent
        }
      >
        {/* ========== BANNER ========== */}
        <View style={styles.bannerContainer}>
          <Image source={{ uri: bannerUrl }} style={styles.banner} />
        </View>

        {/* ========== AVATAR + INFO ========== */}
        <View style={styles.profileSection}>
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />

          <Text style={styles.channelName}>{currentChannel.name}</Text>
          <Text style={styles.channelHandle}>
            @{currentChannel.name?.replace(/\s+/g, "") || "yourchannel"}
          </Text>

          <View style={styles.statsRow}>
            <Text style={styles.statText}>
              {(currentChannel.subscribers || 0).toLocaleString()} subscribers
            </Text>
            <Text style={styles.statDot}>•</Text>
            <Text style={styles.statText}>{videos.length} videos</Text>
          </View>

          {currentChannel.channeldescription ? (
            <Text style={styles.description} numberOfLines={3}>
              {currentChannel.channeldescription}
            </Text>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setShowCreateModal(true)}
            >
              <Plus size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Create</Text>
            </TouchableOpacity>

            {channels.length > 0 && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.uploadActionBtn]}
                onPress={() => {
                  setSelectedUploadChannelId(
                    selectedChannelId || channels[0]._id,
                  );
                  setShowUploadModal(true);
                }}
              >
                <VideoIcon size={16} color="#fff" />
                <Text style={styles.actionBtnText}>Upload</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ========== CHANNEL SWITCHER ========== */}
        {channels.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.switcher}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {channels.map((ch) => (
              <TouchableOpacity
                key={ch._id}
                style={[
                  styles.switcherChip,
                  selectedChannelId === ch._id && styles.switcherChipActive,
                ]}
                onPress={() => {
                  setSelectedChannelId(ch._id);
                  setChannel(ch);
                }}
              >
                <Text
                  style={[
                    styles.switcherText,
                    selectedChannelId === ch._id && styles.switcherTextActive,
                  ]}
                >
                  {ch.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ========== TABS ========== */}
        <View style={styles.tabsContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ========== TAB CONTENT ========== */}
        <View style={styles.tabContent}>
          {activeTab === "Videos" && (
            <>
              {longVideos.length > 0 ? (
                <FlatList
                  data={longVideos}
                  keyExtractor={(item) => item._id}
                  renderItem={renderVideo}
                  numColumns={2}
                  scrollEnabled={false}
                  columnWrapperStyle={{ gap: 10 }}
                  contentContainerStyle={{ gap: 14 }}
                />
              ) : (
                <View style={styles.emptyState}>
                  <VideoIcon size={48} color="#52525b" />
                  <Text style={styles.emptyTitle}>No videos yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Upload your first video to get started
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyBtn}
                    onPress={() => {
                      if (channels.length > 0) {
                        setSelectedUploadChannelId(
                          selectedChannelId || channels[0]._id,
                        );
                        setShowUploadModal(true);
                      } else {
                        setShowCreateModal(true);
                      }
                    }}
                  >
                    <Text style={styles.emptyBtnText}>
                      {channels.length > 0 ? "Upload Video" : "Create Channel"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {activeTab === "Shorts" && (
            <>
              {shortVideos.length > 0 ? (
                <FlatList
                  data={shortVideos}
                  keyExtractor={(item) => item._id}
                  renderItem={renderVideo}
                  numColumns={2}
                  scrollEnabled={false}
                  columnWrapperStyle={{ gap: 10 }}
                  contentContainerStyle={{ gap: 14 }}
                />
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No Shorts yet</Text>
                </View>
              )}
            </>
          )}

          {activeTab === "Playlists" && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No playlists yet</Text>
            </View>
          )}

          {activeTab === "Posts" && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No community posts yet</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ================= CREATE CHANNEL MODAL ================= */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create a new channel</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {createError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{createError}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Channel name *</Text>
              <TextInput
                style={styles.input}
                placeholder="My Awesome Channel"
                placeholderTextColor="#71717a"
                value={newChannel.name}
                onChangeText={(t) => setNewChannel({ ...newChannel, name: t })}
              />

              <Text style={styles.label}>Category *</Text>
              <View style={styles.selectBox}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat._id}
                    style={[
                      styles.categoryChip,
                      (newChannel.category === cat._id ||
                        newChannel.category === cat.slug) &&
                        styles.categoryChipActive,
                    ]}
                    onPress={() =>
                      setNewChannel({
                        ...newChannel,
                        category: cat.slug || cat._id,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        (newChannel.category === cat._id ||
                          newChannel.category === cat.slug) &&
                          styles.categoryTextActive,
                      ]}
                    >
                      {cat.isCreativeCorner ||
                      cat.slug === "creative-corner" ||
                      cat.name?.toLowerCase() === "creative corner"
                        ? "Other (Creative Corner)"
                        : cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {isCreativeCornerChannel && (
                <>
                  <Text style={styles.label}>Hashtags *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="#Cooking, #Vlog"
                    placeholderTextColor="#71717a"
                    value={newChannel.hashtags}
                    onChangeText={(t) =>
                      setNewChannel({ ...newChannel, hashtags: t })
                    }
                  />
                </>
              )}

              <Text style={styles.label}>Channel Image (avatar)</Text>
              <TouchableOpacity
                style={styles.pickBtn}
                onPress={() => pickImage("avatar")}
              >
                <Text style={styles.pickBtnText}>
                  {newChannel.channelImageUri ? "Change Avatar" : "Pick Avatar"}
                </Text>
              </TouchableOpacity>
              {newChannel.channelImageUri && (
                <Image
                  source={{ uri: newChannel.channelImageUri }}
                  style={styles.avatarPreview}
                />
              )}

              <Text style={styles.label}>Channel Banner</Text>
              <TouchableOpacity
                style={styles.pickBtn}
                onPress={() => pickImage("banner")}
              >
                <Text style={styles.pickBtnText}>
                  {newChannel.channelBannerUri
                    ? "Change Banner"
                    : "Pick Banner"}
                </Text>
              </TouchableOpacity>
              {newChannel.channelBannerUri && (
                <Image
                  source={{ uri: newChannel.channelBannerUri }}
                  style={styles.bannerPreview}
                />
              )}

              <Text style={styles.label}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Tell people about your channel..."
                placeholderTextColor="#71717a"
                multiline
                value={newChannel.channelDescription}
                onChangeText={(t) =>
                  setNewChannel({ ...newChannel, channelDescription: t })
                }
              />

              <Text style={styles.label}>Contact email (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="example@email.com"
                placeholderTextColor="#71717a"
                keyboardType="email-address"
                autoCapitalize="none"
                value={newChannel.contactemail}
                onChangeText={(t) =>
                  setNewChannel({ ...newChannel, contactemail: t })
                }
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setShowCreateModal(false)}
                >
                  <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.createBtn]}
                  onPress={handleCreateChannel}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>Create channel</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= UPLOAD VIDEO MODAL ================= */}
      <Modal visible={showUploadModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Video</Text>
              <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {uploadError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{uploadError}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Upload to channel *</Text>
              <View style={styles.selectBox}>
                {channels.map((ch) => (
                  <TouchableOpacity
                    key={ch._id}
                    style={[
                      styles.categoryChip,
                      selectedUploadChannelId === ch._id &&
                        styles.categoryChipActive,
                    ]}
                    onPress={() => setSelectedUploadChannelId(ch._id)}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        selectedUploadChannelId === ch._id &&
                          styles.categoryTextActive,
                      ]}
                    >
                      {ch.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Video file *</Text>
              <TouchableOpacity style={styles.pickBtn} onPress={pickVideo}>
                <Text style={styles.pickBtnText}>
                  {videoUri ? "Change Video" : "Select Video"}
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>Thumbnail (optional)</Text>
              <TouchableOpacity
                style={styles.pickBtn}
                onPress={() => pickImage("thumbnail")}
              >
                <Text style={styles.pickBtnText}>
                  {thumbnailUri ? "Change Thumbnail" : "Pick Thumbnail"}
                </Text>
              </TouchableOpacity>
              {thumbnailUri && (
                <Image
                  source={{ uri: thumbnailUri }}
                  style={styles.bannerPreview}
                />
              )}

              {/* Video Type - Short / Long */}
              <Text style={styles.label}>Video Type</Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
                <TouchableOpacity
                  style={[
                    styles.categoryChip,
                    videoType === "short" && styles.categoryChipActive,
                    { flex: 1, alignItems: "center" },
                  ]}
                  onPress={() => setVideoType("short")}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      videoType === "short" && styles.categoryTextActive,
                    ]}
                  >
                    Short
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.categoryChip,
                    videoType === "long" && styles.categoryChipActive,
                    { flex: 1, alignItems: "center" },
                  ]}
                  onPress={() => setVideoType("long")}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      videoType === "long" && styles.categoryTextActive,
                    ]}
                  >
                    Long
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Video Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter video title"
                placeholderTextColor="#71717a"
                value={videoName}
                onChangeText={setVideoName}
              />

              <Text style={styles.label}>Video Category *</Text>
              <View style={styles.selectBox}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat._id}
                    style={[
                      styles.categoryChip,
                      (videoCategory === cat._id ||
                        videoCategory === cat.slug) &&
                        styles.categoryChipActive,
                    ]}
                    onPress={() => setVideoCategory(cat.slug || cat._id)}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        (videoCategory === cat._id ||
                          videoCategory === cat.slug) &&
                          styles.categoryTextActive,
                      ]}
                    >
                      {cat.isCreativeCorner ||
                      cat.slug === "creative-corner" ||
                      cat.name?.toLowerCase() === "creative corner"
                        ? "Other (Creative Corner)"
                        : cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {isCreativeCornerVideo && (
                <>
                  <Text style={styles.label}>Hashtags *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="#Cooking, #Vlog"
                    placeholderTextColor="#71717a"
                    value={videoHashtags}
                    onChangeText={setVideoHashtags}
                  />
                </>
              )}

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Describe your video..."
                placeholderTextColor="#71717a"
                multiline
                value={videoDescription}
                onChangeText={setVideoDescription}
              />

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAgreeTerms(!agreeTerms)}
              >
                <View
                  style={[
                    styles.checkbox,
                    agreeTerms && styles.checkboxChecked,
                  ]}
                >
                  {agreeTerms && (
                    <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text>
                  )}
                </View>
                <Text style={styles.checkboxLabel}>
                  I agree to the Terms of Service and confirm I own/have rights
                  to this content.
                </Text>
              </TouchableOpacity>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setShowUploadModal(false)}
                  disabled={uploading}
                >
                  <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.uploadBtn]}
                  onPress={handleUploadVideo}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>Upload</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {route.name !== "Create" && (
        <AdminBottomTabs navigation={navigation} />
      )}
    </View>
  );
}

// ================= STYLES (YouTube Mobile Style) =================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  stackContent: {
    paddingBottom: 112,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0f0f0f",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#a1a1aa",
    marginTop: 12,
  },

  // Banner
  bannerContainer: {
    height: 140,
    backgroundColor: "#1a1a1a",
  },
  banner: {
    width: "100%",
    height: "100%",
  },

  // Profile
  profileSection: {
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: -42,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: "#0f0f0f",
    backgroundColor: "#272727",
  },
  channelName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginTop: 12,
    textAlign: "center",
  },
  channelHandle: {
    fontSize: 14,
    color: "#a1a1aa",
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  statText: {
    fontSize: 13,
    color: "#a1a1aa",
  },
  statDot: {
    color: "#71717a",
  },
  description: {
    fontSize: 13,
    color: "#d4d4d8",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    marginBottom: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#272727",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  uploadActionBtn: {
    backgroundColor: "#ef4444",
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },

  // Channel switcher
  switcher: {
    marginTop: 12,
    marginBottom: 4,
  },
  switcherChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    marginRight: 8,
  },
  switcherChipActive: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  switcherText: {
    color: "#a1a1aa",
    fontSize: 13,
  },
  switcherTextActive: {
    color: "#000",
    fontWeight: "600",
  },

  // Tabs
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#272727",
    marginTop: 12,
    paddingHorizontal: 8,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#fff",
  },
  tabText: {
    color: "#a1a1aa",
    fontSize: 14,
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#fff",
  },

  // Tab content
  tabContent: {
    padding: 12,
    minHeight: 300,
  },

  // Video grid
  videoCard: {
    flex: 1,
    maxWidth: (width - 34) / 2,
  },
  thumbnailWrapper: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
    opacity: 0,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(239,68,68,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  videoTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 6,
    lineHeight: 17,
  },
  videoMeta: {
    color: "#a1a1aa",
    fontSize: 11,
    marginTop: 2,
  },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: 50,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  emptySubtitle: {
    color: "#a1a1aa",
    fontSize: 13,
    marginTop: 4,
  },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: "#ef4444",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyBtnText: {
    color: "#fff",
    fontWeight: "600",
  },

  // Modal (same as before)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  errorBox: {
    backgroundColor: "#450a0a",
    borderWidth: 1,
    borderColor: "#991b1b",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
  },
  label: {
    color: "#d4d4d8",
    fontSize: 13,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
  },
  textarea: {
    height: 80,
    textAlignVertical: "top",
  },
  selectBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#272727",
    borderWidth: 1,
    borderColor: "#333",
  },
  categoryChipActive: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  categoryText: {
    color: "#a1a1aa",
    fontSize: 13,
  },
  categoryTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  pickBtn: {
    backgroundColor: "#272727",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  pickBtnText: {
    color: "#fff",
    fontSize: 14,
  },
  avatarPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginTop: 10,
  },
  bannerPreview: {
    width: "100%",
    height: 100,
    borderRadius: 12,
    marginTop: 10,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#52525b",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  checkboxLabel: {
    flex: 1,
    color: "#a1a1aa",
    fontSize: 12,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 24,
    marginBottom: 10,
  },
  modalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  cancelBtn: {
    backgroundColor: "#3f3f46",
  },
  createBtn: {
    backgroundColor: "#2563eb",
  },
  uploadBtn: {
    backgroundColor: "#16a34a",
  },
  btnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
