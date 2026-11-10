import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Platform,
} from "react-native";
import Video from "react-native-video";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
// Ya: import Icon from "react-native-vector-icons/Ionicons";

const { height, width } = Dimensions.get("window");

const shortsData = [
  {
    id: "s1",
    title: "Amazing Nature Moments",
    views: "2.6M views",
    likes: "145K",
    comments: "3.2K",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: "s2",
    title: "Cute Cats Compilation",
    views: "4.2M views",
    likes: "220K",
    comments: "8.5K",
    videoUrl: "https://www.w3schools.com/html/movie.mp4",
  },
  // Aur videos add kar sakte ho
];

export default function ShortsScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liked, setLiked] = useState({});
  const [muted, setMuted] = useState(true);
  const videoRefs = useRef({});

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const index = viewableItems[0].index;
      setCurrentIndex(index);
    }
  }, []);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 80,
  };

  const toggleLike = (id) => {
    setLiked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleMute = () => {
    setMuted((prev) => !prev);
  };

  const renderItem = ({ item, index }) => {
    const isActive = index === currentIndex;

    return (
      <View style={styles.videoContainer}>
        <Video
          ref={(ref) => {
            videoRefs.current[index] = ref;
          }}
          source={{ uri: item.videoUrl }}
          style={styles.video}
          resizeMode="cover"
          paused={!isActive}
          repeat
          muted={muted}
        />

        {/* Dark overlay */}
        <View style={styles.overlay} />

        {/* Bottom Left Info */}
        <View style={styles.bottomLeft}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.views}>{item.views}</Text>
          <View style={styles.audioRow}>
            <MaterialCommunityIcons name="music" size={16} color="#fff" />
            <Text style={styles.audioText}>Original Audio</Text>
          </View>
        </View>

        {/* Right Side Buttons */}
        <View style={styles.rightButtons}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => toggleLike(item.id)}
          >
            <Ionicons
              name={liked[item.id] ? "heart" : "heart-outline"}
              size={32}
              color={liked[item.id] ? "#ff2d55" : "#fff"}
            />
            <Text style={styles.iconText}>{item.likes}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="chatbubble-outline" size={30} color="#fff" />
            <Text style={styles.iconText}>{item.comments}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="share-social-outline" size={30} color="#fff" />
            <Text style={styles.iconText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} onPress={toggleMute}>
            <Ionicons
              name={muted ? "volume-mute" : "volume-high"}
              size={30}
              color="#fff"
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="ellipsis-horizontal" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <FlatList
        data={shortsData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        // Performance
        removeClippedSubviews
        maxToRenderPerBatch={2}
        windowSize={3}
        initialNumToRender={1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  videoContainer: {
    width: width,
    height: height,
    backgroundColor: "#000",
  },
  video: {
    ...StyleSheet.absoluteFill,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  bottomLeft: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 100 : 80,
    left: 16,
    right: 100,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  views: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    marginBottom: 6,
  },
  audioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  audioText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
  },
  rightButtons: {
    position: "absolute",
    right: 12,
    bottom: Platform.OS === "ios" ? 120 : 100,
    alignItems: "center",
    gap: 22,
  },
  iconBtn: {
    alignItems: "center",
  },
  iconText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 3,
    fontWeight: "500",
  },
});
