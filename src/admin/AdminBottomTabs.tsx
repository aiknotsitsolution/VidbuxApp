import React from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

interface AdminBottomTabsProps {
  navigation: NavigationProp<ParamListBase>;
}

const tabs = [
  { label: "Home", screen: "Home" },
  { label: "Shorts", screen: "Shorts" },
  { label: "Create", screen: "Create" },
  { label: "Subscriptions", screen: "Subscribe" },
  { label: "You", screen: "You" },
] as const;

export default function AdminBottomTabs({
  navigation,
}: AdminBottomTabsProps) {
  const insets = useSafeAreaInsets();

  const navigateToTab = (screen: string) => {
    const routeNames = navigation.getState().routeNames;
    if (routeNames.includes("MainTabs")) {
      navigation.navigate("MainTabs", { screen });
      return;
    }

    if (routeNames.includes("AdminPanel")) {
      navigation.navigate("AdminPanel", {
        screen: "MainTabs",
        params: { screen },
      });
      return;
    }

    navigation.navigate("MainTabs", { screen });
  };

  return (
    <View
      style={[
        styles.bottomTabs,
        {
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        },
      ]}
    >
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.label}
          style={tab.label === "Create" ? styles.centerTab : styles.tab}
          onPress={() => navigateToTab(tab.screen)}
          activeOpacity={0.8}
        >
          {tab.label === "Create" ? (
            <View style={styles.centerButton}>
              <Ionicons name="add" size={28} color="#fff" />
            </View>
          ) : tab.label === "Home" ? (
            <Ionicons name="home-outline" size={24} color="#a1a1aa" />
          ) : tab.label === "Shorts" ? (
            <MaterialCommunityIcons
              name="movie-open-play-outline"
              size={26}
              color="#a1a1aa"
            />
          ) : tab.label === "Subscriptions" ? (
            <MaterialCommunityIcons
              name="youtube-subscription"
              size={26}
              color="#a1a1aa"
            />
          ) : (
            <Image
              source={{ uri: "https://i.pravatar.cc/150?img=12" }}
              style={styles.profileImage}
            />
          )}
          <Text
            style={[
              styles.label,
              tab.label === "You" && styles.activeLabel,
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomTabs: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#0f0f0f",
    borderTopWidth: 0.5,
    borderTopColor: "#333",
    paddingTop: 6,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  centerTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  centerButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef4444",
  },
  profileImage: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.8,
    borderColor: "#ffffff",
  },
  label: {
    color: "#a1a1aa",
    fontSize: 11,
    fontWeight: "500",
    marginBottom: Platform.OS === "ios" ? 0 : 4,
  },
  activeLabel: {
    color: "#fff",
  },
});
