import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ShieldAlert } from "lucide-react-native";

type LogoutWarningModalProps = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export default function LogoutWarningModal({
  visible,
  onCancel,
  onConfirm,
}: LogoutWarningModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.iconWrap}>
            <ShieldAlert size={26} color="#fbbf24" strokeWidth={2} />
          </View>
          <Text style={styles.eyebrow}>DEVICE SECURITY</Text>
          <Text style={styles.title}>Before you log out</Text>
          <Text style={styles.message}>
            If you log out from this device, you won't be able to sign in to any
            other account on this phone for the next 7 days, under our security
            rules.
          </Text>
          <View style={styles.notice}>
            <Text style={styles.noticeText}>7 DAYS</Text>
            <Text style={styles.noticeDescription}>
              No other account can be used on this phone
            </Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onCancel}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Stay logged in</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onConfirm}
              style={styles.logoutButton}
            >
              <Text style={styles.logoutText}>Log out anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "rgba(0, 0, 0, 0.76)",
  },
  dialog: {
    width: "100%",
    maxWidth: 380,
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
    alignItems: "center",
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#422006",
    borderWidth: 1,
    borderColor: "#854d0e",
    marginBottom: 16,
  },
  eyebrow: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  title: {
    color: "#fafafa",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 7,
    textAlign: "center",
  },
  message: {
    color: "#d4d4d8",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 12,
  },
  notice: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#272018",
    borderWidth: 1,
    borderColor: "#57421e",
  },
  noticeText: {
    color: "#fbbf24",
    fontSize: 12,
    fontWeight: "900",
  },
  noticeDescription: {
    flex: 1,
    color: "#e4e4e7",
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#52525b",
    backgroundColor: "#27272a",
  },
  cancelText: {
    color: "#f4f4f5",
    fontSize: 13,
    fontWeight: "700",
  },
  logoutButton: {
    flex: 1,
    minHeight: 46,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: "#dc2626",
  },
  logoutText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
});
