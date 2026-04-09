import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function LikedYouScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Likes</Text>
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
