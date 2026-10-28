// Hands over from the native splash screen: the same logo on the same background, drawn by the
// app, which then eases away (on the UI thread) while the first screen settles in beneath it.
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, useColorScheme } from 'react-native';

// Matches app.json → expo-splash-screen (imageWidth 170; the image is 430×460): iOS draws it
// 170 wide, Android fits it in a 170 square.
const LOGO = require('../../assets/images/splash-logo.png');
const LOGO_WIDTH = Platform.OS === 'android' ? (170 * 430) / 460 : 170;
const LOGO_HEIGHT = Platform.OS === 'android' ? 170 : (170 * 460) / 430;
const BACKGROUND = { light: '#FBFAF5', dark: '#10140F' };

export const LAUNCH_MS = 700;

/** `progress` runs 0 → 1; the app scales in with the same value. */
export function LaunchVeil({ progress, onDone }: { progress: Animated.Value; onDone: () => void }) {
  const scheme = useColorScheme();
  const started = useRef(false);

  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;
    // The veil is drawn and identical to the native splash, so swapping them is invisible.
    SplashScreen.hide();
    Animated.timing(progress, { toValue: 1, duration: LAUNCH_MS, easing: Easing.bezier(0.33, 0, 0.15, 1), useNativeDriver: true }).start(onDone);
  }, [progress, onDone]);

  // In case the image's load event never arrives.
  useEffect(() => {
    const t = setTimeout(start, 400);
    return () => clearTimeout(t);
  }, [start]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: scheme === 'dark' ? BACKGROUND.dark : BACKGROUND.light,
          opacity: progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1, 0] }),
        },
      ]}>
      <Animated.Image
        source={LOGO}
        onLoadEnd={start}
        style={{
          width: LOGO_WIDTH,
          height: LOGO_HEIGHT,
          opacity: progress.interpolate({ inputRange: [0, 0.2, 0.7], outputRange: [1, 1, 0], extrapolate: 'clamp' }),
          transform: [{ scale: progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [1, 0.96, 1.16] }) }],
        }}
      />
    </Animated.View>
  );
}
