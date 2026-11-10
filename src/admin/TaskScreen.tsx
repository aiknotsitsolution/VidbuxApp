import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import axios from "axios";
import { API_ORIGIN } from "../../config/api";

const USER_API = `${API_ORIGIN}/api/users`;
const TASK_API = `${API_ORIGIN}/api/tasks`;

export default function TaskScreen() {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchTasks();
  }, []);

  const fetchUsers = async () => {
    const res = await axios.get(USER_API);
    setUsers(res.data);
  };

  const fetchTasks = async () => {
    const res = await axios.get(TASK_API);
    setTasks(res.data);
  };

  const assignTask = async () => {
    await axios.post(TASK_API, {
      title,
      description,
      assignedTo: selectedUser,
    });

    setTitle("");
    setDescription("");
    fetchTasks();
  };

  const markComplete = async (id) => {
    await axios.put(`${TASK_API}/${id}`, {
      status: "Completed",
    });
    fetchTasks();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Assign Task</Text>

      <TextInput
        placeholder="Task Title"
        value={title}
        onChangeText={setTitle}
        style={styles.input}
      />

      <TextInput
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        style={styles.input}
      />

      {/* Simple User Selector */}
      <FlatList
        horizontal
        data={users}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.userBtn,
              selectedUser === item._id && { backgroundColor: "blue" },
            ]}
            onPress={() => setSelectedUser(item._id)}
          >
            <Text style={{ color: "#fff" }}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.assignBtn} onPress={assignTask}>
        <Text style={{ color: "#fff" }}>Assign Task</Text>
      </TouchableOpacity>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>{item.title}</Text>
            <Text>Status: {item.status}</Text>
            <Text>User: {item.assignedTo?.name}</Text>

            {item.status === "Pending" && (
              <TouchableOpacity
                style={styles.completeBtn}
                onPress={() => markComplete(item._id)}
              >
                <Text style={{ color: "#fff" }}>Mark Complete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  input: {
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
  },
  userBtn: {
    backgroundColor: "gray",
    padding: 8,
    borderRadius: 6,
    marginRight: 5,
  },
  assignBtn: {
    backgroundColor: "green",
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
  },
  card: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    borderRadius: 8,
  },
  completeBtn: {
    backgroundColor: "orange",
    padding: 8,
    marginTop: 5,
    borderRadius: 6,
  },
});
