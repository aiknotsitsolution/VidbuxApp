import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ArrowLeft, Wallet, AlertCircle, Check } from "lucide-react-native";
import { API_BASE } from "../../config/api";
import Navbar from "./Navbar";
import { showToast } from "../utils/notifications";
import AdminBottomTabs from "./AdminBottomTabs";

const WITHDRAWALS_ENABLED = false;

export default function WithdrawScreen() {
  const navigation = useNavigation<any>();

  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedMethod, setSelectedMethod] = useState(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  // UPI Form
  const [upiId, setUpiId] = useState("");
  const [upiName, setUpiName] = useState("");

  // Bank Form
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");

  const rupeeBalance = Number(points).toFixed(2);

  const methods = [
    {
      id: "upi",
      name: "UPI (Google Pay / PhonePe)",
      min: 5,
      fee: 0,
      icon: "₹",
    },
    {
      id: "bank",
      name: "Bank Transfer",
      min: 20,
      fee: 1.5,
      icon: "🏦",
    },
  ];

  // ─── Fetch Balance ───
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          navigation.replace("Login");
          return;
        }

        const res = await fetch(`${API_BASE}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to load balance");

        const data = await res.json();
        if (data.success && data.user) {
          const rewardPoints =
            data.user.rewardPoints || data.user.totalEarnings || 0;
          setPoints(Number(rewardPoints));
        }
      } catch (err) {
        console.warn(err);
        showToast("error", "Error", "Could not load balance");
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [navigation]);

  const resetForms = () => {
    setUpiId("");
    setUpiName("");
    setAccountName("");
    setAccountNumber("");
    setIfsc("");
    setBankName("");
  };

  const handleWithdraw = async () => {
    const withdrawAmount = parseFloat(amount);

    if (!WITHDRAWALS_ENABLED) {
      setError(
        "Withdrawals are not available yet. Your points remain in your account until VidBuxApp enables verified payouts.",
      );
      return;
    }

    if (!withdrawAmount || withdrawAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!selectedMethod) {
      setError("Select a withdrawal method");
      return;
    }
    if (withdrawAmount < selectedMethod.min) {
      setError(`Minimum withdrawal is ₹${selectedMethod.min}`);
      return;
    }
    if (withdrawAmount > parseFloat(rupeeBalance)) {
      setError("Insufficient balance");
      return;
    }

    // Validation
    if (selectedMethod.id === "upi") {
      if (!upiId.trim()) {
        setError("Please enter your UPI ID");
        return;
      }
      if (!upiName.trim()) {
        setError("Please enter your name");
        return;
      }
    }

    if (selectedMethod.id === "bank") {
      if (!accountName.trim()) {
        setError("Please enter Account Holder Name");
        return;
      }
      if (!accountNumber.trim()) {
        setError("Please enter Account Number");
        return;
      }
      if (!ifsc.trim()) {
        setError("Please enter IFSC Code");
        return;
      }
      if (!bankName.trim()) {
        setError("Please enter Bank Name");
        return;
      }
    }

    try {
      setSubmitting(true);
      setError("");

      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("Please login again");

      const payload: Record<string, string | number> = {
        amount: withdrawAmount,
        method: selectedMethod.id,
      };

      if (selectedMethod.id === "upi") {
        payload.upiId = upiId.trim();
        payload.name = upiName.trim();
      } else {
        payload.accountName = accountName.trim();
        payload.accountNumber = accountNumber.trim();
        payload.ifsc = ifsc.trim().toUpperCase();
        payload.bankName = bankName.trim();
      }

      // Backend call (uncomment when ready)
      // const res = await fetch(`${API_BASE}/withdraw`, {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //     Authorization: `Bearer ${token}`,
      //   },
      //   body: JSON.stringify(payload),
      // });
      // const data = await res.json();
      // if (!res.ok || !data.success) throw new Error(data.message || "Withdraw failed");

      // Success Toast
      showToast(
        "success",
        "Request Submitted",
        `₹${withdrawAmount.toFixed(2)} withdrawal request submitted! Money will be credited within 45 working days.`,
      );

      setAmount("");
      setSelectedMethod(null);
      resetForms();
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ff0000" />
        <Text style={styles.loadingText}>Loading balance...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
    >
      <Navbar onMenuPress={() => {}} points={0} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>VidBuxApp Points</Text>
              <Text style={styles.balanceValue}>
                {Number(points).toFixed(2)}
              </Text>
            </View>
            <Wallet size={48} color="#facc15" style={{ opacity: 0.85 }} />
          </View>
          <Text style={styles.pointsText}>
            Promotional points only. They are not cash until a verified
            VidBuxApp payout program is enabled.
          </Text>
        </View>

        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            Withdrawals are not available in this release. Do not send money or
            payment details to anyone claiming to represent VidBuxApp. Your
            points remain associated with your account.
          </Text>
        </View>

        {/* Select Method */}
        <Text style={styles.sectionTitle}>Select Withdrawal Method</Text>

        <View style={styles.methodsList}>
          {methods.map((method) => {
            const isSelected = selectedMethod?.id === method.id;
            return (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.methodCard,
                  !WITHDRAWALS_ENABLED && styles.methodCardDisabled,
                  isSelected && styles.methodCardActive,
                ]}
                onPress={() => {
                  if (!WITHDRAWALS_ENABLED) return;
                  setSelectedMethod(method);
                  setError("");
                  resetForms();
                }}
                activeOpacity={0.8}
              >
                <View style={styles.methodLeft}>
                  <View style={styles.methodIcon}>
                    <Text style={styles.methodIconText}>{method.icon}</Text>
                  </View>
                  <View>
                    <Text style={styles.methodName}>{method.name}</Text>
                    <Text style={styles.methodMeta}>
                      Min: ₹{method.min} • Fee: {method.fee}%
                    </Text>
                  </View>
                </View>
                {isSelected && <Check size={20} color="#3b82f6" />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Amount Input */}
        {selectedMethod && (
          <View style={styles.amountSection}>
            <Text style={styles.label}>Amount to Withdraw (INR)</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={(t) => {
                  setAmount(t);
                  setError("");
                }}
                placeholder="0.00"
                placeholderTextColor="#71717a"
                keyboardType="decimal-pad"
              />
            </View>

            {error ? (
              <View style={styles.errorRow}>
                <AlertCircle size={16} color="#f87171" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.feeHint}>
              You will receive ≈ ₹
              {(
                (parseFloat(amount) || 0) *
                (1 - selectedMethod.fee / 100)
              ).toFixed(2)}{" "}
              after fee
            </Text>
          </View>
        )}

        {/* ========== UPI FORM ========== */}
        {selectedMethod?.id === "upi" && (
          <View style={styles.formBox}>
            <Text style={styles.formTitle}>Enter Your UPI Details</Text>
            <Text style={styles.formSubtitle}>
              Money will be sent to this UPI ID
            </Text>

            <Text style={styles.label}>UPI ID *</Text>
            <TextInput
              style={styles.input}
              value={upiId}
              onChangeText={setUpiId}
              placeholder="yourname@upi / @paytm / @ybl"
              placeholderTextColor="#71717a"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.label}>Full Name (as per UPI) *</Text>
            <TextInput
              style={styles.input}
              value={upiName}
              onChangeText={setUpiName}
              placeholder="Enter full name"
              placeholderTextColor="#71717a"
            />
          </View>
        )}

        {/* ========== BANK FORM ========== */}
        {selectedMethod?.id === "bank" && (
          <View style={styles.formBox}>
            <Text style={styles.formTitle}>Enter Bank Account Details</Text>
            <Text style={styles.formSubtitle}>
              Money will be transferred to this account
            </Text>

            <Text style={styles.label}>Account Holder Name *</Text>
            <TextInput
              style={styles.input}
              value={accountName}
              onChangeText={setAccountName}
              placeholder="Full name as per bank account"
              placeholderTextColor="#71717a"
            />

            <Text style={styles.label}>Account Number *</Text>
            <TextInput
              style={styles.input}
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="Enter account number"
              placeholderTextColor="#71717a"
              keyboardType="number-pad"
            />

            <Text style={styles.label}>IFSC Code *</Text>
            <TextInput
              style={styles.input}
              value={ifsc}
              onChangeText={(t) => setIfsc(t.toUpperCase())}
              placeholder="e.g. SBIN0001234"
              placeholderTextColor="#71717a"
              autoCapitalize="characters"
              maxLength={11}
            />

            <Text style={styles.label}>Bank Name *</Text>
            <TextInput
              style={styles.input}
              value={bankName}
              onChangeText={setBankName}
              placeholder="e.g. State Bank of India"
              placeholderTextColor="#71717a"
            />
          </View>
        )}

        {/* Withdraw Button */}
        <TouchableOpacity
          style={[
            styles.withdrawBtn,
            !WITHDRAWALS_ENABLED && styles.withdrawBtnDisabled,
            (!selectedMethod ||
              !amount ||
              parseFloat(amount) <= 0 ||
              submitting) &&
              styles.withdrawBtnDisabled,
          ]}
          onPress={handleWithdraw}
          disabled={
            !WITHDRAWALS_ENABLED ||
            !selectedMethod ||
            !amount ||
            parseFloat(amount) <= 0 ||
            submitting
          }
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.withdrawBtnText}>
              {WITHDRAWALS_ENABLED ? "Withdraw Now" : "Withdrawals Unavailable"}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Any future payout will require account verification, eligibility
          checks, and an active VidBuxApp payout provider.
        </Text>
      </ScrollView>

      {/* Bottom Tabs */}
      <AdminBottomTabs navigation={navigation} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  center: {
    flex: 1,
    backgroundColor: "#0f0f0f",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#aaa",
    marginTop: 12,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#272727",
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },

  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 160,
  },

  balanceCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#333",
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  balanceLabel: {
    color: "#a1a1aa",
    fontSize: 14,
  },
  balanceValue: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "700",
    marginTop: 4,
  },
  pointsText: {
    color: "#71717a",
    fontSize: 13,
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 12,
  },

  methodsList: {
    marginBottom: 24,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  methodCardDisabled: {
    opacity: 0.55,
  },
  noticeBox: {
    backgroundColor: "#422006",
    borderColor: "#92400e",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  noticeText: {
    color: "#fde68a",
    fontSize: 13,
    lineHeight: 19,
  },
  methodCardActive: {
    borderColor: "#3b82f6",
    backgroundColor: "rgba(59, 130, 246, 0.12)",
  },
  methodLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  methodIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#272727",
    justifyContent: "center",
    alignItems: "center",
  },
  methodIconText: {
    fontSize: 18,
  },
  methodName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  methodMeta: {
    color: "#71717a",
    fontSize: 12,
    marginTop: 2,
  },

  amountSection: {
    marginBottom: 20,
  },
  label: {
    color: "#a1a1aa",
    fontSize: 13,
    marginBottom: 8,
    marginTop: 12,
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  currencySymbol: {
    color: "#a1a1aa",
    fontSize: 20,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    color: "#fff",
    fontSize: 20,
    paddingVertical: 14,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  errorText: {
    color: "#f87171",
    fontSize: 13,
  },
  feeHint: {
    color: "#71717a",
    fontSize: 12,
    marginTop: 8,
  },

  // Form Box
  formBox: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#333",
  },
  formTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  formSubtitle: {
    color: "#71717a",
    fontSize: 13,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
  },

  withdrawBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  withdrawBtnDisabled: {
    backgroundColor: "#3f3f46",
  },
  withdrawBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },

  footerNote: {
    color: "#71717a",
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
    marginBottom: 40,
    lineHeight: 20,
  },

});
