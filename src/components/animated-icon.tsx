import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { themedStyles } from '@/theme/theme';

/** Matches the native splash (app.json): the Kwetu icon on its own yellow. */
const SPLASH_BACKGROUND = '#FDC52B';
const DURATION = 500;

const fadeOut = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 1.08 }], easing: Easing.out(Easing.quad) },
});

/** Hands over from the native splash screen with a short fade, then removes itself. */
export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const icon = <Image accessibilityIgnoresInvertColors source={require('@/assets/images/kwetu-app-icon.png')} style={styles.icon} />;

  return animate ? (
    <Animated.View
      entering={fadeOut.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) scheduleOnRN(setVisible, false);
      })}
      style={styles.overlay}>
      {icon}
    </Animated.View>
  ) : (
    <View onLayout={() => { SplashScreen.hideAsync().finally(() => setAnimate(true)); }} style={styles.overlay}>
      {icon}
    </View>
  );
}

const styles = themedStyles(({ bg }) => ({
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: bg(SPLASH_BACKGROUND), zIndex: 1000 },
  icon: { width: 200, height: 200 },
}));
