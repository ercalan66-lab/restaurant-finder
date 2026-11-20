import { Image, type ImageProps } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  children?: ReactNode;
  /** Local `require(...)` image or `{ uri }`. Without one, only the view's own background shows. */
  source?: ImageProps['source'];
  style?: StyleProp<ViewStyle>;
  imageStyle?: ImageProps['style'];
};

/**
 * A view with a photo filling it from behind. Replaces React Native's deprecated ImageBackground;
 * expo-image also caches remote photos and fades them in.
 */
export function PhotoBackground({ children, imageStyle, source, style }: Props) {
  return <View style={style}>
    {source ? <Image accessibilityIgnoresInvertColors contentFit="cover" source={source} style={[StyleSheet.absoluteFill, imageStyle]} transition={150} /> : null}
    {children}
  </View>;
}
