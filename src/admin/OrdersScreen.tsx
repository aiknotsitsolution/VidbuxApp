import React from "react";
import { View, FlatList } from "react-native";
import ordersData from "../data/ordersData";
import ListItem from "../components/ListItem";
import styles from "../styles/globalStyles";

export default function OrdersScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={ordersData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ListItem title={item.product} subtitle={`₹ ${item.amount}`} />
        )}
      />
    </View>
  );
}
