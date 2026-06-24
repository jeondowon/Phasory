// PHASE typography — PHASE-SPEC.md §2.3. Monospace everywhere (JetBrains Mono).
// Never fall back to a sans-serif. Weights/sizes may change, the family may not.
import type { TextStyle } from 'react-native';

// Font names provided by @expo-google-fonts/jetbrains-mono
export const fonts = {
  light: 'JetBrainsMono_300Light',
  regular: 'JetBrainsMono_400Regular',
  medium: 'JetBrainsMono_500Medium',
  semibold: 'JetBrainsMono_600SemiBold',
  bold: 'JetBrainsMono_700Bold',
} as const;

// Reusable text styles. letterSpacing is absolute (≈ px) in RN, matching the spec.
export const type = {
  timer: { fontFamily: fonts.light, fontSize: 46, letterSpacing: 2 },
  header: { fontFamily: fonts.regular, fontSize: 13, letterSpacing: 3 },
  padName: { fontFamily: fonts.regular, fontSize: 14 },
  cardTitle: { fontFamily: fonts.regular, fontSize: 14 },
  body: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 22 },
  button: { fontFamily: fonts.regular, fontSize: 13, letterSpacing: 2 },
  meta: { fontFamily: fonts.regular, fontSize: 11, letterSpacing: 1 },
  sublabel: { fontFamily: fonts.regular, fontSize: 10, letterSpacing: 1.5 },
  caption: { fontFamily: fonts.regular, fontSize: 9, letterSpacing: 1 },
  tiny: { fontFamily: fonts.regular, fontSize: 8, letterSpacing: 1 },
} satisfies Record<string, TextStyle>;
