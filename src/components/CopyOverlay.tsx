import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

export function CopyOverlay() {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.text}>Importing model to app storage...</Text>
        <Text style={styles.sub}>This may take a minute for large files</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  sub: {
    color: '#888',
    fontSize: 13,
  },
});
