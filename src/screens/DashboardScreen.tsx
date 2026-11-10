import React from "react";
import { View, Text, FlatList } from "react-native";
import DashboardCard from "../components/DashboardCard";
import dummyData from "../data/dummyData";
import styles from "../styles/globalStyles";

export default function DashboardScreen({ route, navigation }) {
  const userEmail = route?.params?.userEmail || "Guest";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <Text>Welcome: {userEmail}</Text>

      <FlatList
        data={dummyData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DashboardCard title={item.title} value={item.value} />
        )}
      />
    </View>
  );
}
