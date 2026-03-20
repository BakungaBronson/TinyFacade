import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';

type Props = {
  uri: string;
  onRemove: () => void;
};

export function ImagePreview({uri, onRemove}: Props) {
  return (
    <View style={styles.container}>
      <Image source={{uri}} style={styles.image} />
      <Pressable style={styles.removeButton} onPress={onRemove}>
        <Text style={styles.removeText}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginLeft: 12,
    marginBottom: 8,
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
