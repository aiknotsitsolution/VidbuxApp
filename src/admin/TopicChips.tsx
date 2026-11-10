import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import axios from "axios";
import { API_ORIGIN } from "../../config/api";

const API_URL = `${API_ORIGIN}/api/category`;
const ALL_CHIP = { _id: "all", name: "All" };

export default function TopicChips({ onTopicChange }) {
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(ALL_CHIP.name);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get(API_URL);
        const data = Array.isArray(res.data) ? res.data : [];
        setTopics([
          ALL_CHIP,
          ...data.filter((item) => item.name !== ALL_CHIP.name),
        ]);
        onTopicChange?.(ALL_CHIP.name, null);
      } catch (err) {
        console.error("Category fetch error:", err);
        // fallback
        setTopics([
          { _id: "1", name: "For you" },
          { _id: "2", name: "Gaming" },
          { _id: "3", name: "Music" },
          { _id: "4", name: "Education" },
          { _id: "5", name: "Tech" },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const handleTopicClick = (topic) => {
    setSelectedTopic(topic.name);
    onTopicChange?.(topic.name, topic._id || topic.id);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#fff" size="small" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {[
          ALL_CHIP,
          ...topics.filter((topic) => topic.name !== ALL_CHIP.name),
        ].map((topic) => {
          const isActive = selectedTopic === topic.name;
          return (
            <TouchableOpacity
              key={topic._id || topic.id || topic.name}
              onPress={() => handleTopicClick(topic)}
              style={[styles.chip, isActive && styles.chipActive]}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.chipText, isActive && styles.chipTextActive]}
              >
                {topic.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0f0f0f",
    borderBottomWidth: 1,
    borderBottomColor: "#1f1f1f",
    paddingTop: 8,
    paddingBottom: 10,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    backgroundColor: "#272727",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  chipActive: {
    backgroundColor: "#fff",
  },
  chipText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#000",
  },
});
