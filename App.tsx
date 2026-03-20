import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ModelProvider} from './src/context/ModelContext';
import {usePermissions} from './src/hooks/usePermissions';
import {AppNavigator} from './src/navigation/AppNavigator';

function App() {
  const {permissionsReady} = usePermissions();

  if (!permissionsReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ModelProvider>
        <AppNavigator />
      </ModelProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
