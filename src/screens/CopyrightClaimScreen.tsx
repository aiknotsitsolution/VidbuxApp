import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { API_ORIGIN } from "../../config/api";
import { showToast } from "../utils/notifications";
import AdminBottomTabs from "../admin/AdminBottomTabs";
import Navbar from "../admin/Navbar";

type StrikeStatus = "active" | "expired" | "disputed" | "removed" | string;

interface StrikeContent {
  title?: string;
}

interface StrikeDispute {
  filedAt?: string;
}

interface Strike {
  _id: string;
  status: StrikeStatus;
  createdAt?: string;
  expiresAt?: string;
  reason?: string;
  content?: StrikeContent;
  dispute?: StrikeDispute;
}

interface StrikesResponse {
  success?: boolean;
  message?: string;
  data?: {
    strikes?: Strike[];
    activeCount?: number;
  };
}

export default function CopyrightScreen() {
  const navigation = useNavigation<any>();

  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [activeCount, setActiveCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [disputeStrikeId, setDisputeStrikeId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // =========================================================
  // GET TOKEN
  // =========================================================

  const getToken = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      return token;
    } catch (error) {
      console.log("Token error:", error);
      return null;
    }
  };

  // =========================================================
  // FETCH COPYRIGHT STRIKES
  // =========================================================

  const fetchStrikes = useCallback(async () => {
    setLoading(true);
    setError(null);

    const token = await getToken();

    if (!token) {
      setError("Please login to view your copyright strikes");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_ORIGIN}/api/copyright/my-strikes`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      const data: StrikesResponse = await response.json();

      if (data.success) {
        setStrikes(data.data?.strikes || []);
        setActiveCount(data.data?.activeCount || 0);
      } else {
        setError(data.message || "Failed to load strikes");
      }
    } catch (err) {
      console.log("Failed to fetch strikes:", err);
      setError("Failed to load copyright information");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    fetchStrikes();
  }, [fetchStrikes]);

  // =========================================================
  // REFRESH
  // =========================================================

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStrikes();
  };

  // =========================================================
  // SUBMIT COUNTER NOTIFICATION
  // =========================================================

  const handleDispute = async (strikeId: string) => {
    if (!disputeReason.trim()) {
      showToast(
        "error",
        "Reason Required",
        "Please explain why you believe this strike was issued in error.",
      );
      return;
    }

    const token = await getToken();

    if (!token) {
      showToast("error", "Login Required", "Please login first.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        `${API_ORIGIN}/api/copyright/counter-notification`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            strikeId,
            reason: disputeReason.trim(),
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        showToast(
          "success",
          "Submitted",
          "Your counter-notification has been submitted successfully.",
        );

        setDisputeStrikeId(null);
        setDisputeReason("");

        await fetchStrikes();
      } else {
        showToast(
          "error",
          "Submission Failed",
          data.message || "Failed to submit counter-notification.",
        );
      }
    } catch (err) {
      console.log("Failed to submit dispute:", err);

      showToast(
        "error",
        "Error",
        "Failed to submit counter-notification. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================
  // FORMAT DATE
  // =========================================================

  const formatDate = (date?: string) => {
    if (!date) return "-";

    try {
      return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  };

  // =========================================================
  // FORMAT EXPIRY
  // =========================================================

  const formatExpiry = (date?: string) => {
    if (!date) return "-";

    try {
      const expiryDate = new Date(date);
      const now = new Date();

      const difference = expiryDate.getTime() - now.getTime();

      if (difference <= 0) {
        return "Expired";
      }

      const days = Math.ceil(
        difference / (1000 * 60 * 60 * 24)
      );

      return `${days} days remaining`;
    } catch {
      return "-";
    }
  };

  // =========================================================
  // STATUS CONFIG
  // =========================================================

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "active":
        return {
          label: "Active",
          color: "#f87171",
          background: "rgba(239,68,68,0.15)",
          border: "rgba(239,68,68,0.3)",
          icon: "warning-outline" as keyof typeof Ionicons.glyphMap,
        };

      case "expired":
        return {
          label: "Expired",
          color: "#a1a1aa",
          background: "rgba(113,113,122,0.15)",
          border: "rgba(113,113,122,0.3)",
          icon: "time-outline" as keyof typeof Ionicons.glyphMap,
        };

      case "disputed":
        return {
          label: "Disputed",
          color: "#fb923c",
          background: "rgba(249,115,22,0.15)",
          border: "rgba(249,115,22,0.3)",
          icon: "warning-outline" as keyof typeof Ionicons.glyphMap,
        };

      case "removed":
        return {
          label: "Removed",
          color: "#34d399",
          background: "rgba(16,185,129,0.15)",
          border: "rgba(16,185,129,0.3)",
          icon: "checkmark-circle-outline" as keyof typeof Ionicons.glyphMap,
        };

      default:
        return {
          label:
            status?.charAt(0).toUpperCase() +
              status?.slice(1) || "Unknown",
          color: "#a1a1aa",
          background: "rgba(113,113,122,0.15)",
          border: "rgba(113,113,122,0.3)",
          icon: "warning-outline" as keyof typeof Ionicons.glyphMap,
        };
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <Navbar onMenuPress={() => {}} points={0} />
        <View style={styles.centerContainer}>
          <ActivityIndicator
            size="large"
            color="#ef4444"
          />

          <Text style={styles.loadingText}>
            Loading copyright information...
          </Text>
        </View>
        <AdminBottomTabs navigation={navigation} />
      </View>
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (error) {
    return (
      <View style={styles.container}>
        <Navbar onMenuPress={() => {}} points={0} />
        <View style={styles.centerContainer}>
          <View style={styles.errorIconContainer}>
            <Ionicons
              name="warning-outline"
              size={52}
              color="#ef4444"
            />
          </View>

          <Text style={styles.errorText}>
            {error}
          </Text>

          <Pressable
            style={styles.retryButton}
            onPress={fetchStrikes}
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color="#ffffff"
            />

            <Text style={styles.retryButtonText}>
              Retry
            </Text>
          </Pressable>
        </View>
        <AdminBottomTabs navigation={navigation} />
      </View>
    );
  }

  // =========================================================
  // MAIN UI
  // =========================================================

  return (
    <View style={styles.container}>
      <Navbar onMenuPress={() => {}} points={0} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ef4444"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>
              Copyright Center
            </Text>

            <Text style={styles.subtitle}>
              View your copyright strikes and submit
              counter-notifications
            </Text>
          </View>

          <Pressable
            style={styles.claimButton}
            onPress={() => {
              navigation.navigate("CopyrightClaim");
            }}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color="#ffffff"
            />

            <Text style={styles.claimButtonText}>
              File a Claim
            </Text>
          </Pressable>
        </View>

        {/* ================================================= */}
        {/* ACTIVE STRIKES WARNING */}
        {/* ================================================= */}

        {activeCount > 0 && (
          <View style={styles.warningBox}>
            <View style={styles.warningIcon}>
              <Ionicons
                name="warning-outline"
                size={22}
                color="#f87171"
              />
            </View>

            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>
                You have {activeCount} active copyright strike
                {activeCount > 1 ? "s" : ""}
              </Text>

              <Text style={styles.warningDescription}>
                Active strikes may affect your account standing.
                You can file a counter-notification if you believe
                the strike was issued in error.
              </Text>
            </View>
          </View>
        )}

        {/* ================================================= */}
        {/* NO STRIKES */}
        {/* ================================================= */}

        {strikes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons
                name="checkmark-circle-outline"
                size={72}
                color="#34d399"
              />
            </View>

            <Text style={styles.emptyTitle}>
              No copyright strikes
            </Text>

            <Text style={styles.emptySubtitle}>
              Your account is in good standing
            </Text>
          </View>
        ) : (
          <View style={styles.strikesContainer}>
            {strikes.map((strike) => {
              const statusConfig = getStatusConfig(
                strike.status
              );

              const canDispute =
                strike.status === "active";

              const isDisputeOpen =
                disputeStrikeId === strike._id;

              return (
                <View
                  key={strike._id}
                  style={styles.strikeCard}
                >
                  <View style={styles.strikeCardContent}>
                    {/* ===================================== */}
                    {/* STRIKE HEADER */}
                    {/* ===================================== */}

                    <View style={styles.strikeHeader}>
                      <View
                        style={[
                          styles.statusIconContainer,
                          {
                            backgroundColor:
                              statusConfig.background,
                          },
                        ]}
                      >
                        <Ionicons
                          name={statusConfig.icon}
                          size={23}
                          color={statusConfig.color}
                        />
                      </View>

                      <View style={styles.strikeInfo}>
                        {/* STATUS + DATE */}

                        <View style={styles.statusRow}>
                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor:
                                  statusConfig.background,
                                borderColor:
                                  statusConfig.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                {
                                  color:
                                    statusConfig.color,
                                },
                              ]}
                            >
                              {statusConfig.label}
                            </Text>
                          </View>

                          <Text style={styles.issuedText}>
                            Issued{" "}
                            {formatDate(
                              strike.createdAt
                            )}
                          </Text>
                        </View>

                        {/* CONTENT TITLE */}

                        <Text style={styles.contentTitle}>
                          {strike.content?.title ||
                            "Untitled content"}
                        </Text>

                        {/* REASON */}

                        {strike.reason && (
                          <Text style={styles.reasonText}>
                            Reason: {strike.reason}
                          </Text>
                        )}

                        {/* EXPIRY */}

                        <View style={styles.expiryRow}>
                          <Ionicons
                            name="calendar-outline"
                            size={14}
                            color="#71717a"
                          />

                          <Text style={styles.expiryText}>
                            Expires:{" "}
                            {formatExpiry(
                              strike.expiresAt
                            )}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* ===================================== */}
                    {/* DISPUTE FORM */}
                    {/* ===================================== */}

                    {canDispute && isDisputeOpen && (
                      <View style={styles.disputeContainer}>
                        <Text style={styles.disputeTitle}>
                          Submit Counter-Notification
                        </Text>

                        <Text style={styles.disputeDescription}>
                          Explain why you believe this strike
                          was issued in error. Provide any
                          supporting evidence.
                        </Text>

                        <TextInput
                          value={disputeReason}
                          onChangeText={setDisputeReason}
                          placeholder="I believe this strike was issued in error because..."
                          placeholderTextColor="#71717a"
                          multiline
                          numberOfLines={6}
                          textAlignVertical="top"
                          style={styles.disputeInput}
                          editable={!submitting}
                        />

                        <View style={styles.disputeActions}>
                          <Pressable
                            style={[
                              styles.submitDisputeButton,
                              (!disputeReason.trim() ||
                                submitting) &&
                                styles.disabledButton,
                            ]}
                            disabled={
                              submitting ||
                              !disputeReason.trim()
                            }
                            onPress={() =>
                              handleDispute(
                                strike._id
                              )
                            }
                          >
                            {submitting ? (
                              <ActivityIndicator
                                size="small"
                                color="#ffffff"
                              />
                            ) : (
                              <Ionicons
                                name="send-outline"
                                size={17}
                                color="#ffffff"
                              />
                            )}

                            <Text style={styles.submitDisputeText}>
                              {submitting
                                ? "Submitting..."
                                : "Submit Counter-Notification"}
                            </Text>
                          </Pressable>

                          <Pressable
                            style={styles.cancelButton}
                            disabled={submitting}
                            onPress={() => {
                              setDisputeStrikeId(null);
                              setDisputeReason("");
                            }}
                          >
                            <Text style={styles.cancelButtonText}>
                              Cancel
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    )}

                    {/* ===================================== */}
                    {/* DISPUTED STATUS */}
                    {/* ===================================== */}

                    {strike.status === "disputed" &&
                      strike.dispute && (
                        <View style={styles.disputedBox}>
                          <View style={styles.disputedHeader}>
                            <Ionicons
                              name="time-outline"
                              size={18}
                              color="#fb923c"
                            />

                            <Text style={styles.disputedTitle}>
                              Counter-notification under review
                            </Text>
                          </View>

                          <Text style={styles.disputedText}>
                            Filed on{" "}
                            {formatDate(
                              strike.dispute.filedAt
                            )}{" "}
                            — Our team will review your case.
                          </Text>
                        </View>
                      )}

                    {/* ===================================== */}
                    {/* ACTION BUTTON */}
                    {/* ===================================== */}

                    {canDispute && !isDisputeOpen && (
                      <Pressable
                        style={styles.disputeButton}
                        onPress={() => {
                          setDisputeStrikeId(
                            strike._id
                          );
                          setDisputeReason("");
                        }}
                      >
                        <Ionicons
                          name="send-outline"
                          size={17}
                          color="#f87171"
                        />

                        <Text style={styles.disputeButtonText}>
                          File Counter-Notification
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <AdminBottomTabs navigation={navigation} />
    </View>
  );
}

// ===========================================================
// STYLES
// ===========================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090b",
  },

  scrollView: {
    flex: 1,
  },

  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 112,
  },

  // =========================================================
  // CENTER
  // =========================================================

  centerContainer: {
    flex: 1,
    backgroundColor: "#09090b",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  loadingText: {
    marginTop: 14,
    color: "#a1a1aa",
    fontSize: 14,
  },

  errorIconContainer: {
    marginBottom: 12,
    opacity: 0.7,
  },

  errorText: {
    color: "#a1a1aa",
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 18,
  },

  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#27272a",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 9,
  },

  retryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },

  // =========================================================
  // HEADER
  // =========================================================

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 24,
  },

  headerTextContainer: {
    flex: 1,
  },

  title: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "800",
  },

  subtitle: {
    color: "#a1a1aa",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },

  claimButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#4f46e5",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 10,
  },

  claimButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },

  // =========================================================
  // WARNING
  // =========================================================

  warningBox: {
    flexDirection: "row",
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.30)",
    borderRadius: 13,
    padding: 15,
    marginBottom: 20,
  },

  warningIcon: {
    marginRight: 11,
    paddingTop: 1,
  },

  warningContent: {
    flex: 1,
  },

  warningTitle: {
    color: "#f87171",
    fontSize: 14,
    fontWeight: "700",
  },

  warningDescription: {
    color: "#a1a1aa",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  // =========================================================
  // EMPTY
  // =========================================================

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 90,
  },

  emptyIconContainer: {
    opacity: 0.55,
    marginBottom: 12,
  },

  emptyTitle: {
    color: "#d4d4d8",
    fontSize: 20,
    fontWeight: "600",
  },

  emptySubtitle: {
    color: "#71717a",
    fontSize: 14,
    marginTop: 7,
  },

  // =========================================================
  // STRIKES
  // =========================================================

  strikesContainer: {
    gap: 14,
  },

  strikeCard: {
    backgroundColor: "rgba(24,24,27,0.92)",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 14,
    overflow: "hidden",
  },

  strikeCardContent: {
    padding: 16,
  },

  strikeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  statusIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  strikeInfo: {
    flex: 1,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  issuedText: {
    color: "#71717a",
    fontSize: 11,
  },

  contentTitle: {
    color: "#d4d4d8",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 9,
    lineHeight: 20,
  },

  reasonText: {
    color: "#71717a",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    gap: 5,
  },

  expiryText: {
    color: "#71717a",
    fontSize: 12,
  },

  // =========================================================
  // DISPUTE
  // =========================================================

  disputeContainer: {
    marginTop: 16,
    padding: 14,
    backgroundColor: "rgba(39,39,42,0.55)",
    borderWidth: 1,
    borderColor: "rgba(63,63,70,0.8)",
    borderRadius: 12,
  },

  disputeTitle: {
    color: "#d4d4d8",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },

  disputeDescription: {
    color: "#71717a",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 11,
  },

  disputeInput: {
    minHeight: 120,
    backgroundColor: "#09090b",
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#ffffff",
    fontSize: 13,
    lineHeight: 19,
  },

  disputeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },

  submitDisputeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#dc2626",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 9,
    flex: 1,
  },

  submitDisputeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },

  disabledButton: {
    opacity: 0.5,
  },

  cancelButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },

  cancelButtonText: {
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "600",
  },

  // =========================================================
  // DISPUTED
  // =========================================================

  disputedBox: {
    marginTop: 13,
    padding: 12,
    backgroundColor: "rgba(249,115,22,0.10)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.20)",
    borderRadius: 9,
  },

  disputedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  disputedTitle: {
    color: "#fb923c",
    fontSize: 12,
    fontWeight: "700",
  },

  disputedText: {
    color: "#71717a",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  // =========================================================
  // DISPUTE BUTTON
  // =========================================================

  disputeButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },

  disputeButtonText: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "600",
  },
});