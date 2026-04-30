import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');
const DURATION = 1200;

/**
 * Premium animated splash overlay for DataWise.
 * Shows a dark navy background with the DataWise icon logo animating in,
 * then fades out gracefully to reveal the app.
 */
export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  // Icon scales up from small to normal with elastic bounce
  const iconEnterKeyframe = new Keyframe({
    0: {
      transform: [{ scale: 0.5 }],
      opacity: 0,
    },
    30: {
      transform: [{ scale: 1.1 }],
      opacity: 1,
      easing: Easing.out(Easing.cubic),
    },
    50: {
      transform: [{ scale: 0.95 }],
      opacity: 1,
      easing: Easing.inOut(Easing.ease),
    },
    65: {
      transform: [{ scale: 1.02 }],
      opacity: 1,
      easing: Easing.inOut(Easing.ease),
    },
    75: {
      transform: [{ scale: 1 }],
      opacity: 1,
      easing: Easing.out(Easing.ease),
    },
    90: {
      transform: [{ scale: 1 }],
      opacity: 1,
    },
    100: {
      transform: [{ scale: 12 }],
      opacity: 0,
      easing: Easing.in(Easing.cubic),
    },
  });

  // Glow ring pulses behind the icon
  const glowKeyframe = new Keyframe({
    0: {
      transform: [{ scale: 0.6 }],
      opacity: 0,
    },
    30: {
      transform: [{ scale: 1.4 }],
      opacity: 0.5,
      easing: Easing.out(Easing.cubic),
    },
    75: {
      transform: [{ scale: 1.6 }],
      opacity: 0.3,
      easing: Easing.inOut(Easing.ease),
    },
    100: {
      transform: [{ scale: 2.5 }],
      opacity: 0,
      easing: Easing.in(Easing.cubic),
    },
  });

  // App name fades in and out
  const textKeyframe = new Keyframe({
    0: {
      opacity: 0,
      transform: [{ translateY: 20 }],
    },
    35: {
      opacity: 1,
      transform: [{ translateY: 0 }],
      easing: Easing.out(Easing.cubic),
    },
    80: {
      opacity: 1,
      transform: [{ translateY: 0 }],
    },
    100: {
      opacity: 0,
      transform: [{ translateY: -10 }],
      easing: Easing.in(Easing.ease),
    },
  });

  return (
    <Animated.View
      style={styles.container}
    >
      <LinearGradient
        colors={['#0B1020', '#121933', '#0B1020']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Ambient glow behind icon */}
      <Animated.View
        entering={glowKeyframe.duration(DURATION)}
        style={styles.glowContainer}
      >
        <Image
          style={styles.glow}
          source={require('@/assets/images/logo-glow.png')}
        />
      </Animated.View>

      {/* DataWise icon logo */}
      <Animated.View
        entering={iconEnterKeyframe.duration(DURATION).withCallback((finished) => {
          'worklet';
          if (finished) {
            scheduleOnRN(setVisible, false);
          }
        })}
        style={styles.iconWrapper}
      >
        <Image
          style={styles.icon}
          source={require('@/assets/images/icon.png')}
          contentFit="contain"
        />
      </Animated.View>

      {/* App name text */}
      <Animated.View
        entering={textKeyframe.duration(DURATION)}
        style={styles.textContainer}
      >
        <Text style={styles.appName}>DataWise</Text>
        <Text style={styles.tagline}>Smart usage insights</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backgroundColor: '#0B1020',
  },
  glowContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 300,
    height: 300,
    opacity: 0.6,
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  icon: {
    width: 140,
    height: 140,
    borderRadius: 32,
  },
  textContainer: {
    position: 'absolute',
    bottom: SCREEN_HEIGHT * 0.18,
    alignItems: 'center',
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 1.5,
  },
  tagline: {
    fontSize: 14,
    color: '#CBD5E1',
    marginTop: 6,
    letterSpacing: 0.5,
  },
});
