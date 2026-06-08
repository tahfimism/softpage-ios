import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={s.root}>
        <StatusBar style="light" backgroundColor="#0a0a0a" />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: '#0f0f0f',
            },
            headerTintColor: '#f0f0f0',
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 17,
            },
            headerShadowVisible: false,
            contentStyle: {
              backgroundColor: '#0a0a0a',
            },
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: 'SoftPage',
              headerRight: () => null,
            }}
          />
          <Stack.Screen
            name="about"
            options={{
              title: 'About',
              presentation: 'modal',
            }}
          />
        </Stack>
      </View>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
});
