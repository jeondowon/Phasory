// Stylized sound-map background (PHASE-SPEC §6.1). Not a real map — a hand-drawn
// SVG: simplified land / water / roads in the PHASE light tone. The spec describes
// the elements and counts (the original HTML's paths are procedural); these paths
// recreate that mood within the same 372×826 viewBox.
import Svg, { Rect, Path, Polygon, G } from 'react-native-svg';
import { StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';

const BLOCKS = [
  { x: 150, y: 300, w: 60, h: 40 },
  { x: 222, y: 362, w: 50, h: 55 },
  { x: 80, y: 442, w: 55, h: 45 },
  { x: 200, y: 502, w: 60, h: 50 },
  { x: 120, y: 562, w: 45, h: 40 },
  { x: 250, y: 200, w: 50, h: 45 },
];

const ARTERIALS = [
  'M-10,180 C80,150 140,260 230,230 S360,300 390,270',
  'M-10,420 C90,400 160,500 260,470 S380,520 400,500',
  'M40,-10 C70,120 30,240 90,360 S60,620 120,840',
  'M250,-10 C230,140 300,260 250,400 S300,640 260,840',
  'M-10,640 C120,610 200,700 320,670 S380,700 400,690',
];

const STREETS = [
  'M60,200 L180,180',
  'M120,300 L240,320',
  'M80,470 L200,450',
  'M200,520 L300,540',
  'M150,610 L260,590',
  'M90,360 L160,380',
  'M260,260 L330,250',
];

export function SoundMapCanvas() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 372 826" preserveAspectRatio="xMidYMid slice">
      {/* land base */}
      <Rect x={0} y={0} width={372} height={826} fill={colors.mapLand} />

      {/* park / open block */}
      <Polygon points="20,90 95,75 120,150 70,200 18,170" fill={colors.mapPark} />

      {/* city blocks */}
      {BLOCKS.map((b, i) => (
        <Rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={3} fill={colors.mapBlock} />
      ))}

      {/* water: river (stroked) + corner bay (filled) */}
      <Path
        d="M300,-10 C280,120 330,240 300,360 S260,620 290,840"
        stroke={colors.mapWater}
        strokeWidth={15}
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M372,640 L372,826 L240,826 C300,760 320,700 372,640 Z" fill={colors.mapWater} />
      <Path
        d="M240,826 C300,760 320,700 372,640"
        stroke={colors.mapCoast}
        strokeWidth={1.3}
        fill="none"
      />

      {/* roads */}
      <G stroke={colors.mapRoad} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {ARTERIALS.map((d, i) => (
          <Path key={`a${i}`} d={d} strokeWidth={6} />
        ))}
        {STREETS.map((d, i) => (
          <Path key={`s${i}`} d={d} strokeWidth={2.4} />
        ))}
      </G>

      {/* orange route near the selected pin */}
      <Path
        d="M40,330 C70,300 80,280 110,275"
        stroke={colors.accent}
        strokeWidth={3.5}
        strokeLinecap="round"
        opacity={0.9}
        fill="none"
      />
    </Svg>
  );
}
