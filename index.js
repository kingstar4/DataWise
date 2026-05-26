import '@expo/metro-runtime';
import 'expo/src/Expo.fx';

import { App } from 'expo-router/build/qualified-entry';
import { AppRegistry, Platform } from 'react-native';
import * as SplashScreen from 'expo-router/build/utils/splash';

if (process.env.NODE_ENV !== 'production') {
  require('@expo/log-box/lib').setupLogBox();
}

setTimeout(() => {
  SplashScreen._internal_preventAutoHideAsync?.();
});

AppRegistry.registerComponent('main', () => App);

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const rootTag = document.getElementById('root');

  if (process.env.NODE_ENV !== 'production' && !rootTag) {
    throw new Error('Required HTML element with id "root" was not found in the document HTML.');
  }

  AppRegistry.runApplication('main', {
    rootTag,
    hydrate: globalThis.__EXPO_ROUTER_HYDRATE__,
  });
}
