

import React from "react";
import AppNavigator from "./src/navigation/AppNavigator";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
const App = () => (
  <SafeAreaProvider>
    <AppNavigator />
    <Toast />
  </SafeAreaProvider>
);

export default App;