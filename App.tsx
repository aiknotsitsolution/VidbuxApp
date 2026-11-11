

import React from "react";
import AppNavigator from "./src/navigation/AppNavigator";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import Toast from "react-native-toast-message";
import { store } from "./src/store";
const App = () => (
  <Provider store={store}>
    <SafeAreaProvider>
      <AppNavigator />
      <Toast />
    </SafeAreaProvider>
  </Provider>
);

export default App;