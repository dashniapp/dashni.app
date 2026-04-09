import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CreatePostScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Create Post</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
});
