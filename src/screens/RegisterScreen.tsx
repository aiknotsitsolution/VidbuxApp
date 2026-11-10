import React from "react";
import { View, Text } from "react-native";
import CustomInput from "../components/CustomInput";
import CustomButton from "../components/CustomButton";
import styles from "../styles/globalStyles";
import { API_BASE, API_PLATFORM_HEADER } from "../../config/api";
import { showToast } from "../utils/notifications";
import { getClientHardwareUuid } from "./deviceId";
import { getSignupIntegrityProof } from "../utils/signupIntegrity";

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleRegister = async () => {
    if (!email || !password) {
      showToast("error", "Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      const clientHardwareUuid = await getClientHardwareUuid();
      const integrityProof = await getSignupIntegrityProof();

      const response = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...API_PLATFORM_HEADER,
        },
        body: JSON.stringify({
          name: email.split("@")[0],
          email,
          password,
          clientHardwareUuid,
          ...integrityProof,
        }),
      });

      const data = await response.json();
      console.log(data);
      if (response.ok) {
        showToast("success", "Registration Successful");
        navigation.replace("Login");
      } else {
        showToast("error", data.message || "Registration Failed");
      }
    } catch (error) {
      console.log(error);
      showToast(
        "error",
        error instanceof Error ? error.message : "Server Error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>

      <CustomInput placeholder="Email" value={email} onChangeText={setEmail} />

      <CustomInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <CustomButton
        title={loading ? "Registering..." : "Register"}
        onPress={handleRegister}
      />

      <Text style={styles.link} onPress={() => navigation.navigate("Login")}>
        Already have an account? Login
      </Text>
    </View>
  );
}
