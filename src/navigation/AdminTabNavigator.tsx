import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, Image, StyleSheet, Platform, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import DashboardScreen from "../admin/DashboardScreen";
import ShortsScreen from "../admin/ShortsScreen";
import { ProfileScreen } from "../admin/ProfileScreen";
import VideoDetailScreen from "../admin/VideoDetailScreen";
import ChannelScreen from "../admin/ChannelScreen";
import Leaderboard from "../admin/Leaderboard";
import SubscribedChannels from "../admin/SubscribedChannels";
import WithdrawScreen from "../admin/Withdraw";
import ViewAll from "../admin/ViewAll";
import SearchPage from "../admin/SearchPage";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Fallback agar koi screen undefined ho
function FallbackScreen({ name }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0f0f0f",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff", fontSize: 16 }}>{name} screen missing</Text>
    </View>
  );
}

const ProfileRoute = ProfileScreen || FallbackScreen;

function TabNavigator() {
  const insets = useSafeAreaInsets();

  // Safety: undefined component crash na kare
  const YouScreen = ProfileScreen || (() => <FallbackScreen name="Profile" />);
  const SubscribeScreen =
    SubscribedChannels ||
    ShortsScreen ||
    (() => <FallbackScreen name="Subscribe" />);

  return (
    <Tab.Navigator
      id="admin-tabs"
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarStyle: {
          backgroundColor: "#0f0f0f",
          borderTopWidth: 0.5,
          borderTopColor: "#333",
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 6,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        },

        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: "#a1a1aa",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          marginBottom: Platform.OS === "ios" ? 0 : 4,
        },

        tabBarIcon: ({ focused, color }) => {
          if (route.name === "Home") {
            return (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={24}
                color={color}
              />
            );
          }

          if (route.name === "Shorts") {
            return (
              <MaterialCommunityIcons
                name={focused ? "movie-open-play" : "movie-open-play-outline"}
                size={26}
                color={color}
              />
            );
          }

          if (route.name === "Create") {
            return (
              <View
                style={[styles.createBtn, focused && styles.createBtnActive]}
              >
                <Ionicons name="add" size={28} color="#fff" />
              </View>
            );
          }

          // ✅ Valid icon name
          if (route.name === "Subscribe") {
            return (
              <MaterialCommunityIcons
                name={focused ? "youtube-subscription" : "youtube-subscription"}
                size={26}
                color={color}
              />
            );
          }

          if (route.name === "You") {
            return (
              <Image
                source={{
                  uri: "https://i.pravatar.cc/150?img=12",
                }}
                style={styles.profileImage}
              />
            );
          }

          return null;
        },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Shorts" component={ShortsScreen} />
      <Tab.Screen
        name="Create"
        component={ChannelScreen}
        options={{ tabBarLabel: "Create" }}
      />
      <Tab.Screen
        name="Subscribe"
        component={SubscribeScreen}
        options={{ tabBarLabel: "Subscriptions" }}
      />
      <Tab.Screen
        name="You"
        component={YouScreen}
        options={{ tabBarLabel: "You" }}
      />
    </Tab.Navigator>
  );
}

export default function AdminTabNavigator() {
  return (
    <Stack.Navigator id="admin-stack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="VideoDetail" component={VideoDetailScreen} />
      <Stack.Screen name="SubscribedChannels" component={SubscribedChannels} />
      <Stack.Screen name="Withdraw" component={WithdrawScreen} />
      <Stack.Screen name="ChannelScreen" component={ChannelScreen} />
      <Stack.Screen name="Profile" component={ProfileRoute} />
      <Stack.Screen name="Studio" component={ChannelScreen} />
      <Stack.Screen name="Leaderboard" component={Leaderboard} />
      <Stack.Screen name="ViewAll" component={ViewAll} />
      <Stack.Screen name="Search" component={SearchPage} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  createBtn: {
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ef4444",
    borderRadius: 8,
  },
  createBtnActive: {
    backgroundColor: "#dc2626",
  },
  profileImage: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.8,
    borderColor: "#ffffff",
  },
});
