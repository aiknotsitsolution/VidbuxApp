import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function ListItem({
  title,
  subtitle,
  onPress = () => {},
  onEdit = undefined,
  onDelete = undefined,
}) {
  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      <View style={styles.actions}>
        {onEdit && (
          <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
            <Text style={styles.btnText}>Edit</Text>
          </TouchableOpacity>
        )}

        {onDelete && (
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.btnText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  editBtn: {
    backgroundColor: "#28a745",
    padding: 6,
    borderRadius: 6,
  },
  deleteBtn: {
    backgroundColor: "#dc3545",
    padding: 6,
    borderRadius: 6,
  },
  btnText: {
    color: "#fff",
    fontSize: 12,
  },
});
