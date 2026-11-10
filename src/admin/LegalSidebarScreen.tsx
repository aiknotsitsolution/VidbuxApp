// screens/LegalSidebarScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

type SectionKey =
  | "privacy"
  | "terms"
  | "community"
  | "content"
  | "copyright"
  | "deletion"
  | "help"
  | "about";

interface Section {
  key: SectionKey;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const SECTIONS: Section[] = [
  { key: "privacy", title: "Privacy Policy", icon: "shield-checkmark-outline" },
  {
    key: "terms",
    title: "Terms and Conditions",
    icon: "document-text-outline",
  },
  { key: "community", title: "Community Guidelines", icon: "people-outline" },
  { key: "content", title: "Content Policy", icon: "alert-circle-outline" },
  { key: "copyright", title: "Copyright Policy", icon: "copy-outline" },
  { key: "deletion", title: "Account & Data Deletion", icon: "trash-outline" },
  { key: "help", title: "Help and Support", icon: "help-circle-outline" },
  { key: "about", title: "About Us", icon: "information-circle-outline" },
];

const SUPPORT_EMAIL = "admin@VidBuxApp.com";
const COPYRIGHT_EMAIL = "admin@VidBuxApp.com";

export default function LegalSidebarScreen() {
  const navigation = useNavigation();
  // Terms by default open
  const [expanded, setExpanded] = useState<SectionKey | null>("terms");

  const toggleSection = (key: SectionKey) => {
    setExpanded((prev) => (prev === key ? null : key));
  };

  const renderContent = (key: SectionKey) => {
    switch (key) {
      case "terms":
        return (
          <View style={styles.contentBox}>
            <Text style={styles.lastUpdated}>
              Last updated: September 18, 2026
            </Text>

            <Text style={styles.heading}>1. Welcome to VidBuxApp</Text>
            <Text style={styles.paragraph}>
              VidBuxApp is a creator-first entertainment platform for
              discovering, watching, and sharing short-form and long-form video
              content. By accessing or using the VidBuxApp app, website, or
              related services, you agree to these Terms and Conditions.
            </Text>

            <Text style={styles.heading}>2. Who May Use the Service</Text>
            <Text style={styles.paragraph}>
              • You must be at least 13 years old to use the Service.{"\n"}• If
              you are under 18, you must have parental or guardian consent.
              {"\n"}• You must not use the Service for unlawful, abusive,
              deceptive, or harmful purposes.
            </Text>

            <Text style={styles.heading}>3. User Responsibilities</Text>
            <Text style={styles.paragraph}>
              You agree to use VidBuxApp responsibly and in compliance with all
              applicable laws. You may not upload, share, or promote prohibited
              content, spam, scams, manipulative engagement, or misleading
              activity.
            </Text>
            <Text style={styles.bullet}>
              • Do not infringe copyright or other intellectual property rights.
              {"\n"}• Do not impersonate others or misrepresent your identity.
              {"\n"}• Do not access or attempt to disrupt the platform, APIs,
              monetization systems, or other users’ accounts.{"\n"}• Do not
              collect personal information from other users without consent.
            </Text>

            <Text style={styles.heading}>4. Your Content</Text>
            <Text style={styles.paragraph}>
              You retain ownership of your uploaded content. By uploading
              content to VidBuxApp, you grant us a worldwide, non-exclusive,
              royalty-free license to host, display, distribute, promote, and
              monetize that content as part of the Service, where permitted by
              law and platform functionality.
            </Text>
            <Text style={styles.paragraph}>
              You are responsible for ensuring that you have the right to upload
              and share the content you post, including all required licenses,
              rights, and clearances.
            </Text>

            <Text style={styles.heading}>
              5. Account Suspension and Termination
            </Text>
            <Text style={styles.paragraph}>
              VidBuxApp may suspend, restrict, or terminate accounts that
              violate these Terms, the Community Guidelines, or relevant laws.
              We may also remove content that violates our policies.
            </Text>

            <Text style={styles.heading}>6. Service Availability</Text>
            <Text style={styles.paragraph}>
              VidBuxApp may update, modify, suspend, or discontinue features at
              any time. We aim to provide a reliable service, but we do not
              guarantee uninterrupted access or error-free operation.
            </Text>

            <Text style={styles.heading}>7. Liability</Text>
            <Text style={styles.paragraph}>
              VidBuxApp is provided on an “as is” basis. We are not liable for
              indirect, incidental, or consequential damages arising from your
              use of the platform, except where required by applicable law.
            </Text>

            <Text style={styles.heading}>8. Changes to Terms</Text>
            <Text style={styles.paragraph}>
              We may update these Terms from time to time. Continued use of
              VidBuxApp after changes become effective means you accept the
              revised Terms.
            </Text>

            <Text style={styles.heading}>9. Contact</Text>
            <Text style={styles.paragraph}>
              For questions about these Terms, contact us at{"\n"}
              <Text
                style={styles.link}
                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
              >
                {SUPPORT_EMAIL}
              </Text>
            </Text>
          </View>
        );

      case "privacy":
        return (
          <View style={styles.contentBox}>
            <Text style={styles.lastUpdated}>
              Last updated: September 18, 2026
            </Text>
            <Text style={styles.paragraph}>
              VidBuxApp respects your privacy. This Privacy Policy explains how
              we collect, use, protect, and share data when you use the
              VidBuxApp app, website, creator tools, or connected services.
            </Text>

            <Text style={styles.heading}>Information We Collect</Text>
            <Text style={styles.bullet}>
              • Account information such as name, email, phone number, profile
              details, and identity verification data{"\n"}• Usage data such as
              videos watched, likes, comments, follows, searches, watch history,
              and engagement patterns{"\n"}• Device and technical information
              such as operating system, app version, device model, network
              details, and app diagnostics{"\n"}• Uploaded content, metadata,
              and creator information needed to provide platform features and
              moderation
            </Text>

            <Text style={styles.heading}>How We Use Information</Text>
            <Text style={styles.bullet}>
              • To provide and improve the VidBuxApp experience{"\n"}• To
              personalize content, recommendations, and discovery features{"\n"}
              • To secure the Service, prevent abuse, and support moderation and
              safety systems{"\n"}• To communicate support, updates, account
              notices, and important legal information
            </Text>

            <Text style={styles.heading}>Data Sharing</Text>
            <Text style={styles.paragraph}>
              We may share data with trusted service providers that help us run
              the platform, support analytics, enable security features, and
              manage advertising or app operations. Depending on the release,
              country, and mediation configuration, advertising partners may
              include AppLovin MAX, Unity Ads, LevelPlay (ironSource),
              Mintegral, or other providers enabled in the future. We may also
              disclose data to law enforcement, regulators, or other authorities
              when required by law or necessary to protect user safety and
              platform integrity.
            </Text>

            <Text style={styles.heading}>Rewards and Advertising</Text>
            <Text style={styles.paragraph}>
              Rewarded ads may provide in-app points when an eligible ad is
              completed and the server confirms the event. Points are not a
              guaranteed cash payment. Rewards may be limited, reversed, or
              frozen for duplicate accounts, automation, invalid activity,
              fraud, policy violations, or technical errors. Conversion rates,
              eligibility, minimum withdrawal thresholds, supported payout
              methods, and processing times depend on the active VidBuxApp
              rewards program and are shown when available. Never click ads or
              interact with ads solely to manipulate rewards.
            </Text>

            <Text style={styles.heading}>Your Rights</Text>
            <Text style={styles.paragraph}>
              You can review, update, or request deletion of your account and
              related data through the app settings or by contacting our support
              team. We aim to respond to privacy requests in a timely and
              transparent manner.
            </Text>
          </View>
        );

      case "community":
        return (
          <View style={styles.contentBox}>
            <Text style={styles.paragraph}>
              VidBuxApp is committed to building a respectful, safe, and
              inclusive community for creators, viewers, and brands. These
              guidelines explain what is expected from users on the platform.
            </Text>
            <Text style={styles.bullet}>
              • Be respectful to other users, creators, moderators, and teams
              working on VidBuxApp{"\n"}• No harassment, hate speech, threats,
              or discriminatory behavior{"\n"}• No illegal activity, scams,
              fraud, or harmful misinformation{"\n"}• No content that exploits
              children or sexualizes minors{"\n"}• No spam, repeated abuse, or
              artificial engagement manipulation{"\n"}• Respect the rights,
              privacy, and creative work of others
            </Text>
            <Text style={styles.paragraph}>
              Violations may lead to warnings, content removal, temporary
              restrictions, demonetization, or permanent account termination,
              depending on severity, frequency, and harm caused.
            </Text>
          </View>
        );

      case "content":
        return (
          <View style={styles.contentBox}>
            <Text style={styles.paragraph}>
              VidBuxApp allows original, licensed, and lawfully shared content
              that complies with local regulations and our platform standards.
              The following content is not allowed:
            </Text>
            <Text style={styles.bullet}>
              • Illegal or dangerous material{"\n"}• Violence, extremism, or
              hate content{"\n"}• Explicit sexual content, nudity, or
              exploitative material{"\n"}• Spam, scams, phishing, or misleading
              content{"\n"}• Copyright infringement or unauthorized use of
              protected media{"\n"}• Self-harm, unsafe challenges, or harmful
              behavior
            </Text>
            <Text style={styles.paragraph}>
              We may restrict, age-gate, or remove content that violates this
              policy. Serious violations may be escalated to the appropriate
              authorities or platform enforcement teams.
            </Text>
          </View>
        );

      case "copyright":
        return (
          <View style={styles.contentBox}>
            <Text style={styles.paragraph}>
              VidBuxApp respects the rights of copyright owners. If you believe
              content on VidBuxApp infringes your copyright, please contact us
              using the notice details below so we can review the claim quickly
              and fairly.
            </Text>
            <Text style={styles.heading}>What to Include</Text>
            <Text style={styles.bullet}>
              • Description of the copyrighted work{"\n"}• URL or location of
              the allegedly infringing content{"\n"}• Your contact information
              {"\n"}• A statement of good-faith belief that the use is
              unauthorized{"\n"}• A statement that the information is accurate
              {"\n"}• Your signature or electronic acknowledgment
            </Text>
            <Text style={styles.paragraph}>
              If your content was removed and you believe it was a mistake, you
              may submit a counter-notification with your contact details and
              relevant statement.
            </Text>
            <Text style={styles.paragraph}>
              Copyright notices can be sent to{"\n"}
              <Text
                style={styles.link}
                onPress={() => Linking.openURL(`mailto:${COPYRIGHT_EMAIL}`)}
              >
                {COPYRIGHT_EMAIL}
              </Text>
            </Text>
          </View>
        );

      case "deletion":
        return (
          <View style={styles.contentBox}>
            <Text style={styles.paragraph}>
              You may delete your VidBuxApp account and related data at any time
              from the app settings, or by contacting support for assisted
              account removal.
            </Text>
            <Text style={styles.heading}>What Happens After Deletion</Text>
            <Text style={styles.bullet}>
              • Your profile, likes, comments, watch history, and saved data may
              be removed{"\n"}• Public content may be deleted or removed from
              view{"\n"}• Some data may be retained where required by law,
              safety procedures, or platform integrity review
            </Text>
            <Text style={styles.paragraph}>
              If you need help deleting your account, contact us at{"\n"}
              <Text
                style={styles.link}
                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
              >
                {SUPPORT_EMAIL}
              </Text>
            </Text>
          </View>
        );

      case "help":
        return (
          <View style={styles.contentBox}>
            <Text style={styles.paragraph}>
              Need help with your account, creator tools, safety, or playback
              issues? We’re here to assist quickly and clearly.
            </Text>
            <Text style={styles.heading}>Support Channels</Text>
            <Text style={styles.bullet}>
              • Email support: {SUPPORT_EMAIL}
              {"\n"}• In-app support and reporting tools{"\n"}• Help Center and
              policy documentation{"\n"}• Report buttons on videos, comments,
              and channels{"\n"}• Safety and account review for suspicious or
              harmful activity
            </Text>
            <Text style={styles.paragraph}>
              Please include as much detail as possible when reporting a
              problem, account concern, or content issue so we can assist
              quickly and accurately.
            </Text>
          </View>
        );

      case "about":
        return (
          <View style={styles.contentBox}>
            <Text style={styles.paragraph}>
              VidBuxApp is a digital entertainment and creator platform built
              for viewers, communities, and publishers. We aim to make content
              discovery, creator growth, and social engagement simple, safe, and
              accessible for Indian audiences and global users alike.
            </Text>
            <Text style={styles.paragraph}>
              Our mission is to support healthy creator growth, transparent
              policy enforcement, and a positive entertainment experience for
              users across India and beyond. We combine discovery, community,
              and creator tools in one app experience that is designed for
              digital media growth and user trust.
            </Text>
            <Text style={styles.paragraph}>
              © 2026 VidBuxApp. All rights reserved. For support, contact{" "}
              <Text
                style={styles.link}
                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
              >
                {SUPPORT_EMAIL}
              </Text>
              .
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal & Policies</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {SECTIONS.map((section) => {
          const isOpen = expanded === section.key;
          return (
            <View key={section.key} style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionHeader}
                activeOpacity={0.7}
                onPress={() => toggleSection(section.key)}
              >
                <View style={styles.sectionLeft}>
                  <Ionicons
                    name={section.icon}
                    size={22}
                    color={isOpen ? "#3ea6ff" : "#aaa"}
                  />
                  <Text
                    style={[
                      styles.sectionTitle,
                      isOpen && styles.sectionTitleActive,
                    ]}
                  >
                    {section.title}
                  </Text>
                </View>
                <Ionicons
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#aaa"
                />
              </TouchableOpacity>

              {isOpen && renderContent(section.key)}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: "#181818",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  sectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  sectionTitle: {
    color: "#ddd",
    fontSize: 16,
    fontWeight: "600",
  },
  sectionTitleActive: {
    color: "#fff",
  },
  contentBox: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
  },
  lastUpdated: {
    color: "#888",
    fontSize: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  heading: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 6,
  },
  paragraph: {
    color: "#ccc",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  bullet: {
    color: "#ccc",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  bold: {
    fontWeight: "700",
    color: "#fff",
  },
  link: {
    color: "#3ea6ff",
    textDecorationLine: "underline",
  },
});
