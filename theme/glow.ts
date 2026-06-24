// Orange glow ≈ CSS box-shadow (PHASE-SPEC §2.4: the only allowed "shadow").
// iOS renders the colored blur faithfully; Android shows a neutral elevation
// fallback since colored shadows aren't supported on older APIs.
import type { ViewStyle } from 'react-native';
import { colors } from './colors';

export function glow(radius: number, opacity = 1, color: string = colors.accent): ViewStyle {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: radius,
    shadowOpacity: opacity,
    elevation: Math.round(radius / 2),
  };
}
