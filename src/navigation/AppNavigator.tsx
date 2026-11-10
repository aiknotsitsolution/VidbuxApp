import React, { useEffect, useState } from "react";
import { AppState, Image, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import AdminTabNavigator from "./AdminTabNavigator";
import VideoDetailScreen from "../admin/VideoDetailScreen";
import CopyrightClaimPage from "../admin/CopyrightClaimPage";
import CopyrightScreen from "../screens/CopyrightClaimScreen";
import { API_ORIGIN } from "../../config/api";
import LegalSidebarScreen from "../admin/LegalSidebarScreen";
const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;
    let validating = false;

    const validateSession = async (initial = false) => {
      if (validating) return;
      validating = true;
      let token = null;
      try {
        token = await AsyncStorage.getItem("token");
        if (!token) {
          if (active) setHasSession(false);
          return;
        }

        const response = await fetch(`${API_ORIGIN}/api/me`, {
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        const user = data?.user;

        if (response.status === 401 || response.status === 403) {
          await AsyncStorage.multiRemove(["token", "user"]);
          if (active) setHasSession(false);
          return;
        }

        if (!response.ok) {
          if (active && initial) setHasSession(true);
          return;
        }

        if (!data?.success || !user) {
          await AsyncStorage.multiRemove(["token", "user"]);
          if (active) setHasSession(false);
          return;
        }

        await AsyncStorage.setItem("user", JSON.stringify(user));
        if (active) setHasSession(true);
      } catch {
        if (active && initial) setHasSession(Boolean(token));
      } finally {
        validating = false;
        if (active && initial) setSessionLoading(false);
      }
    };

    void validateSession(true);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void validateSession();
    });
    const sessionCheck = setInterval(() => {
      if (AppState.currentState === "active") void validateSession();
    }, 30000);

    return () => {
      active = false;
      clearInterval(sessionCheck);
      subscription.remove();
    };
  }, []);

  if (sessionLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0a0a0a",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          source={require("../../assets/VidBuxApp-logo.png")}
          style={{ width: 250, height: 207 }}
          resizeMode="contain"
          accessibilityLabel="VidBuxApp"
        />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        key={hasSession ? "authenticated" : "guest"}
        id="RootStack"
        initialRouteName="AdminPanel"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login">
          {(props) => (
            <LoginScreen
              {...props}
              onAuthenticated={() => setHasSession(true)}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="AdminPanel" component={AdminTabNavigator} />
        <Stack.Screen name="VideoDetail" component={VideoDetailScreen} />

        <Stack.Screen name="Copyright" component={CopyrightScreen} />
        <Stack.Screen name="CopyrightClaim" component={CopyrightClaimPage} />
        <Stack.Screen
          name="LegalSidebar"
          component={LegalSidebarScreen}
          options={{ headerShown: false }}
        />
        {/* <Stack.Screen name="SubscribedChannels" component={SubscribedChannels} /> */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
