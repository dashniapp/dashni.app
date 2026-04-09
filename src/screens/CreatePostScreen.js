import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Placeholder — replace with the real post-creation implementation.
export default function CreatePostScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Create Post — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080810',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 16,
  },
});
