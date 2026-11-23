// Small, shared animations. Reanimated follows the phone's "reduce motion" setting by default, so people
// who turned animations off on their phone see none of these.
import { Pressable, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type EntryOrExitLayoutType,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const PRESS_SPRING = { duration: 220, dampingRatio: 0.75 };
const PRESSED_SCALE = 0.97;
/** Only the first items of a list fade in, so scrolling fast through a long list stays calm. */
const STAGGERED_ITEMS = 8;

/** Cards fade and rise into place one after another when a list first appears. */
export function listEntering(index: number): EntryOrExitLayoutType | undefined {
  return index < STAGGERED_ITEMS ? FadeInDown.duration(350).delay(index * 60) : undefined;
}

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Optional animation when the element first appears, such as listEntering(index). */
  entering?: EntryOrExitLayoutType;
};

/** A Pressable that shrinks a little while it is held, so a tap feels like pressing a real card. */
export function PressableScale({ entering, onPressIn, onPressOut, style, ...rest }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const pressedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <AnimatedPressable
    {...rest}
    entering={entering}
    onPressIn={(event) => { scale.set(withSpring(PRESSED_SCALE, PRESS_SPRING)); onPressIn?.(event); }}
    onPressOut={(event) => { scale.set(withSpring(1, PRESS_SPRING)); onPressOut?.(event); }}
    style={[style, pressedStyle]}
  />;
}

type SaveButtonProps = {
  saved: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  style: StyleProp<ViewStyle>;
  iconStyle: StyleProp<TextStyle>;
  savedIconStyle: StyleProp<TextStyle>;
};

/** The heart on restaurant and food cards. It pops when something is saved. */
export function SaveButton({ accessibilityLabel, iconStyle, onPress, saved, savedIconStyle, style }: SaveButtonProps) {
  const scale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const press = () => {
    if (!saved) scale.set(withSequence(withTiming(1.4, { duration: 110 }), withSpring(1, { duration: 320, dampingRatio: 0.45 })));
    onPress();
  };
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" hitSlop={8} onPress={press} style={style}>
    <Animated.Text style={[iconStyle, saved && savedIconStyle, heartStyle]}>{saved ? '♥' : '♡'}</Animated.Text>
  </Pressable>;
}
