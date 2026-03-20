import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

type Timings = {
  predicted_per_second?: number;
  prompt_ms?: number;
  predicted_ms?: number;
  predicted_n?: number;
};

type Props = {
  timings: Timings;
};

export function MetricsBar({timings}: Props) {
  const items: string[] = [];

  if (timings.predicted_per_second != null) {
    items.push(`${timings.predicted_per_second.toFixed(1)} tok/s`);
  }
  if (timings.prompt_ms != null) {
    items.push(`TTFT ${timings.prompt_ms.toFixed(0)}ms`);
  }
  if (timings.predicted_ms != null) {
    items.push(`${(timings.predicted_ms / 1000).toFixed(1)}s`);
  }
  if (timings.predicted_n != null) {
    items.push(`${timings.predicted_n} tokens`);
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{items.join('  |  ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
    paddingTop: 4,
  },
  text: {
    fontSize: 11,
    color: '#666',
    fontFamily: undefined, // uses default monospace on each platform
  },
});
