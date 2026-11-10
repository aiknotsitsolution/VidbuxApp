import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  Send,
  Shield,
  Search,
  CheckCircle,
  AlertTriangle,
  FileText,
  Film,
  X,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_ORIGIN } from "../../config/api";
import Navbar from "./Navbar";
import { SafeAreaView } from "react-native-safe-area-context";
import AdminBottomTabs from "./AdminBottomTabs";
// ---------- Types ----------
type ClaimType = "takedown" | "infringement";

interface ClaimForm {
  claimantName: string;
  claimantEmail: string;
  claimantPhone: string;
  claimantOrganization: string;
  videoId: string;
  claimType: ClaimType;
  claimDescription: string;
  originalWork: string;
  originalWorkUrl: string;
}

interface VideoItem {
  _id: string;
  title: string;
  thumbnail?: string;
  videoUrl?: string;
}

interface SubmitResult {
  caseNumber?: string;
  reference?: string;
}

interface LookupResult {
  caseNumber: string;
  status: string;
  filedAt?: string;
  claimType?: string;
  source?: string;
  claimDescription?: string;
  resolution?: {
    decision?: string;
    reason?: string;
  };
}

const claimTypes: { value: ClaimType; label: string }[] = [
  { value: "takedown", label: "Takedown Request" },
  { value: "infringement", label: "Infringement Notice" },
];

const statusColors: Record<string, string> = {
  pending: "#facc15",
  under_review: "#60a5fa",
  more_information_required: "#fb923c",
  takedown_approved: "#ef4444",
  takedown_rejected: "#a1a1aa",
  resolved: "#22c55e",
  withdrawn: "#a1a1aa",
};

const statusLabels: Record<string, string> = {
  pending: "Pending Review",
  under_review: "Under Review",
  more_information_required: "More Information Required",
  takedown_approved: "Takedown Approved",
  takedown_rejected: "Takedown Rejected",
  resolved: "Resolved",
  withdrawn: "Withdrawn",
};

// ---------- Debounce hook ----------
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

// ---------- VideoSearchSelect ----------
interface VideoSearchSelectProps {
  label: string;
  placeholder: string;
  onSelect: (video: VideoItem) => void;
  selectedVideo: VideoItem | null;
  onClear: () => void;
}

function VideoSearchSelect({
  label,
  placeholder,
  onSelect,
  selectedVideo,
  onClear,
}: VideoSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    AsyncStorage.getItem("token").then(setToken);
  }, []);

  const searchMyVideos = useCallback(
    async (q: string): Promise<VideoItem[]> => {
      if (!token) return [];
      try {
        const res = await fetch(
          `${API_ORIGIN}/api/copyright/my-videos/search?q=${encodeURIComponent(q)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await res.json();
        return data.data || [];
      } catch {
        return [];
      }
    },
    [token],
  );

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchMyVideos(debouncedQuery)
      .then((items) => {
        if (!cancelled) setResults(items);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, searchMyVideos]);

  const handleSelect = (item: VideoItem) => {
    onSelect(item);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    onClear();
    setQuery("");
    setResults([]);
  };

  return (
    <View style={styles.relative}>
      <Text style={styles.label}>{label}</Text>

      {selectedVideo ? (
        <View style={styles.selectedVideoRow}>
          <Film size={14} color="#ef4444" />
          <Text style={styles.selectedVideoTitle} numberOfLines={1}>
            {selectedVideo.title}
          </Text>
          <TouchableOpacity onPress={handleClear} hitSlop={8}>
            <X size={14} color="#a1a1aa" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.searchInputWrapper}>
          <Search size={16} color="#71717a" style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setOpen(true);
            }}
            onFocus={() => query.trim() && setOpen(true)}
            placeholder={
              token ? placeholder : "Login to search your videos (optional)"
            }
            placeholderTextColor="#71717a"
            editable={!!token}
            style={[
              styles.input,
              styles.searchInput,
              !token && styles.disabledInput,
            ]}
          />
          {loading && (
            <ActivityIndicator
              size="small"
              color="#a1a1aa"
              style={styles.spinnerRight}
            />
          )}
        </View>
      )}

      {open && results.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={results}
            keyExtractor={(item) => item._id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => handleSelect(item)}
              >
                {item.thumbnail ? (
                  <Image
                    source={{ uri: item.thumbnail }}
                    style={styles.thumb}
                  />
                ) : (
                  <View style={styles.thumbPlaceholder}>
                    <Film size={12} color="#71717a" />
                  </View>
                )}
                <Text style={styles.dropdownTitle} numberOfLines={1}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {open && debouncedQuery.trim() && !loading && results.length === 0 && (
        <View style={styles.dropdownEmpty}>
          <Text style={styles.emptyText}>No videos found</Text>
        </View>
      )}
    </View>
  );
}

// ---------- Main Screen ----------
export default function CopyrightClaimPage() {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<"submit" | "lookup">("submit");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const route = useRoute<any>();
  const preloadedVideoId: string = route.params?.videoId || "";
  const preloadedTitle: string = route.params?.title || "";

  const [form, setForm] = useState<ClaimForm>({
    claimantName: "",
    claimantEmail: "",
    claimantPhone: "",
    claimantOrganization: "",
    videoId: preloadedVideoId,
    claimType: "takedown",
    claimDescription: "",
    originalWork: "",
    originalWorkUrl: "",
  });

  const [selectedOriginalWork, setSelectedOriginalWork] =
    useState<VideoItem | null>(null);

  const [lookupRef, setLookupRef] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const handleChange = (name: keyof ClaimForm, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors([]);
  };

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!form.claimantName.trim()) errs.push("Your full name is required");
    if (
      !form.claimantEmail.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.claimantEmail.trim())
    ) {
      errs.push("A valid email address is required");
    }
    if (!form.videoId.trim()) {
      errs.push("The Video ID of the infringing content is required");
    }
    if (!form.claimDescription.trim()) {
      errs.push("A description of the copyright violation is required");
    }
    if (!form.originalWork.trim()) {
      errs.push("Title of your original work is required");
    }
    return errs;
  };

  const handleSubmit = async () => {
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const token = await AsyncStorage.getItem("token");

      const res = await fetch(`${API_ORIGIN}/api/copyright/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          claimantName: form.claimantName.trim(),
          claimantEmail: form.claimantEmail.trim(),
          claimantPhone: form.claimantPhone.trim(),
          claimantOrganization: form.claimantOrganization.trim(),
          videoId: form.videoId.trim(),
          claimType: form.claimType,
          claimDescription: form.claimDescription.trim(),
          originalWork: form.originalWork.trim(),
          originalWorkUrl: form.originalWorkUrl.trim(),
          declaration: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSubmitResult(data.data);
        setSelectedOriginalWork(null);
        setForm({
          claimantName: "",
          claimantEmail: "",
          claimantPhone: "",
          claimantOrganization: "",
          videoId: "",
          claimType: "takedown",
          claimDescription: "",
          originalWork: "",
          originalWorkUrl: "",
        });
      } else {
        setErrors([data.message || "Failed to submit claim"]);
      }
    } catch (err) {
      console.error("Claim submission error:", err);
      setErrors(["An error occurred. Please try again."]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLookup = async () => {
    if (!lookupRef.trim()) return;

    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const res = await fetch(
        `${API_ORIGIN}/api/copyright/claim/${encodeURIComponent(
          lookupRef.trim(),
        )}`,
      );
      const data = await res.json();
      if (data.success) {
        setLookupResult(data.data);
      } else {
        setLookupError(data.message || "Claim not found");
      }
    } catch (err) {
      console.error("Lookup error:", err);
      setLookupError("Failed to look up claim status");
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <Navbar onMenuPress={() => {}} points={0} />

      <KeyboardAvoidingView
        style={styles.contentArea}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.badge}>
              <Shield size={16} color="#ef4444" />
              <Text style={styles.badgeText}>Copyright Protection</Text>
            </View>
            <Text style={styles.title}>Copyright Claim Center</Text>
            <Text style={styles.subtitle}>
              Report a video that uses your copyrighted work without permission,
              or check the status of a claim you've already submitted.
            </Text>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === "submit" && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab("submit")}
            >
              <Send
                size={16}
                color={activeTab === "submit" ? "#fff" : "#a1a1aa"}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "submit" && styles.tabTextActive,
                ]}
              >
                Submit a Claim
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === "lookup" && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab("lookup")}
            >
              <Search
                size={16}
                color={activeTab === "lookup" ? "#fff" : "#a1a1aa"}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "lookup" && styles.tabTextActive,
                ]}
              >
                Check Status
              </Text>
            </TouchableOpacity>
          </View>

          {/* ===== SUBMIT TAB ===== */}
          {activeTab === "submit" && (
            <View>
              {submitResult && (
                <View style={styles.successBox}>
                  <View style={styles.successIconWrap}>
                    <CheckCircle size={24} color="#22c55e" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.successTitle}>
                      Claim Submitted Successfully
                    </Text>
                    <Text style={styles.successDesc}>
                      Your copyright claim has been filed. Save your reference
                      number to check the status later.
                    </Text>
                    <View style={styles.refBox}>
                      <Text style={styles.refLabel}>Your Reference Number</Text>
                      <Text style={styles.refValue}>
                        {submitResult.caseNumber || submitResult.reference}
                      </Text>
                    </View>
                    <Text style={styles.successHint}>
                      Our team will review your claim. You can use the "Check
                      Status" tab to monitor progress.
                    </Text>
                  </View>
                </View>
              )}

              {errors.length > 0 && (
                <View style={styles.errorBox}>
                  <AlertTriangle size={20} color="#fca5a5" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    {errors.map((err, i) => (
                      <Text key={i} style={styles.errorText}>
                        {err}
                      </Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Your Information */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your Information</Text>
                <Text style={styles.sectionSubtitle}>
                  Tell us who is submitting this claim.
                </Text>

                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.label}>Full Name *</Text>
                    <TextInput
                      value={form.claimantName}
                      onChangeText={(v) => handleChange("claimantName", v)}
                      placeholder="Enter your full name"
                      placeholderTextColor="#71717a"
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.label}>Email Address *</Text>
                    <TextInput
                      value={form.claimantEmail}
                      onChangeText={(v) => handleChange("claimantEmail", v)}
                      placeholder="Enter your email address"
                      placeholderTextColor="#71717a"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={styles.input}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.label}>Phone (optional)</Text>
                    <TextInput
                      value={form.claimantPhone}
                      onChangeText={(v) => handleChange("claimantPhone", v)}
                      placeholder="Enter your phone number"
                      placeholderTextColor="#71717a"
                      keyboardType="phone-pad"
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.label}>Organization (optional)</Text>
                    <TextInput
                      value={form.claimantOrganization}
                      onChangeText={(v) =>
                        handleChange("claimantOrganization", v)
                      }
                      placeholder="Company, creator name, or organization"
                      placeholderTextColor="#71717a"
                      style={styles.input}
                    />
                  </View>
                </View>
              </View>

              {/* Content to Report */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Content You Want to Report
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Tell us which video uses your copyrighted work.
                </Text>

                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.label}>Video to Report *</Text>
                    {preloadedVideoId ? (
                      <View style={styles.preloadedVideo}>
                        <Film size={16} color="#ef4444" />
                        <Text style={styles.preloadedTitle} numberOfLines={1}>
                          {preloadedTitle || "Unknown Video"}
                        </Text>
                      </View>
                    ) : (
                      <>
                        <TextInput
                          value={form.videoId}
                          onChangeText={(v) => handleChange("videoId", v)}
                          placeholder="Paste the Video ID from the URL"
                          placeholderTextColor="#71717a"
                          style={styles.input}
                        />
                        <Text style={styles.hint}>
                          Find it in the video URL: /video/
                          <Text style={{ color: "#71717a" }}>VIDEO_ID</Text>
                        </Text>
                      </>
                    )}
                  </View>

                  <View style={styles.half}>
                    <Text style={styles.label}>
                      What would you like to report?
                    </Text>
                    <View style={styles.pickerWrapper}>
                      {claimTypes.map((t) => (
                        <TouchableOpacity
                          key={t.value}
                          style={[
                            styles.pickerOption,
                            form.claimType === t.value &&
                              styles.pickerOptionActive,
                          ]}
                          onPress={() => handleChange("claimType", t.value)}
                        >
                          <Text
                            style={[
                              styles.pickerOptionText,
                              form.claimType === t.value &&
                                styles.pickerOptionTextActive,
                            ]}
                          >
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={{ marginTop: 16 }}>
                  <Text style={styles.label}>Tell us what happened *</Text>
                  <TextInput
                    value={form.claimDescription}
                    onChangeText={(v) => handleChange("claimDescription", v)}
                    placeholder="Explain how your copyrighted work was used without your permission..."
                    placeholderTextColor="#71717a"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    style={[styles.input, styles.textarea]}
                  />
                </View>

                <View style={{ marginTop: 16 }}>
                  <Text style={styles.label}>
                    Title of Your Original Work *
                  </Text>
                  <TextInput
                    value={form.originalWork}
                    onChangeText={(v) => handleChange("originalWork", v)}
                    placeholder="Enter the title of your original copyrighted work"
                    placeholderTextColor="#71717a"
                    style={styles.input}
                  />
                </View>

                <View style={[styles.row, { marginTop: 16 }]}>
                  <View style={styles.half}>
                    <VideoSearchSelect
                      label="Or search your videos to auto-fill (optional)"
                      placeholder="Search your videos by title..."
                      selectedVideo={selectedOriginalWork}
                      onSelect={(video) => {
                        setSelectedOriginalWork(video);
                        setForm((prev) => ({
                          ...prev,
                          originalWork: video.title || "",
                          originalWorkUrl: video.videoUrl || "",
                        }));
                      }}
                      onClear={() => setSelectedOriginalWork(null)}
                    />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.label}>
                      Link to Your Original Work (optional)
                    </Text>
                    <TextInput
                      value={form.originalWorkUrl}
                      onChangeText={(v) => handleChange("originalWorkUrl", v)}
                      placeholder="https://... (auto-filled if you select a video)"
                      placeholderTextColor="#71717a"
                      autoCapitalize="none"
                      keyboardType="url"
                      style={styles.input}
                    />
                  </View>
                </View>
              </View>

              {/* Declaration */}
              <View style={styles.section}>
                <View style={styles.declarationRow}>
                  <FileText size={20} color="#71717a" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.declarationText}>
                      I confirm that I am the copyright owner or authorized to
                      submit this claim. I confirm that the information I
                      provided is accurate and complete.
                    </Text>
                    <Text style={styles.declarationHint}>
                      I understand that submitting a false copyright claim may
                      have legal consequences.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  submitting && styles.disabledButton,
                ]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Send size={16} color="#fff" />
                    <Text style={styles.submitButtonText}>Submit Claim</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ===== LOOKUP TAB ===== */}
          {activeTab === "lookup" && (
            <View>
              <View style={styles.lookupRow}>
                <TextInput
                  value={lookupRef}
                  onChangeText={setLookupRef}
                  placeholder="Enter your reference number (e.g. PUB-260101-0001)"
                  placeholderTextColor="#71717a"
                  style={[styles.input, { flex: 1 }]}
                />
                <TouchableOpacity
                  style={[
                    styles.lookupButton,
                    (lookupLoading || !lookupRef.trim()) &&
                      styles.disabledButton,
                  ]}
                  onPress={handleLookup}
                  disabled={lookupLoading || !lookupRef.trim()}
                >
                  {lookupLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Search size={16} color="#fff" />
                      <Text style={styles.lookupButtonText}>Lookup</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {lookupError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{lookupError}</Text>
                </View>
              )}

              {lookupResult && (
                <View style={styles.section}>
                  <View style={styles.statusHeader}>
                    <Text style={styles.sectionTitle}>Claim Status</Text>
                    <Text
                      style={{
                        color: statusColors[lookupResult.status] || "#a1a1aa",
                        fontWeight: "600",
                        fontSize: 14,
                      }}
                    >
                      {statusLabels[lookupResult.status] ||
                        lookupResult.status?.replace(/_/g, " ")}
                    </Text>
                  </View>

                  <View style={styles.infoGrid}>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Reference Number</Text>
                      <Text style={styles.infoValueMono}>
                        {lookupResult.caseNumber}
                      </Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Filed On</Text>
                      <Text style={styles.infoValue}>
                        {lookupResult.filedAt
                          ? new Date(lookupResult.filedAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              },
                            )
                          : "-"}
                      </Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Claim Type</Text>
                      <Text style={styles.infoValue}>
                        {lookupResult.claimType?.replace(/_/g, " ") || "-"}
                      </Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Source</Text>
                      <Text style={styles.infoValue}>
                        {lookupResult.source === "public_submission"
                          ? "Public Submission"
                          : "Admin Created"}
                      </Text>
                    </View>
                  </View>

                  {lookupResult.claimDescription ? (
                    <View style={{ marginTop: 16 }}>
                      <Text style={styles.infoLabel}>Description</Text>
                      <Text style={styles.infoValue}>
                        {lookupResult.claimDescription}
                      </Text>
                    </View>
                  ) : null}

                  {lookupResult.resolution ? (
                    <View style={styles.resolutionBox}>
                      <Text style={styles.infoLabel}>Resolution</Text>
                      <Text style={styles.resolutionDecision}>
                        {lookupResult.resolution.decision?.replace(/_/g, " ")}
                      </Text>
                      {lookupResult.resolution.reason ? (
                        <Text style={styles.resolutionReason}>
                          {lookupResult.resolution.reason}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              )}

              {!lookupResult && !lookupError && !lookupLoading && (
                <View style={styles.emptyState}>
                  <Search size={48} color="#52525b" />
                  <Text style={styles.emptyStateText}>
                    Enter your reference number to check claim status
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <AdminBottomTabs navigation={navigation} />
    </SafeAreaView>
  );
}

// ---------- Styles (matched with ChannelScreen theme) ----------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 96,
  },
  contentArea: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    borderRadius: 999,
    marginBottom: 12,
  },
  badgeText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "500",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#a1a1aa",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 340,
  },
  tabs: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#272727",
  },
  tabButtonActive: {
    backgroundColor: "#ef4444",
  },
  tabText: {
    color: "#a1a1aa",
    fontSize: 14,
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#fff",
  },
  section: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#71717a",
    marginTop: 2,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: "#d4d4d8",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
  },
  disabledInput: {
    opacity: 0.5,
  },
  textarea: {
    minHeight: 100,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  half: {
    flex: 1,
    minWidth: 140,
  },
  hint: {
    fontSize: 11,
    color: "#52525b",
    marginTop: 4,
  },
  preloadedVideo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  preloadedTitle: {
    color: "#fff",
    fontSize: 14,
    flex: 1,
  },
  pickerWrapper: {
    gap: 6,
  },
  pickerOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#272727",
    borderWidth: 1,
    borderColor: "#333",
  },
  pickerOptionActive: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  pickerOptionText: {
    color: "#a1a1aa",
    fontSize: 13,
  },
  pickerOptionTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  declarationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  declarationText: {
    fontSize: 13,
    color: "#d4d4d8",
    lineHeight: 18,
  },
  declarationHint: {
    fontSize: 11,
    color: "#71717a",
    marginTop: 6,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ef4444",
    paddingVertical: 14,
    borderRadius: 999,
    marginTop: 8,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
  },
  successBox: {
    flexDirection: "row",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  successIconWrap: {
    padding: 10,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderRadius: 12,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#22c55e",
  },
  successDesc: {
    fontSize: 13,
    color: "#d4d4d8",
    marginTop: 4,
  },
  refBox: {
    backgroundColor: "#0f0f0f",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  refLabel: {
    fontSize: 12,
    color: "#a1a1aa",
  },
  refValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 4,
  },
  successHint: {
    fontSize: 12,
    color: "#71717a",
    marginTop: 10,
  },
  errorBox: {
    flexDirection: "row",
    backgroundColor: "#450a0a",
    borderWidth: 1,
    borderColor: "#991b1b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: "flex-start",
  },
  errorText: {
    fontSize: 13,
    color: "#fca5a5",
  },
  lookupRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  lookupButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ef4444",
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: "center",
  },
  lookupButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  infoItem: {
    width: "45%",
  },
  infoLabel: {
    fontSize: 12,
    color: "#71717a",
  },
  infoValue: {
    fontSize: 14,
    color: "#fff",
    marginTop: 2,
  },
  infoValueMono: {
    fontSize: 14,
    color: "#fff",
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  resolutionBox: {
    backgroundColor: "#0f0f0f",
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  resolutionDecision: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
    marginTop: 4,
  },
  resolutionReason: {
    fontSize: 13,
    color: "#a1a1aa",
    marginTop: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    color: "#a1a1aa",
    marginTop: 12,
    fontSize: 14,
  },
  // VideoSearchSelect
  relative: {
    position: "relative",
    zIndex: 10,
  },
  selectedVideoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectedVideoTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
  },
  searchInputWrapper: {
    position: "relative",
  },
  searchIcon: {
    position: "absolute",
    left: 12,
    top: 14,
    zIndex: 1,
  },
  searchInput: {
    paddingLeft: 36,
  },
  spinnerRight: {
    position: "absolute",
    right: 12,
    top: 14,
  },
  dropdown: {
    marginTop: 4,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    maxHeight: 220,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  thumb: {
    width: 40,
    height: 24,
    borderRadius: 4,
  },
  thumbPlaceholder: {
    width: 40,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#272727",
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownTitle: {
    flex: 1,
    color: "#d4d4d8",
    fontSize: 13,
  },
  dropdownEmpty: {
    marginTop: 4,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    padding: 12,
  },
  emptyText: {
    color: "#71717a",
    fontSize: 13,
  },
});
